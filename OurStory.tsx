import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Heart, Calendar as CalIcon, Wallet, Briefcase, Plus, X, Settings,
  Download, Trash2, ChevronLeft, ChevronRight, Sparkles, Pencil, Check,
  Sun, Moon, Star, BookOpen, Upload
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

/* ---------------- palette + fonts ---------------- */
const C = {
  paper: "#FBF4E9",
  paper2: "#F3E7D3",
  ink: "#3E2A2E",
  rose: "#B5614F",
  roseSoft: "#C97B6A",
  wine: "#6E3B4E",
  gold: "#BE9B4B",
};

const MOODS = [
  { key: "loved",   label: "Loved",    emoji: "🥰", color: "#C95B7A" },
  { key: "joyful",  label: "Joyful",   emoji: "😊", color: "#E0913B" },
  { key: "excited", label: "Excited",  emoji: "🤩", color: "#D6643C" },
  { key: "calm",    label: "Calm",     emoji: "😌", color: "#6FA38B" },
  { key: "grateful",label: "Grateful", emoji: "🙏", color: "#8A7CC0" },
  { key: "tired",   label: "Tired",    emoji: "😴", color: "#9A8C7A" },
  { key: "meh",     label: "Meh",      emoji: "😐", color: "#B0A99B" },
  { key: "sad",     label: "Sad",      emoji: "😢", color: "#5C7FA3" },
  { key: "anxious", label: "Anxious",  emoji: "😰", color: "#7E8AA0" },
  { key: "angry",   label: "Upset",    emoji: "😠", color: "#A8443A" },
];
const moodOf = (k) => MOODS.find((m) => m.key === k);

/* ---------------- date helpers ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const prettyDate = (s) => { const d = parseYmd(s); return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const monthKey = (s) => s.slice(0, 7);

/* ---------------- storage helpers ---------------- */
const S = {
  async getJSON(key, shared) {
    try { const r = await window.storage.get(key, shared); return r?.value ? JSON.parse(r.value) : null; }
    catch { return null; }
  },
  async setJSON(key, val, shared) {
    try { await window.storage.set(key, JSON.stringify(val), shared); return true; }
    catch (e) { console.error("save failed", e); return false; }
  },
  async del(key, shared) { try { await window.storage.delete(key, shared); } catch {} },
  async listKeys(prefix, shared) {
    try {
      const r = await window.storage.list(prefix, shared);
      const ks = r?.keys || [];
      return ks.map((k) => (typeof k === "string" ? k : k.key)).filter(Boolean);
    } catch { return []; }
  },
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/* ================================================= */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);      // {name1,name2,start,currency}
  const [me, setMe] = useState(null);                // "name1" | "name2"
  const [entries, setEntries] = useState([]);        // shared journal entries
  const [career, setCareer] = useState([]);          // shared career items
  const [letters, setLetters] = useState([]);        // love notes
  const [bucket, setBucket] = useState([]);          // bucket list
  const [sdays, setSdays] = useState([]);            // special days
  const [view, setView] = useState("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(todayStr());
  const [editing, setEditing] = useState(null);      // entry being added/edited
  const [showSettings, setShowSettings] = useState(false);

  /* ---- initial load ---- */
  useEffect(() => {
    (async () => {
      const prof = await S.getJSON("couple:profile", true);
      const id = await S.getJSON("me:identity", false);
      if (prof) setProfile(prof);
      if (id) setMe(id);
      await reload();
      setLoading(false);
    })();
  }, []);

  async function reload() {
    const eKeys = await S.listKeys("entry:", true);
    const es = [];
    for (const k of eKeys) { const v = await S.getJSON(k, true); if (v) es.push(v); }
    es.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
    setEntries(es);
    const cKeys = await S.listKeys("career:", true);
    const cs = [];
    for (const k of cKeys) { const v = await S.getJSON(k, true); if (v) cs.push(v); }
    cs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setCareer(cs);
    setLetters(await loadList("letter:"));
    setBucket(await loadList("bucket:"));
    setSdays(await loadList("sday:"));
  }
  async function loadList(prefix) {
    const keys = await S.listKeys(prefix, true);
    const arr = [];
    for (const k of keys) { const v = await S.getJSON(k, true); if (v) arr.push(v); }
    arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return arr;
  }

  const nameOf = (slot) => (slot === "name1" ? profile?.name1 : profile?.name2) || (slot === "name1" ? "You" : "Love");
  const other = me === "name1" ? "name2" : "name1";
  const cur = profile?.currency || "$";

  /* ---- save / delete entry ---- */
  async function saveEntry(entry) {
    const id = entry.id || uid();
    const full = { ...entry, id, createdAt: entry.createdAt || Date.now() };
    await S.setJSON(`entry:${id}`, full, true);
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id).concat(full);
      next.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
      return next;
    });
    setEditing(null);
  }
  async function deleteEntry(id) {
    await S.del(`entry:${id}`, true);
    setEntries((p) => p.filter((e) => e.id !== id));
  }

  /* ---- career ---- */
  async function saveCareer(item) {
    const id = item.id || uid();
    const full = { ...item, id, createdAt: item.createdAt || Date.now() };
    await S.setJSON(`career:${id}`, full, true);
    setCareer((p) => { const n = p.filter((x) => x.id !== id).concat(full); n.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return n; });
  }
  async function deleteCareer(id) { await S.del(`career:${id}`, true); setCareer((p) => p.filter((x) => x.id !== id)); }

  /* ---- generic save/delete for letters, bucket, special days ---- */
  function makeSaver(prefix, setter) {
    return async (item) => {
      const id = item.id || uid();
      const full = { ...item, id, createdAt: item.createdAt || Date.now() };
      await S.setJSON(`${prefix}${id}`, full, true);
      setter((p) => { const n = p.filter((x) => x.id !== id).concat(full); n.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return n; });
    };
  }
  function makeDeleter(prefix, setter) {
    return async (id) => { await S.del(`${prefix}${id}`, true); setter((p) => p.filter((x) => x.id !== id)); };
  }
  const saveLetter = makeSaver("letter:", setLetters);
  const deleteLetter = makeDeleter("letter:", setLetters);
  const saveBucket = makeSaver("bucket:", setBucket);
  const deleteBucket = makeDeleter("bucket:", setBucket);
  const saveSday = makeSaver("sday:", setSdays);
  const deleteSday = makeDeleter("sday:", setSdays);

  /* ---- export / reset ---- */
  function exportData() {
    const blob = new Blob([JSON.stringify({ profile, entries, career, letters, bucket, sdays, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `our-story-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  async function resetAll() {
    for (const e of entries) await S.del(`entry:${e.id}`, true);
    for (const c of career) await S.del(`career:${c.id}`, true);
    for (const l of letters) await S.del(`letter:${l.id}`, true);
    for (const b of bucket) await S.del(`bucket:${b.id}`, true);
    for (const d of sdays) await S.del(`sday:${d.id}`, true);
    setEntries([]); setCareer([]); setLetters([]); setBucket([]); setSdays([]);
  }

  /* ---------- loading ---------- */
  if (loading) return <Shell><div style={{ padding: 60, textAlign: "center", color: C.wine, fontFamily: "Newsreader, serif" }}><Heart size={28} style={{ marginBottom: 10 }} /><div>Opening your story…</div></div></Shell>;

  /* ---------- onboarding ---------- */
  if (!profile) return <Shell><Onboarding onDone={async (p) => { await S.setJSON("couple:profile", p, true); await S.setJSON("me:identity", "name1", false); setProfile(p); setMe("name1"); }} /></Shell>;
  if (!me) return <Shell><PickMe profile={profile} onPick={async (slot) => { await S.setJSON("me:identity", slot, false); setMe(slot); }} /></Shell>;

  /* ---------- partner's latest mood ---------- */
  const partnerLatest = entries.filter((e) => e.author === other && e.mood).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const pm = partnerLatest ? moodOf(partnerLatest.mood) : null;

  const dayCount = profile.start ? Math.max(1, Math.round((new Date() - parseYmd(profile.start)) / 86400000) + 1) : null;

  return (
    <Shell>
      {/* header */}
      <div style={{ position: "relative", padding: "26px 22px 18px", textAlign: "center", borderBottom: `1px solid ${C.paper2}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Heart size={20} color={C.rose} fill={C.rose} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 30, color: C.wine, margin: 0, letterSpacing: "-0.5px" }}>
            {nameOf("name1")} <span style={{ color: C.gold, fontStyle: "italic" }}>&amp;</span> {nameOf("name2")}
          </h1>
          <Heart size={20} color={C.rose} fill={C.rose} />
        </div>
        <div style={{ fontFamily: "Newsreader, serif", fontStyle: "italic", color: C.roseSoft, marginTop: 4, fontSize: 14 }}>
          {dayCount ? `Day ${dayCount} of us · ` : ""}our shared story
        </div>

        <button onClick={() => setShowSettings(true)} title="Settings"
          style={iconBtn(C.wine)} className="hover-lift">
          <Settings size={18} />
        </button>

        {/* who am I + partner mood */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={async () => { await S.setJSON("me:identity", other, false); setMe(other); }}
            className="hover-lift"
            style={{ ...chip(), background: "#fff", border: `1px solid ${C.paper2}`, cursor: "pointer", color: C.ink }}>
            Writing as <b style={{ color: C.rose, marginLeft: 4 }}>{nameOf(me)}</b> · tap to switch
          </button>
          {pm && (
            <span style={{ ...chip(), background: pm.color + "22", color: pm.color, border: `1px solid ${pm.color}55` }}>
              {nameOf(other)} felt {pm.emoji} {pm.label}
            </span>
          )}
        </div>
      </div>

      {/* nav */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "12px 10px", flexWrap: "wrap" }}>
        {[
          ["calendar", "Calendar", CalIcon],
          ["memories", "Memories", BookOpen],
          ["letters", "Letters", Heart],
          ["bucket", "Bucket List", Star],
          ["dates", "Special Days", Sun],
          ["career", "Career", Briefcase],
          ["money", "Money", Wallet],
        ].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setView(k)} className="hover-lift"
            style={{
              ...navBtn(), color: view === k ? "#fff" : C.wine,
              background: view === k ? C.rose : "transparent",
              boxShadow: view === k ? "0 6px 14px rgba(181,97,79,0.3)" : "none",
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "4px 16px 90px" }}>
        {view === "calendar" && (
          <CalendarView
            cursor={cursor} setCursor={setCursor} entries={entries}
            selected={selected} setSelected={setSelected}
            nameOf={nameOf} onAdd={(date) => setEditing({ date, author: me, mood: "", work: "", personal: "", story: "", money: [] })}
            onEdit={(e) => setEditing(e)} onDelete={deleteEntry} cur={cur}
          />
        )}
        {view === "memories" && <Memories entries={entries} nameOf={nameOf} onEdit={setEditing} onDelete={deleteEntry} cur={cur} />}
        {view === "letters" && <Letters letters={letters} me={me} other={other} nameOf={nameOf} onSave={saveLetter} onDelete={deleteLetter} />}
        {view === "bucket" && <Bucket bucket={bucket} me={me} nameOf={nameOf} onSave={saveBucket} onDelete={deleteBucket} />}
        {view === "dates" && <SpecialDays sdays={sdays} onSave={saveSday} onDelete={deleteSday} />}
        {view === "career" && <Career career={career} me={me} nameOf={nameOf} onSave={saveCareer} onDelete={deleteCareer} />}
        {view === "money" && <Money entries={entries} nameOf={nameOf} cur={cur} />}
      </div>

      {/* floating add */}
      {(view === "calendar" || view === "memories") && (
        <button onClick={() => setEditing({ date: view === "calendar" ? selected : todayStr(), author: me, mood: "", work: "", personal: "", story: "", money: [] })}
          className="hover-lift"
          style={{ position: "fixed", right: 22, bottom: 24, width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", background: C.rose, color: "#fff", boxShadow: "0 10px 24px rgba(181,97,79,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={26} />
        </button>
      )}

      {editing && <EntryModal value={editing} nameOf={nameOf} cur={cur} onClose={() => setEditing(null)} onSave={saveEntry} onDelete={editing.id ? () => { deleteEntry(editing.id); setEditing(null); } : null} />}
      {showSettings && <SettingsModal profile={profile} me={me} nameOf={nameOf} onClose={() => setShowSettings(false)}
        onSave={async (p) => { await S.setJSON("couple:profile", p, true); setProfile(p); }}
        onExport={exportData} onReset={resetAll} />}
    </Shell>
  );
}

/* ================= shell + fonts ================= */
function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 80% at 50% -10%, ${C.paper2} 0%, ${C.paper} 55%)`, padding: "18px 10px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Newsreader:ital,wght@0,400;0,500;1,400&display=swap');
        *{box-sizing:border-box;}
        body{margin:0;}
        ::-webkit-scrollbar{width:9px;height:9px;}
        ::-webkit-scrollbar-thumb{background:${C.roseSoft}66;border-radius:9px;}
        .hover-lift{transition:transform .15s ease, box-shadow .15s ease, background .15s ease;}
        .hover-lift:hover{transform:translateY(-1px);}
        .card-in{animation:cardIn .35s ease both;}
        @keyframes cardIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
        textarea,input,select{font-family:'Newsreader',serif;}
        textarea:focus,input:focus,select:focus{outline:none;border-color:${C.rose}!important;}
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(2px)", borderRadius: 22, border: `1px solid ${C.paper2}`, boxShadow: "0 24px 60px rgba(110,59,78,0.14)", overflow: "hidden", fontFamily: "Newsreader, serif", color: C.ink }}>
        {children}
      </div>
    </div>
  );
}

/* ================= onboarding ================= */
function Onboarding({ onDone }) {
  const [n1, setN1] = useState(""); const [n2, setN2] = useState("");
  const [start, setStart] = useState(""); const [currency, setCurrency] = useState("$");
  return (
    <div style={{ padding: "44px 28px", textAlign: "center" }}>
      <Heart size={34} color={C.rose} fill={C.rose} />
      <h1 style={{ fontFamily: "Fraunces, serif", color: C.wine, fontSize: 32, margin: "10px 0 4px" }}>Begin our story</h1>
      <p style={{ fontStyle: "italic", color: C.roseSoft, marginTop: 0 }}>A private little world for the two of you.</p>
      <div style={{ maxWidth: 340, margin: "22px auto", textAlign: "left", display: "grid", gap: 12 }}>
        <Field label="Your name"><input style={inp()} value={n1} onChange={(e) => setN1(e.target.value)} placeholder="e.g. Sara" /></Field>
        <Field label="Their name"><input style={inp()} value={n2} onChange={(e) => setN2(e.target.value)} placeholder="e.g. Adam" /></Field>
        <Field label="The day it began (optional)"><input type="date" style={inp()} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Currency"><input style={inp()} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="$" /></Field>
      </div>
      <button disabled={!n1.trim() || !n2.trim()} className="hover-lift"
        onClick={() => onDone({ name1: n1.trim(), name2: n2.trim(), start: start || null, currency: currency.trim() || "$" })}
        style={{ ...primaryBtn(), opacity: n1.trim() && n2.trim() ? 1 : 0.5 }}>
        <Sparkles size={16} /> Start writing together
      </button>
    </div>
  );
}
function PickMe({ profile, onPick }) {
  return (
    <div style={{ padding: "54px 28px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "Fraunces, serif", color: C.wine }}>Who's writing?</h2>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 18 }}>
        {["name1", "name2"].map((s) => (
          <button key={s} className="hover-lift" onClick={() => onPick(s)}
            style={{ ...primaryBtn(), background: s === "name1" ? C.rose : C.wine }}>
            {s === "name1" ? profile.name1 : profile.name2}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= calendar ================= */
function CalendarView({ cursor, setCursor, entries, selected, setSelected, nameOf, onAdd, onEdit, onDelete, cur }) {
  const { y, m } = cursor;
  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const byDate = useMemo(() => {
    const map = {};
    entries.forEach((e) => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }, [entries]);
  const dayEntries = byDate[selected] || [];

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const move = (delta) => { let nm = m + delta, ny = y; if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; } setCursor({ y: ny, m: nm }); };

  return (
    <div className="card-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 4px 14px" }}>
        <button onClick={() => move(-1)} className="hover-lift" style={iconBtnStatic(C.wine)}><ChevronLeft size={18} /></button>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.wine }}>{MONTHS[m]} {y}</div>
        <button onClick={() => move(1)} className="hover-lift" style={iconBtnStatic(C.wine)}><ChevronRight size={18} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, letterSpacing: 1, color: C.roseSoft, textTransform: "uppercase", paddingBottom: 4 }}>{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
          const es = byDate[ds] || [];
          const isSel = ds === selected;
          const isToday = ds === todayStr();
          const moods = [...new Set(es.map((e) => e.mood).filter(Boolean))].slice(0, 3);
          return (
            <button key={i} onClick={() => setSelected(ds)} className="hover-lift"
              style={{
                aspectRatio: "1", borderRadius: 12, cursor: "pointer", position: "relative",
                border: isToday ? `1.5px solid ${C.gold}` : `1px solid ${C.paper2}`,
                background: isSel ? C.rose : es.length ? "#fff" : "rgba(255,255,255,0.4)",
                color: isSel ? "#fff" : C.ink, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2, padding: 2,
              }}>
              <span style={{ fontSize: 13, fontWeight: es.length ? 600 : 400 }}>{d}</span>
              <span style={{ fontSize: 11, lineHeight: 1, height: 12 }}>{moods.map((mk) => moodOf(mk)?.emoji).join("")}</span>
            </button>
          );
        })}
      </div>

      {/* selected day */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "Fraunces, serif", color: C.wine, margin: 0, fontSize: 18 }}>{prettyDate(selected)}</h3>
          <button onClick={() => onAdd(selected)} className="hover-lift" style={{ ...smallBtn(), background: C.roseSoft, color: "#fff" }}><Plus size={14} /> Add</button>
        </div>
        {dayEntries.length === 0 && <p style={{ fontStyle: "italic", color: C.roseSoft, marginTop: 10 }}>Nothing written yet for this day. Capture a moment 💌</p>}
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {dayEntries.map((e) => <EntryCard key={e.id} e={e} nameOf={nameOf} onEdit={onEdit} onDelete={onDelete} cur={cur} />)}
        </div>
      </div>
    </div>
  );
}

/* ================= entry card ================= */
function EntryCard({ e, nameOf, onEdit, onDelete, cur }) {
  const m = moodOf(e.mood);
  const spent = (e.money || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const authorColor = e.author === "name1" ? C.rose : C.wine;
  return (
    <div className="card-in" style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.paper2}`, borderLeft: `4px solid ${authorColor}`, padding: 16, boxShadow: "0 6px 16px rgba(110,59,78,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ ...chip(), background: authorColor + "1a", color: authorColor }}>{nameOf(e.author)}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {m && <span style={{ ...chip(), background: m.color + "22", color: m.color }}>{m.emoji} {m.label}</span>}
          <button onClick={() => onEdit(e)} style={ghostIcon()} title="Edit"><Pencil size={14} /></button>
          <button onClick={() => { if (confirm("Delete this entry?")) onDelete(e.id); }} style={ghostIcon()} title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
      {e.work && <Section icon={<Briefcase size={13} />} label="At work" text={e.work} />}
      {e.personal && <Section icon={<Heart size={13} />} label="Personal life" text={e.personal} />}
      {e.story && <Section icon={<BookOpen size={13} />} label="Our story / note" text={e.story} italic />}
      {spent > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.paper2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.gold, fontSize: 13, fontWeight: 600 }}><Wallet size={13} /> Spent {cur}{spent.toFixed(2)}</div>
          <div style={{ fontSize: 13, color: C.ink, marginTop: 2 }}>{(e.money || []).filter((x) => x.desc || x.amount).map((x, i) => <span key={i} style={{ marginRight: 10 }}>{x.desc || "item"} · {cur}{Number(x.amount || 0).toFixed(2)}</span>)}</div>
        </div>
      )}
    </div>
  );
}
function Section({ icon, label, text, italic }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.roseSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{icon} {label}</div>
      <div style={{ fontSize: 15, lineHeight: 1.5, marginTop: 2, fontStyle: italic ? "italic" : "normal", whiteSpace: "pre-wrap" }}>{text}</div>
    </div>
  );
}

/* ================= memories feed ================= */
function Memories({ entries, nameOf, onEdit, onDelete, cur }) {
  const [filter, setFilter] = useState("all");
  const filtered = entries.filter((e) => filter === "all" || e.author === filter);
  return (
    <div className="card-in">
      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0 16px" }}>
        {[["all", "Everything"], ["name1", nameOf("name1")], ["name2", nameOf("name2")]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="hover-lift"
            style={{ ...smallBtn(), background: filter === k ? C.wine : "#fff", color: filter === k ? "#fff" : C.wine, border: `1px solid ${C.paper2}` }}>{l}</button>
        ))}
      </div>
      {filtered.length === 0 && <p style={{ textAlign: "center", fontStyle: "italic", color: C.roseSoft }}>Your memory book is waiting for its first page 🌷</p>}
      <div style={{ display: "grid", gap: 14 }}>
        {filtered.map((e) => (
          <div key={e.id}>
            <div style={{ fontFamily: "Fraunces, serif", color: C.wine, fontSize: 14, marginBottom: 5 }}>{prettyDate(e.date)}</div>
            <EntryCard e={e} nameOf={nameOf} onEdit={onEdit} onDelete={onDelete} cur={cur} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= career ================= */
const STAGES = [["dream", "Dreaming", "#8A7CC0"], ["progress", "In progress", "#E0913B"], ["done", "Achieved", "#6FA38B"]];
function Career({ career, me, nameOf, onSave, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(""); const [note, setNote] = useState("");
  const submit = () => { if (!title.trim()) return; onSave({ author: me, title: title.trim(), note: note.trim(), stage: "dream" }); setTitle(""); setNote(""); setAdding(false); };
  return (
    <div className="card-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 4px 14px" }}>
        <h3 style={{ fontFamily: "Fraunces, serif", color: C.wine, margin: 0 }}>Career & dreams</h3>
        <button onClick={() => setAdding((v) => !v)} className="hover-lift" style={{ ...smallBtn(), background: C.rose, color: "#fff" }}><Plus size={14} /> Goal</button>
      </div>
      {adding && (
        <div style={{ background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <input style={inp()} placeholder="e.g. Get the promotion / Start the course" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea style={{ ...inp(), marginTop: 8, minHeight: 60 }} placeholder="Why it matters, next steps…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={submit} style={{ ...smallBtn(), background: C.rose, color: "#fff" }}><Check size={14} /> Save</button>
            <button onClick={() => setAdding(false)} style={{ ...smallBtn(), background: "#fff", border: `1px solid ${C.paper2}`, color: C.ink }}>Cancel</button>
          </div>
        </div>
      )}
      {STAGES.map(([sk, sl, sc]) => {
        const items = career.filter((c) => c.stage === sk);
        if (!items.length) return null;
        return (
          <div key={sk} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: sc, fontWeight: 600, fontSize: 13, marginBottom: 6 }}><Star size={13} fill={sc} /> {sl}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((c) => {
                const ac = c.author === "name1" ? C.rose : C.wine;
                return (
                  <div key={c.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.paper2}`, borderLeft: `4px solid ${ac}`, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: C.ink, fontSize: 16 }}>{c.title}</div>
                        {c.note && <div style={{ fontSize: 14, color: C.ink, marginTop: 3, whiteSpace: "pre-wrap" }}>{c.note}</div>}
                        <span style={{ ...chip(), background: ac + "1a", color: ac, marginTop: 6, display: "inline-block" }}>{nameOf(c.author)}</span>
                      </div>
                      <button onClick={() => { if (confirm("Delete goal?")) onDelete(c.id); }} style={ghostIcon()}><Trash2 size={14} /></button>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      {STAGES.map(([k, l, col]) => (
                        <button key={k} onClick={() => onSave({ ...c, stage: k })}
                          style={{ ...smallBtn(), padding: "4px 10px", fontSize: 12, background: c.stage === k ? col : "#fff", color: c.stage === k ? "#fff" : col, border: `1px solid ${col}` }}>{l}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {career.length === 0 && !adding && <p style={{ textAlign: "center", fontStyle: "italic", color: C.roseSoft }}>Add the dreams you're chasing together 💫</p>}
    </div>
  );
}

/* ================= money ================= */
function Money({ entries, nameOf, cur }) {
  const expenses = [];
  entries.forEach((e) => (e.money || []).forEach((x) => { const amt = Number(x.amount) || 0; if (amt > 0) expenses.push({ ...x, amount: amt, date: e.date, author: e.author }); }));
  const total = expenses.reduce((s, x) => s + x.amount, 0);
  const byPerson = { name1: 0, name2: 0 };
  expenses.forEach((x) => { byPerson[x.author] = (byPerson[x.author] || 0) + x.amount; });
  const byMonth = {};
  expenses.forEach((x) => { const k = monthKey(x.date); byMonth[k] = (byMonth[k] || 0) + x.amount; });
  const chartData = Object.keys(byMonth).sort().slice(-6).map((k) => { const [yy, mm] = k.split("-"); return { name: `${MONTHS[+mm - 1].slice(0, 3)} '${yy.slice(2)}`, value: +byMonth[k].toFixed(2) }; });
  const recent = expenses.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

  return (
    <div className="card-in">
      <div style={{ background: `linear-gradient(135deg, ${C.wine}, ${C.rose})`, borderRadius: 18, padding: "20px 18px", color: "#fff", marginTop: 8, boxShadow: "0 12px 26px rgba(110,59,78,0.3)" }}>
        <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: 1, textTransform: "uppercase" }}>Spent together</div>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 38, fontWeight: 600 }}>{cur}{total.toFixed(2)}</div>
        <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 14 }}>
          <span>{nameOf("name1")}: {cur}{(byPerson.name1 || 0).toFixed(2)}</span>
          <span>{nameOf("name2")}: {cur}{(byPerson.name2 || 0).toFixed(2)}</span>
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.paper2}`, padding: 14, marginTop: 14 }}>
          <div style={{ fontFamily: "Fraunces, serif", color: C.wine, marginBottom: 8 }}>Monthly spending</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(v) => `${cur}${v}`} contentStyle={{ borderRadius: 10, border: `1px solid ${C.paper2}`, fontFamily: "Newsreader, serif" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? C.rose : C.roseSoft} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.wine, marginBottom: 8 }}>Recent expenses</div>
        {recent.length === 0 && <p style={{ fontStyle: "italic", color: C.roseSoft }}>No spending logged yet. Add amounts inside a daily entry.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {recent.map((x, i) => {
            const ac = x.author === "name1" ? C.rose : C.wine;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 12, padding: "10px 14px" }}>
                <div><div style={{ fontWeight: 600 }}>{x.desc || "Expense"}</div><div style={{ fontSize: 12, color: C.roseSoft }}>{prettyDate(x.date)} · <span style={{ color: ac }}>{nameOf(x.author)}</span></div></div>
                <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: C.gold }}>{cur}{x.amount.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================= entry modal ================= */
function EntryModal({ value, nameOf, cur, onClose, onSave, onDelete }) {
  const [v, setV] = useState({ ...value, money: value.money?.length ? value.money : [] });
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const setMoney = (i, k, val) => setV((p) => { const m = [...p.money]; m[i] = { ...m[i], [k]: val }; return { ...p, money: m }; });
  const addMoney = () => setV((p) => ({ ...p, money: [...p.money, { desc: "", amount: "" }] }));
  const rmMoney = (i) => setV((p) => ({ ...p, money: p.money.filter((_, idx) => idx !== i) }));
  const valid = v.mood || v.work || v.personal || v.story || v.money.some((x) => x.amount);

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontFamily: "Fraunces, serif", color: C.wine, margin: 0 }}>{value.id ? "Edit" : "New"} entry</h3>
        <button onClick={onClose} style={ghostIcon()}><X size={18} /></button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Field label="Date" tiny><input type="date" style={inp()} value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Who" tiny>
          <div style={{ display: "flex", gap: 6 }}>
            {["name1", "name2"].map((s) => (
              <button key={s} onClick={() => set("author", s)} style={{ ...smallBtn(), background: v.author === s ? C.rose : "#fff", color: v.author === s ? "#fff" : C.wine, border: `1px solid ${C.paper2}` }}>{nameOf(s)}</button>
            ))}
          </div>
        </Field>
      </div>

      <Label>Mood</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {MOODS.map((m) => (
          <button key={m.key} onClick={() => set("mood", v.mood === m.key ? "" : m.key)} className="hover-lift"
            style={{ borderRadius: 12, padding: "6px 10px", cursor: "pointer", fontSize: 13, border: `1px solid ${v.mood === m.key ? m.color : C.paper2}`, background: v.mood === m.key ? m.color + "22" : "#fff", color: v.mood === m.key ? m.color : C.ink, fontFamily: "Newsreader, serif" }}>
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <Label><Briefcase size={12} /> At work today</Label>
      <textarea style={{ ...inp(), minHeight: 56 }} value={v.work} onChange={(e) => set("work", e.target.value)} placeholder="Meetings, wins, struggles…" />
      <div style={{ height: 12 }} />
      <Label><Heart size={12} /> Personal life</Label>
      <textarea style={{ ...inp(), minHeight: 56 }} value={v.personal} onChange={(e) => set("personal", e.target.value)} placeholder="What happened, how the day felt…" />
      <div style={{ height: 12 }} />
      <Label><BookOpen size={12} /> Our story / a note to remember</Label>
      <textarea style={{ ...inp(), minHeight: 70 }} value={v.story} onChange={(e) => set("story", e.target.value)} placeholder="Happy moments, hard moments, a message to your love…" />

      <div style={{ height: 14 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Label><Wallet size={12} /> Money spent</Label>
        <button onClick={addMoney} style={{ ...smallBtn(), background: C.gold, color: "#fff" }}><Plus size={13} /> Item</button>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
        {v.money.map((x, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inp(), flex: 1 }} placeholder="What for" value={x.desc} onChange={(e) => setMoney(i, "desc", e.target.value)} />
            <input style={{ ...inp(), width: 90 }} type="number" placeholder={`${cur}0`} value={x.amount} onChange={(e) => setMoney(i, "amount", e.target.value)} />
            <button onClick={() => rmMoney(i)} style={ghostIcon()}><X size={16} /></button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button disabled={!valid} onClick={() => onSave(v)} className="hover-lift" style={{ ...primaryBtn(), flex: 1, opacity: valid ? 1 : 0.5 }}><Check size={16} /> Save</button>
        {onDelete && <button onClick={() => { if (confirm("Delete this entry?")) onDelete(); }} style={{ ...smallBtn(), background: "#fff", border: `1px solid ${C.rose}`, color: C.rose }}><Trash2 size={15} /></button>}
      </div>
    </Overlay>
  );
}

/* ================= settings ================= */
function SettingsModal({ profile, onClose, onSave, onExport, onReset }) {
  const [p, setP] = useState({ ...profile });
  const fileRef = useRef();
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontFamily: "Fraunces, serif", color: C.wine, margin: 0 }}>Settings</h3>
        <button onClick={onClose} style={ghostIcon()}><X size={18} /></button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <Field label="Your name"><input style={inp()} value={p.name1} onChange={(e) => setP({ ...p, name1: e.target.value })} /></Field>
        <Field label="Their name"><input style={inp()} value={p.name2} onChange={(e) => setP({ ...p, name2: e.target.value })} /></Field>
        <Field label="The day it began"><input type="date" style={inp()} value={p.start || ""} onChange={(e) => setP({ ...p, start: e.target.value })} /></Field>
        <Field label="Currency"><input style={inp()} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value })} /></Field>
      </div>
      <button onClick={() => { onSave(p); onClose(); }} className="hover-lift" style={{ ...primaryBtn(), width: "100%", marginTop: 14 }}><Check size={16} /> Save settings</button>
      <div style={{ borderTop: `1px dashed ${C.paper2}`, margin: "18px 0 12px" }} />
      <button onClick={onExport} className="hover-lift" style={{ ...smallBtn(), width: "100%", background: "#fff", border: `1px solid ${C.paper2}`, color: C.wine, justifyContent: "center" }}><Download size={15} /> Back up our story (download)</button>
      <button onClick={() => { if (confirm("Erase ALL entries and goals? This cannot be undone.")) { onReset(); onClose(); } }} style={{ ...smallBtn(), width: "100%", marginTop: 8, background: "#fff", border: `1px solid ${C.rose}`, color: C.rose, justifyContent: "center" }}><Trash2 size={15} /> Reset everything</button>
      <p style={{ fontSize: 12, color: C.roseSoft, fontStyle: "italic", marginTop: 12 }}>Your entries are saved and shared between you both. Keep this artifact private — anyone you share its link with could see these pages.</p>
    </Overlay>
  );
}

/* ================= letters ================= */
function Letters({ letters, me, other, nameOf, onSave, onDelete }) {
  const [text, setText] = useState("");
  const send = () => { if (!text.trim()) return; onSave({ from: me, to: other, text: text.trim(), date: todayStr() }); setText(""); };
  return (
    <div className="card-in">
      <div style={{ background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 16, padding: 14, marginTop: 8 }}>
        <Label><Heart size={12} /> A note to {nameOf(other)}</Label>
        <textarea style={{ ...inp(), minHeight: 70 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write something they'll find later…" />
        <button onClick={send} disabled={!text.trim()} className="hover-lift" style={{ ...primaryBtn(), marginTop: 10, opacity: text.trim() ? 1 : 0.5 }}><Heart size={15} /> Leave it for them</button>
      </div>
      {letters.length === 0 && <p style={{ textAlign: "center", fontStyle: "italic", color: C.roseSoft, marginTop: 16 }}>No letters yet. Be the first to say something sweet 💕</p>}
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {letters.map((l) => {
          const fc = l.from === "name1" ? C.rose : C.wine;
          const mine = l.from === me;
          return (
            <div key={l.id} className="card-in" style={{ background: mine ? "#fff" : C.paper2 + "55", border: `1px solid ${C.paper2}`, borderRadius: 16, borderLeft: `4px solid ${fc}`, padding: 16, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ ...chip(), background: fc + "1a", color: fc }}>{nameOf(l.from)} → {nameOf(l.to)}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.roseSoft }}>{prettyDate(l.date)}</span>
                  {mine && <button onClick={() => { if (confirm("Delete this note?")) onDelete(l.id); }} style={ghostIcon()}><Trash2 size={13} /></button>}
                </div>
              </div>
              <div style={{ fontFamily: "Newsreader, serif", fontSize: 16, lineHeight: 1.55, fontStyle: "italic", whiteSpace: "pre-wrap" }}>“{l.text}”</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= bucket list ================= */
function Bucket({ bucket, me, nameOf, onSave, onDelete }) {
  const [text, setText] = useState("");
  const add = () => { if (!text.trim()) return; onSave({ text: text.trim(), by: me, done: false }); setText(""); };
  const toggle = (b) => onSave({ ...b, done: !b.done, doneDate: !b.done ? todayStr() : null });
  const sorted = [...bucket].sort((a, b) => (a.done === b.done ? (b.createdAt || 0) - (a.createdAt || 0) : a.done ? 1 : -1));
  const doneCount = bucket.filter((b) => b.done).length;
  return (
    <div className="card-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 4px 12px" }}>
        <h3 style={{ fontFamily: "Fraunces, serif", color: C.wine, margin: 0 }}>Things to do together</h3>
        {bucket.length > 0 && <span style={{ ...chip(), background: C.gold + "22", color: C.gold }}>{doneCount}/{bucket.length} done</span>}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...inp(), flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Watch the sunrise in the mountains" />
        <button onClick={add} className="hover-lift" style={{ ...smallBtn(), background: C.rose, color: "#fff" }}><Plus size={15} /></button>
      </div>
      {bucket.length === 0 && <p style={{ textAlign: "center", fontStyle: "italic", color: C.roseSoft }}>Dream up your first adventure together ✨</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {sorted.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 14, padding: "12px 14px", opacity: b.done ? 0.7 : 1 }}>
            <button onClick={() => toggle(b)} className="hover-lift" style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${b.done ? C.gold : C.roseSoft}`, background: b.done ? C.gold : "transparent", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{b.done && <Check size={15} />}</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, textDecoration: b.done ? "line-through" : "none", color: C.ink }}>{b.text}</div>
              <div style={{ fontSize: 12, color: C.roseSoft }}>{b.done && b.doneDate ? `Done ${prettyDate(b.doneDate)}` : `Added by ${nameOf(b.by)}`}</div>
            </div>
            <button onClick={() => { if (confirm("Remove this?")) onDelete(b.id); }} style={ghostIcon()}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= special days ================= */
function nextOccurrence(dateStr) {
  const d = parseYmd(dateStr);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < now) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  const days = Math.round((next - now) / 86400000);
  let years = next.getFullYear() - d.getFullYear();
  return { days, next, years };
}
function SpecialDays({ sdays, onSave, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(""); const [date, setDate] = useState("");
  const submit = () => { if (!title.trim() || !date) return; onSave({ title: title.trim(), date }); setTitle(""); setDate(""); setAdding(false); };
  const withCountdown = sdays.map((s) => ({ ...s, ...nextOccurrence(s.date) })).sort((a, b) => a.days - b.days);
  return (
    <div className="card-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 4px 14px" }}>
        <h3 style={{ fontFamily: "Fraunces, serif", color: C.wine, margin: 0 }}>Days that matter</h3>
        <button onClick={() => setAdding((v) => !v)} className="hover-lift" style={{ ...smallBtn(), background: C.rose, color: "#fff" }}><Plus size={14} /> Date</button>
      </div>
      {adding && (
        <div style={{ background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <input style={inp()} placeholder="e.g. Our anniversary, their birthday" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="date" style={{ ...inp(), marginTop: 8 }} value={date} onChange={(e) => setDate(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={submit} style={{ ...smallBtn(), background: C.rose, color: "#fff" }}><Check size={14} /> Save</button>
            <button onClick={() => setAdding(false)} style={{ ...smallBtn(), background: "#fff", border: `1px solid ${C.paper2}`, color: C.ink }}>Cancel</button>
          </div>
        </div>
      )}
      {sdays.length === 0 && !adding && <p style={{ textAlign: "center", fontStyle: "italic", color: C.roseSoft }}>Add anniversaries and birthdays to count down to 🎀</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {withCountdown.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: s.days === 0 ? `linear-gradient(135deg, ${C.rose}, ${C.wine})` : "#fff", color: s.days === 0 ? "#fff" : C.ink, border: `1px solid ${C.paper2}`, borderRadius: 14, padding: "14px 16px" }}>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 17 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: s.days === 0 ? "#ffffffcc" : C.roseSoft }}>{MONTHS[parseYmd(s.date).getMonth()]} {parseYmd(s.date).getDate()}{s.years > 0 ? ` · turning ${s.years}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 22, color: s.days === 0 ? "#fff" : C.rose }}>{s.days === 0 ? "Today!" : s.days}</div>
                {s.days !== 0 && <div style={{ fontSize: 11, color: C.roseSoft }}>day{s.days === 1 ? "" : "s"} away</div>}
              </div>
              <button onClick={() => { if (confirm("Delete this date?")) onDelete(s.id); }} style={{ ...ghostIcon(), color: s.days === 0 ? "#fff" : C.roseSoft }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= primitives ================= */
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(62,42,46,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, zIndex: 50, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="card-in" style={{ background: C.paper, borderRadius: 20, border: `1px solid ${C.paper2}`, padding: 22, width: "100%", maxWidth: 480, margin: "24px 0", boxShadow: "0 30px 70px rgba(0,0,0,0.3)" }}>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children, tiny }) {
  return <label style={{ display: "block", flex: tiny ? "0 0 auto" : "1" }}><div style={{ fontSize: 12, color: C.roseSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>{children}</label>;
}
function Label({ children }) { return <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.roseSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>{children}</div>; }

const inp = () => ({ width: "100%", padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.paper2}`, background: "#fff", fontSize: 15, color: C.ink, fontFamily: "Newsreader, serif" });
const chip = () => ({ fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 600 });
const navBtn = () => ({ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "Newsreader, serif", fontSize: 14, fontWeight: 500 });
const smallBtn = () => ({ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "Newsreader, serif", fontSize: 13, fontWeight: 600 });
const primaryBtn = () => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 22px", borderRadius: 14, border: "none", cursor: "pointer", background: C.rose, color: "#fff", fontFamily: "Newsreader, serif", fontSize: 16, fontWeight: 600, boxShadow: "0 8px 20px rgba(181,97,79,0.35)" });
const ghostIcon = () => ({ background: "transparent", border: "none", cursor: "pointer", color: C.roseSoft, padding: 4, display: "flex", alignItems: "center" });
const iconBtn = (c) => ({ position: "absolute", top: 18, right: 18, background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 10, padding: 7, cursor: "pointer", color: c, display: "flex" });
const iconBtnStatic = (c) => ({ background: "#fff", border: `1px solid ${C.paper2}`, borderRadius: 10, padding: 7, cursor: "pointer", color: c, display: "flex" });
