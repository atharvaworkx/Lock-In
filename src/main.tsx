import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Topic = { id: string; title: string; done: boolean };
type Checklist = { id: string; name: string; topics: Topic[] };
type Store = { checklists: Checklist[]; activeId: string; points: number; minutes: number; water: number };

const starter: Store = { checklists: [], activeId: "", points: 0, minutes: 0, water: 0 };
const load = (): Store => {
  try {
    const saved = JSON.parse(localStorage.getItem("lockin-store") || "");
    if (!saved || saved.checklists?.some((list: Checklist) => list.id === "csharp")) return starter;
    return saved;
  } catch { return starter; }
};
const save = (data: Store) => localStorage.setItem("lockin-store", JSON.stringify(data));
const uid = () => Math.random().toString(36).slice(2);
const cleanTopic = (value: string) => value
  .replace(/^\s*\[[xX ]\]\s*/, "")
  .replace(/[^a-zA-Z0-9\s$@]/g, "")
  .replace(/\s+/g, " ")
  .trim();

function parseTopics(input: string): string[] {
  const normalized = input.replace(/\r/g, "").replace(/[•●▪◦]/g, "\n").replace(/\s*(\d{1,3})[.)]\s*/g, "\n");
  const lines = normalized.split("\n").map((line) => line.replace(/^[\s\-–—]+/, "").trim()).filter(Boolean);
  const output: string[] = [];
  const boundary = /\b(?:vs\.?|versus|default|parameterized|copy|single|multi(?:level)?|hierarchical|arithmetic|relational|logical|method|access|public|private|protected|try|catch|finally|throw|arraylist|list|dictionary|hashset)\b/i;
  for (const line of lines) {
    const words = line.split(/\s+/);
    if (words.length <= 6 || !boundary.test(line)) { output.push(line); continue; }
    let current: string[] = [];
    for (const word of words) {
      if (current.length >= 2 && boundary.test(word) && /^[A-Z]/.test(word)) { output.push(current.join(" ")); current = []; }
      current.push(word);
    }
    if (current.length) output.push(current.join(" "));
  }
  return [...new Set(output.map(cleanTopic).filter((topic) => topic.length > 1))];
}
const formatTime = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

function App() {
  const [store, setStore] = useState(load);
  const [view, setView] = useState<"dashboard" | "checklist" | "lockin" | "tree">("dashboard");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [modal, setModal] = useState<"import" | "new-list" | "new-topic" | "water" | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<string[] | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [newChecklist, setNewChecklist] = useState("");
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const checklist = store.checklists.find((item) => item.id === store.activeId) || store.checklists[0] || { id: "", name: "Your first checklist", topics: [] };
  const completed = checklist.topics.filter((topic) => topic.done).length;
  const percent = checklist.topics.length ? Math.round((completed / checklist.topics.length) * 100) : 0;
  const update = (next: Store) => { setStore(next); save(next); };

  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSessionSeconds((seconds) => seconds + 1), 1000); return () => clearInterval(timer); }, [running]);
  const visibleTopics = useMemo(() => checklist.topics.filter((topic) => topic.title.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "done" ? topic.done : !topic.done))), [checklist, query, filter]);
  const patchTopics = (topics: Topic[]) => {
    const storedChecklist = store.checklists.find((item) => item.id === store.activeId) || store.checklists[0];
    if (storedChecklist) {
      update({
        ...store,
        activeId: storedChecklist.id,
        checklists: store.checklists.map((item) => item.id === storedChecklist.id ? { ...item, topics } : item)
      });
      return;
    }

    const created = { id: uid(), name: "My study checklist", topics };
    update({ ...store, checklists: [created], activeId: created.id });
  };
  const toggleTopic = (id: string) => patchTopics(checklist.topics.map((topic) => topic.id === id ? { ...topic, done: !topic.done } : topic));
  const finishSession = () => { if (sessionSeconds) update({ ...store, minutes: store.minutes + Math.floor(sessionSeconds / 60), points: store.points + Math.floor(sessionSeconds / 60) * 2 }); setSessionSeconds(0); setRunning(false); setView("dashboard"); };
  const plantStage = store.water >= 30 ? "large tree" : store.water >= 15 ? "healthy plant" : store.water >= 6 ? "small plant" : store.water >= 2 ? "sprout" : "seed";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><span>LOCKIN</span></div>
      <p className="eyebrow">YOUR STUDY SPACE</p>
      <nav>
        <Nav icon="⌂" label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
        <Nav icon="▣" label="My Checklists" active={view === "checklist"} onClick={() => setView("checklist")} />
        <Nav icon="◷" label="Lockin Mode" active={view === "lockin"} onClick={() => setView("lockin")} />
        <Nav icon="♧" label="Study Tree" active={view === "tree"} onClick={() => setView("tree")} />
      </nav>
      <div className="sidebar-bottom"><div className="mini-tree">♧</div><small>Keep showing up.<br /><b>Your future self is watching.</b></small></div>
    </aside>
    <main className="main">
      <header><div><p className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase()}</p><h1>{view === "dashboard" ? `${new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}.` : view === "tree" ? "Your study tree." : view === "lockin" ? "Time to lock in." : checklist.name}</h1></div><div className="header-actions"><span className="streak">✦ Build your streak</span><button className="avatar">✦</button></div></header>
      {view === "dashboard" && <Dashboard checklist={checklist} completed={completed} percent={percent} store={store} onStart={() => setView("lockin")} onChecklist={() => setView("checklist")} onCreate={() => { setNewChecklist(""); setModal("new-list"); }} />}
      {view === "checklist" && <section className="content"><div className="section-title"><div><p className="eyebrow">ACTIVE CHECKLIST</p><h2>{checklist.name}</h2></div><div className="toolbar"><button className="button secondary" onClick={() => setModal("import")}>＋ Import topics</button><button className="button primary" onClick={() => { setNewTopic(""); setModal("new-topic"); }}>＋ Add topic</button></div></div><div className="progress-card"><div><strong>{percent}%</strong><span>{completed} of {checklist.topics.length} topics complete</span></div><div className="progress-track"><div style={{ width: `${percent}%` }} /></div></div><div className="list-tools"><div className="search">⌕<input placeholder="Search topics..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="filters">{(["all", "open", "done"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All topics" : item === "open" ? "In progress" : "Completed"}</button>)}</div></div><div className="topic-list">{visibleTopics.map((topic) => <div className={`topic ${topic.done ? "done" : ""}`} key={topic.id}><button className={`check ${topic.done ? "checked" : ""}`} onClick={() => toggleTopic(topic.id)}>{topic.done ? "✓" : ""}</button><span>{topic.title}</span><button className="delete" onClick={() => patchTopics(checklist.topics.filter((item) => item.id !== topic.id))}>×</button></div>)}{visibleTopics.length === 0 && <div className="empty"><b>No topics yet.</b><br />Add a topic or import your study material to get started.</div>}</div></section>}
      {view === "lockin" && <Lockin seconds={sessionSeconds} running={running} setRunning={setRunning} onFinish={finishSession} />}
      {view === "tree" && <Tree store={store} stage={plantStage} onWater={() => store.points >= 50 && update({ ...store, points: store.points - 50, water: store.water + 1 })} />}
    </main>
    {modal && <Modal type={modal} close={() => { setModal(null); setPreview(null); }} text={importText} setText={setImportText} preview={preview} parse={() => setPreview(parseTopics(importText))} add={() => { if (preview) patchTopics([...checklist.topics, ...preview.map((title) => ({ id: uid(), title, done: false }))]); setModal(null); setPreview(null); setImportText(""); }} topic={newTopic} setTopic={setNewTopic} addTopic={() => { const title = cleanTopic(newTopic); if (title) patchTopics([...checklist.topics, { id: uid(), title, done: false }]); setModal(null); }} checklistName={newChecklist} setChecklistName={setNewChecklist} addChecklist={() => { const name = newChecklist.trim(); if (!name) return; const created = { id: uid(), name, topics: [] }; update({ ...store, checklists: [...store.checklists, created], activeId: created.id }); setModal(null); setView("checklist"); }} />}
  </div>;
}

function Nav({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span>{icon}</span>{label}{active && <i />}</button>; }
function Dashboard({ checklist, completed, percent, store, onStart, onChecklist, onCreate }: { checklist: Checklist; completed: number; percent: number; store: Store; onStart: () => void; onChecklist: () => void; onCreate: () => void }) { return <section className="content dashboard"><div className="hero-card"><div><p className="eyebrow">CURRENT FOCUS</p><h2>{checklist.name}</h2><p className="muted">{checklist.topics.length ? "Small steps every day add up to something huge." : "Create your first checklist and make your next step visible."}</p><div className="hero-progress"><div className="progress-track"><div style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div><span className="muted">{completed} completed · {checklist.topics.length - completed} remaining</span></div><div className="hero-orb">✦</div></div><div className="stat-grid"><Stat label="Topics completed" value={`${completed}`} sub={`of ${checklist.topics.length} total`} icon="✓" /><Stat label="Lockin time" value={formatTime(store.minutes)} sub="all time" icon="◷" /><Stat label="Study points" value={store.points.toLocaleString()} sub="keep growing" icon="✦" /></div><div className="dashboard-grid"><div className="panel recent"><div className="panel-head"><div><p className="eyebrow">UP NEXT</p><h3>Keep the momentum</h3></div><button className="text-button" onClick={onChecklist}>View all →</button></div>{checklist.topics.filter((topic) => !topic.done).slice(0, 4).map((topic) => <div className="recent-item" key={topic.id}><span className="open-dot" />{topic.title}<span>›</span></div>)}{!checklist.topics.length && <div className="empty compact">Your checklist is ready for its first topic.</div>}<button className="button primary wide" onClick={checklist.topics.length ? onStart : onCreate}>{checklist.topics.length ? "◷ Start a Lockin session" : "＋ Create a checklist"}</button></div><div className="panel tree-preview"><div className="panel-head"><div><p className="eyebrow">YOUR PROGRESS GARDEN</p><h3>Growing one session at a time</h3></div><span className="plant-icon">♧</span></div><div className="plant-art small">♧</div><div className="tree-meta"><span>Stage: <b>{store.water >= 6 ? "Growing" : "Seed"}</b></span><span>{store.water} waters</span></div></div></div></section>; }
function Stat({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: string }) { return <div className="stat"><span className="stat-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{sub}</small></div>; }
function Lockin({ seconds, running, setRunning, onFinish }: { seconds: number; running: boolean; setRunning: (value: boolean) => void; onFinish: () => void }) { const mins = String(Math.floor(seconds / 60)).padStart(2, "0"); const secs = String(seconds % 60).padStart(2, "0"); return <section className="lockin-page"><p className="eyebrow">FOCUS SESSION</p><h2>{running ? "You’re in the zone." : "Ready when you are."}</h2><p className="muted">Put the noise away. Give this moment your full attention.</p><div className={`timer ${running ? "active" : ""}`}><div className="timer-ring"><span>{mins}:{secs}</span><small>{running ? "FOCUSING" : "READY"}</small></div></div><div className="lockin-actions">{running ? <button className="button primary" onClick={onFinish}>Finish session</button> : <button className="button primary" onClick={() => setRunning(true)}>◷ Start Lockin</button>}{running && <button className="button secondary" onClick={() => setRunning(false)}>Pause</button>}</div><div className="session-tip"><span>✦</span><div><b>One session is enough to move forward.</b><br /><small>You earn 2 points for every minute you study.</small></div></div></section>; }
function Tree({ store, stage, onWater }: { store: Store; stage: string; onWater: () => void }) { return <section className="tree-page"><div><p className="eyebrow">YOUR STUDY TREE</p><h2>A little care goes a long way.</h2><p className="muted">Water your tree with study points earned in Lockin sessions.</p><div className="tree-card"><div className={`plant-art ${stage.replace(" ", "-")}`}>{stage === "seed" ? "·" : stage === "sprout" ? "♧" : stage === "small plant" ? "♧" : stage === "healthy plant" ? "♣" : "♣"}</div><div className="soil" /><p className="stage-label">{stage}</p><div className="growth-track"><div style={{ width: `${Math.min(100, (store.water / 30) * 100)}%` }} /></div><small>{store.water}/30 waters to a large tree</small></div></div><div className="tree-side panel"><span className="stat-icon">✦</span><p className="eyebrow">AVAILABLE POINTS</p><strong>{store.points}</strong><p className="muted">Each watering costs 50 points.</p><button className="button primary wide" disabled={store.points < 50} onClick={onWater}>💧 Water plant</button><div className="growth-stages"><b>Growth stages</b><span>· Seed</span><span>· Sprout</span><span>· Small plant</span><span>· Healthy plant</span><span>· Large tree</span></div></div></section>; }
function Modal({ type, close, text, setText, preview, parse, add, topic, setTopic, addTopic, checklistName, setChecklistName, addChecklist }: { type: string; close: () => void; text: string; setText: (value: string) => void; preview: string[] | null; parse: () => void; add: () => void; topic: string; setTopic: (value: string) => void; addTopic: () => void; checklistName: string; setChecklistName: (value: string) => void; addChecklist: () => void }) { return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={close}>×</button>{type === "import" ? <><p className="eyebrow">SMART IMPORT</p><h2>Bring in your topics.</h2><p className="muted">Paste a messy list, syllabus, or notes. Lockin will find the topic boundaries for you.</p>{!preview ? <><textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={"1. Classes and Objects\n2. Constructors Default Constructor Parameterized Constructor\n3. Inheritance"} /><button className="button primary wide" onClick={parse} disabled={!text.trim()}>Analyze topics ✦</button></> : <><div className="preview-count">Found <b>{preview.length} topics</b></div><div className="preview-list">{preview.map((item, index) => <div key={`${item}-${index}`}><span>☐</span>{item}</div>)}</div><div className="modal-actions"><button className="button secondary" onClick={close}>Cancel</button><button className="button primary" onClick={add}>Add all topics</button></div></>}</> : type === "new-list" ? <><p className="eyebrow">NEW CHECKLIST</p><h2>Name your focus.</h2><p className="muted">Give this checklist a name you will recognize later.</p><input autoFocus value={checklistName} onChange={(event) => setChecklistName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addChecklist()} placeholder="e.g. Frontend fundamentals" /><button className="button primary wide" onClick={addChecklist} disabled={!checklistName.trim()}>Create checklist</button></> : <><p className="eyebrow">NEW TOPIC</p><h2>Add to your checklist.</h2><input autoFocus value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTopic()} placeholder="e.g. Async and Await" /><button className="button primary wide" onClick={addTopic} disabled={!topic.trim()}>Add topic</button></>}</div></div>; }
createRoot(document.getElementById("root")!).render(<App />);
