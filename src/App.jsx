import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase"; 
import { ref, onValue, set, update } from "firebase/database";

// --- Configuration ---
const ADMIN_PASSWORD = "admin1234";

const DEFAULT_TEAMS = {
  A: ["G-BEAT", "KOZY", "UNDER MANGO TREE", "BANGMOD Z"],
  B: ["LTF", "SI COBRA", "CHOCOBO", "KINGKONG"],
  C: ["BANGMOD", "KMUTT", "WATTANA", "KMUTT SENIOR"],
  D: ["RIFF2POINT X DECHA", "XYZ", "JAGUAR B", "SORNANANKUL"],
};

// --- Helpers & Logic ---
function generateGroupMatches(groups) {
  const matches = [];
  let id = 1;
  Object.entries(groups).forEach(([group, teams]) => {
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++)
        matches.push({ id: id++, round: 1, group, home: teams[i], away: teams[j], homeScore: null, awayScore: null, played: false, date: "", time: "" });
  });
  return matches;
}

const KO_TEMPLATE = [
  { id: 100, round: 2, label: "Quarter Finals 1", shortLabel: "QF1", home: "1A", away: "2C", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 101, round: 2, label: "Quarter Finals 2", shortLabel: "QF2", home: "1D", away: "2B", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 102, round: 2, label: "Quarter Finals 3", shortLabel: "QF3", home: "1B", away: "2D", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 103, round: 2, label: "Quarter Finals 4", shortLabel: "QF4", home: "1C", away: "2A", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 200, round: 3, label: "Semi Finals 1", shortLabel: "SF1", home: "W-QF1", away: "W-QF2", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 201, round: 3, label: "Semi Finals 2", shortLabel: "SF2", home: "W-QF3", away: "W-QF4", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 300, round: 4, label: "3rd Place", shortLabel: "3rd", home: "L-SF1", away: "L-SF2", homeScore: null, awayScore: null, played: false, date: "", time: "" },
  { id: 301, round: 4, label: "Grand Final", shortLabel: "FINAL", home: "W-SF1", away: "W-SF2", homeScore: null, awayScore: null, played: false, date: "", time: "" },
];

function computeStandings(teams, matches) {
  const stats = {};
  if (!teams || !matches) return {};

  Object.entries(teams).forEach(([g, ts]) => ts.forEach((t) => {
    stats[t] = { team: t, group: g, played: 0, wins: 0, losses: 0, pts: 0, pf: 0, pa: 0 };
  }));

  matches.forEach((m) => {
    if (!m.played || m.round !== 1) return;
    const h = stats[m.home], a = stats[m.away];
    if (!h || !a) return;
    h.played++; a.played++; h.pf += m.homeScore; h.pa += m.awayScore; a.pf += m.awayScore; a.pa += m.homeScore;
    if (m.homeScore > m.awayScore) { h.wins++; h.pts += 3; a.losses++; a.pts += 1; }
    else { a.wins++; a.pts += 3; h.losses++; h.pts += 1; }
  });

  const grouped = {};
  Object.keys(teams).forEach((g) => {
    const groupTeams = teams[g].map((t) => stats[t]);
    grouped[g] = groupTeams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const h2hMatch = matches.find(m => m.round === 1 && m.played && ((m.home === a.team && m.away === b.team) || (m.home === b.team && m.away === a.team)));
      if (h2hMatch) {
        const aScore = h2hMatch.home === a.team ? h2hMatch.homeScore : h2hMatch.awayScore;
        const bScore = h2hMatch.home === b.team ? h2hMatch.homeScore : h2hMatch.awayScore;
        if (aScore !== bScore) return bScore - aScore;
      }
      const diffA = a.pf - a.pa;
      const diffB = b.pf - b.pa;
      if (diffB !== diffA) return diffB - diffA;
      return b.pf - a.pf;
    });
  });
  return grouped;
}

const getTeamStyle = (name) => {
  const gradients = [
    "from-orange-500 to-red-700",
    "from-blue-600 to-indigo-900",
    "from-emerald-600 to-teal-900",
    "from-purple-600 to-fuchsia-900",
    "from-amber-500 to-yellow-800",
    "from-rose-600 to-pink-900",
    "from-cyan-600 to-blue-800",
    "from-slate-500 to-slate-800",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

// --- UI Components ---

function TeamAvatar({ name, size = "md" }) {
  const gradient = useMemo(() => getTeamStyle(name || "??"), [name]);
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  
  const sizeClass = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-2xl"
  };

  return (
    <div 
      className={`${sizeClass[size]} rounded-full flex items-center justify-center font-black text-white shadow-lg border border-white/20 shrink-0 bg-gradient-to-br ${gradient}`}
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
    >
      {initial}
    </div>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  const styles = { 
    success: "bg-emerald-500/10 border-emerald-500/50 text-emerald-400", 
    error: "bg-rose-500/10 border-rose-500/50 text-rose-400", 
    info: "bg-blue-500/10 border-blue-500/50 text-blue-400" 
  };
  return <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full border backdrop-blur-xl text-sm font-bold shadow-2xl animate-fade-in-up ${styles[type]}`}>{message}</div>;
}

function Badge({ children, color = "orange", className = "" }) {
  const c = { 
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20", 
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20", 
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", 
    gray: "bg-gray-800 text-gray-400 border-gray-700",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    red: "bg-rose-500/10 text-rose-400 border-rose-500/20"
  };
  return <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${c[color]} ${className}`}>{children}</span>;
}

function TabBtn({ active, onClick, children, icon }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold tracking-widest uppercase transition-all duration-300 relative overflow-hidden group ${active ? "text-orange-400" : "text-gray-500 hover:text-gray-300"}`}>
      {active && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>}
      <span className={`text-lg transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110"}`}>{icon}</span>
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function AdminLoginModal({ onClose, onSuccess }) {
  const [pw, setPw] = useState("");
  const attempt = () => { if (pw === ADMIN_PASSWORD) { onSuccess(); onClose(); } else { setPw(""); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-xs shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-purple-600"></div>
        <div className="text-center mb-6">
            <h3 className="text-xl font-black text-white tracking-tight">SYSTEM ACCESS</h3>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Authorized Personnel Only</p>
        </div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()} placeholder="Enter Passkey" className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-center text-white outline-none focus:border-orange-500 transition-colors mb-4 placeholder-gray-600" autoFocus />
        <button onClick={attempt} className="w-full py-3 rounded-lg bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">Authenticate</button>
      </div>
    </div>
  );
}

function ScoreModal({ match, onClose, onSave }) {
  const [h, setH] = useState(match.homeScore ?? ""); const [a, setA] = useState(match.awayScore ?? "");
  const [date, setDate] = useState(match.date ?? ""); const [time, setTime] = useState(match.time ?? "");
  const handleSave = () => { if (h === "" || a === "") return; onSave(match.id, parseInt(h), parseInt(a), date, time); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors">✕</button>
        <div className="text-center mb-6">
            <Badge color="purple" className="mb-2">Update Result</Badge>
            <div className="text-xs text-gray-500 font-mono mt-1">{match.label || `Match #${match.id}`}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6 bg-gray-950/50 p-3 rounded-xl border border-gray-800">
            <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-transparent text-white text-xs outline-none font-mono" />
            </div>
            <div className="border-l border-gray-800 pl-3">
                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Time</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-transparent text-white text-xs outline-none font-mono" />
            </div>
        </div>
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex flex-col items-center flex-1">
             <TeamAvatar name={match.home} size="lg" />
             <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase truncate max-w-[80px]">{match.home}</p>
             <input type="number" value={h} onChange={e => setH(e.target.value)} className="mt-2 w-16 h-12 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-black text-white focus:border-orange-500 outline-none tabular-nums" placeholder="-" />
          </div>
          <div className="text-gray-700 text-xl font-black">VS</div>
          <div className="flex flex-col items-center flex-1">
             <TeamAvatar name={match.away} size="lg" />
             <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase truncate max-w-[80px]">{match.away}</p>
             <input type="number" value={a} onChange={e => setA(e.target.value)} className="mt-2 w-16 h-12 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-black text-white focus:border-orange-500 outline-none tabular-nums" placeholder="-" />
          </div>
        </div>
        <button onClick={handleSave} className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-orange-900/20 transition-all">Confirm Result</button>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
    return (
        <button onClick={onClick} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all whitespace-nowrap ${active ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600 hover:text-gray-300"}`}>
            {label}
        </button>
    )
}

function BracketNode({ match, nextMatch }) {
    const homeWins = match.played && match.homeScore > match.awayScore;
    const awayWins = match.played && match.awayScore > match.homeScore;
    
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 w-40 flex-shrink-0 relative z-10 hover:border-gray-600 transition-colors shadow-lg">
            <div className="text-[9px] text-gray-500 uppercase font-black mb-2">{match.shortLabel}</div>
            {/* Home */}
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2 overflow-hidden">
                    <TeamAvatar name={match.home} size="sm" />
                    <span className={`text-[10px] font-bold truncate ${homeWins ? "text-white" : "text-gray-500"}`}>{match.home}</span>
                </div>
                <span className={`text-[10px] font-mono font-bold ${homeWins ? "text-orange-400" : "text-gray-600"}`}>{match.played ? match.homeScore : "-"}</span>
            </div>
            {/* Away */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                    <TeamAvatar name={match.away} size="sm" />
                    <span className={`text-[10px] font-bold truncate ${awayWins ? "text-white" : "text-gray-500"}`}>{match.away}</span>
                </div>
                <span className={`text-[10px] font-mono font-bold ${awayWins ? "text-orange-400" : "text-gray-600"}`}>{match.played ? match.awayScore : "-"}</span>
            </div>
        </div>
    )
}

function BracketTab({ matches }) {
    // Helper to find match by ID
    const m = (id) => matches.find(x => x.id === id) || {};

    return (
        <div className="overflow-x-auto pb-12 pt-4 animate-fade-in">
            <div className="flex items-center gap-8 min-w-[700px] px-4">
                
                {/* Round of 8 (Quarter Finals) */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-6 relative">
                        <BracketNode match={m(100)} /> {/* QF1 */}
                        <div className="absolute right-[-20px] top-[25%] bottom-[25%] w-[20px] border-r border-t border-b border-gray-700 rounded-r-lg"></div>
                        <BracketNode match={m(101)} /> {/* QF2 */}
                    </div>
                    <div className="flex flex-col gap-6 relative">
                        <BracketNode match={m(102)} /> {/* QF3 */}
                        <div className="absolute right-[-20px] top-[25%] bottom-[25%] w-[20px] border-r border-t border-b border-gray-700 rounded-r-lg"></div>
                        <BracketNode match={m(103)} /> {/* QF4 */}
                    </div>
                </div>

                {/* Semi Finals */}
                <div className="flex flex-col gap-24 relative">
                     <div className="relative">
                         <div className="absolute left-[-20px] top-1/2 w-[20px] border-t border-gray-700"></div>
                         <BracketNode match={m(200)} /> {/* SF1 */}
                         <div className="absolute right-[-20px] top-1/2 h-[150px] w-[20px] border-r border-t border-gray-700 rounded-tr-lg translate-y-[0px]"></div>
                     </div>
                     <div className="relative">
                         <div className="absolute left-[-20px] top-1/2 w-[20px] border-t border-gray-700"></div>
                         <BracketNode match={m(201)} /> {/* SF2 */}
                         <div className="absolute right-[-20px] bottom-1/2 h-[150px] w-[20px] border-r border-b border-gray-700 rounded-br-lg translate-y-[0px]"></div>
                     </div>
                </div>

                {/* Finals */}
                <div className="flex flex-col gap-10 mt-1">
                    <div className="relative">
                        <div className="absolute left-[-20px] top-1/2 w-[20px] border-t border-gray-700"></div>
                        <div className="absolute -top-10 left-0 right-0 text-center text-[10px] text-yellow-500 font-black uppercase tracking-widest animate-pulse">🏆 Champion</div>
                        <BracketNode match={m(301)} /> {/* FINAL */}
                    </div>
                    
                    {/* 3rd Place (Optional placement) */}
                    <div className="relative opacity-70 scale-90 mt-8">
                         <div className="text-[9px] text-center text-gray-600 uppercase mb-1">3rd Place Match</div>
                         <BracketNode match={m(300)} />
                    </div>
                </div>

            </div>
        </div>
    );
}

function ScheduleTab({ matches, isAdmin, onEditScore, onDeleteScore }) {
  const [filterRound, setFilterRound] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const rounds = [
    { id: "all", label: "All Matches" },
    { id: "1", label: "Group Stage" },
    { id: "2", label: "Quarter Finals" },
    { id: "3", label: "Semi Finals" },
    { id: "4", label: "Finals" }
  ];

  const filtered = matches.filter(m => {
    const rMatch = filterRound === "all" || m.round === parseInt(filterRound);
    const sMatch = filterStatus === "all" || (filterStatus === "played" ? m.played : !m.played);
    return rMatch && sMatch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {rounds.map(r => (
                <FilterPill key={r.id} active={filterRound === r.id} onClick={() => setFilterRound(r.id)} label={r.label} />
            ))}
        </div>
        <div className="flex gap-2">
            <button onClick={() => setFilterStatus("all")} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg border ${filterStatus === "all" ? "bg-gray-800 text-white border-gray-700" : "border-transparent text-gray-600"}`}>All Status</button>
            <button onClick={() => setFilterStatus("played")} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg border ${filterStatus === "played" ? "bg-gray-800 text-green-400 border-gray-700" : "border-transparent text-gray-600"}`}>Completed</button>
            <button onClick={() => setFilterStatus("pending")} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg border ${filterStatus === "pending" ? "bg-gray-800 text-orange-400 border-gray-700" : "border-transparent text-gray-600"}`}>Upcoming</button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-center py-10 text-gray-600 text-xs font-mono">NO MATCHES FOUND</div>}
        
        {filtered.map(m => {
          const homeWins = m.played && m.homeScore > m.awayScore;
          const awayWins = m.played && m.awayScore > m.homeScore;
          const isDraw = m.played && m.homeScore === m.awayScore;

          return (
            <div key={m.id} className="relative group overflow-hidden bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-all shadow-lg">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-950/30 border-b border-gray-800/50">
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-gray-500 uppercase">{m.label || "Group Stage"}</span>
                    {m.group && <span className="w-4 h-4 rounded flex items-center justify-center bg-gray-800 text-[9px] font-bold text-gray-400">{m.group}</span>}
                 </div>
                 <div className="flex items-center gap-2 text-[9px] font-mono font-bold text-gray-500">
                    {m.date && <span className="text-gray-400">{m.date}</span>}
                    {m.time && <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{m.time}</span>}
                 </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <TeamAvatar name={m.home} size="md" />
                    <span className={`text-xs font-bold truncate ${m.played && !homeWins && !isDraw ? "text-gray-500" : "text-white"}`}>{m.home}</span>
                    {homeWins && <span className="text-[8px] bg-orange-500 text-black px-1 rounded font-black">WIN</span>}
                </div>
                <div className="flex flex-col items-center justify-center px-2 min-w-[80px]">
                    {m.played ? (
                        <div className="flex items-center gap-1 text-2xl font-black tabular-nums tracking-tighter">
                            <span className={homeWins ? "text-white" : "text-gray-600"}>{m.homeScore}</span>
                            <span className="text-gray-700 text-sm mx-1">:</span>
                            <span className={awayWins ? "text-white" : "text-gray-600"}>{m.awayScore}</span>
                        </div>
                    ) : (
                        <span className="text-xl font-black text-gray-800">VS</span>
                    )}
                    {isAdmin && (
                        <button onClick={() => onEditScore(m)} className="mt-1 text-[9px] text-orange-500 hover:text-orange-400 font-bold uppercase tracking-wider">
                            {m.played ? "Edit" : "Set Score"}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                    {awayWins && <span className="text-[8px] bg-orange-500 text-black px-1 rounded font-black">WIN</span>}
                    <span className={`text-xs font-bold truncate text-right ${m.played && !awayWins && !isDraw ? "text-gray-500" : "text-white"}`}>{m.away}</span>
                    <TeamAvatar name={m.away} size="md" />
                </div>
              </div>
              {isAdmin && m.played && (
                 <button onClick={() => onDeleteScore(m.id)} className="absolute top-2 right-2 p-1 rounded hover:bg-red-500/20 text-gray-700 hover:text-red-500 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandingsTab({ standings }) {
  const QUALIFIED_COUNT = 2; 
  return (
    <div className="space-y-8 animate-fade-in">
      {Object.entries(standings).map(([group, teams]) => (
        <div key={group} className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-800">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-orange-500/20">{group}</div>
                 <div>
                    <h3 className="text-white font-black text-sm uppercase tracking-widest">Group Stage</h3>
                    <p className="text-[10px] text-gray-500 font-medium">Top {QUALIFIED_COUNT} qualify to next round</p>
                 </div>
             </div>
             <Badge color="gray">LIVE</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-950/50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-2 py-3 text-center w-12">P</th>
                  <th className="px-2 py-3 text-center w-12">+/-</th>
                  <th className="px-4 py-3 text-center w-16 text-white">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {teams.map((t, i) => {
                  const isQualified = i < QUALIFIED_COUNT;
                  return (
                    <tr key={t.team} className={`group hover:bg-white/[0.02] transition-colors ${isQualified ? "bg-orange-500/[0.03]" : ""}`}>
                      <td className="px-4 py-4">
                          <span className={`flex items-center justify-center w-6 h-6 rounded font-black ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-400 text-black" : i===2 ? "bg-orange-700 text-white" : "text-gray-600"}`}>
                              {i + 1}
                          </span>
                      </td>
                      <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                              <TeamAvatar name={t.team} size="sm" />
                              <div>
                                  <div className={`font-bold text-sm ${isQualified ? "text-white" : "text-gray-400"}`}>{t.team}</div>
                                  {isQualified && <span className="text-[8px] text-orange-400 font-bold uppercase tracking-wide">Qualified</span>}
                              </div>
                          </div>
                      </td>
                      <td className="px-2 py-4 text-center text-gray-400 font-mono">{t.played}</td>
                      <td className={`px-2 py-4 text-center font-mono font-bold ${t.pf - t.pa > 0 ? "text-green-400" : t.pf - t.pa < 0 ? "text-red-400" : "text-gray-500"}`}>
                        {t.pf - t.pa > 0 ? "+" : ""}{t.pf - t.pa}
                      </td>
                      <td className="px-4 py-4 text-center">
                          <span className="text-base font-black text-white tabular-nums">{t.pts}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main App Component ──
export default function App() {
  const [tab, setTab] = useState("standings");
  const [isAdmin, setIsAdmin] = useState(false);
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [scoreModal, setScoreModal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const dataRef = ref(db, "tournament_data");
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setAppData(data);
      else set(dataRef, { teams: DEFAULT_TEAMS, groupMatches: generateGroupMatches(DEFAULT_TEAMS), koMatches: KO_TEMPLATE });
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveScore = (id, h, a, date, time) => {
    const isGroup = id < 100;
    const path = isGroup ? "groupMatches" : "koMatches";
    const matchIdx = appData[path].findIndex(m => m.id === id);
    const updates = {};
    updates[`tournament_data/${path}/${matchIdx}/homeScore`] = h;
    updates[`tournament_data/${path}/${matchIdx}/awayScore`] = a;
    updates[`tournament_data/${path}/${matchIdx}/played`] = true;
    updates[`tournament_data/${path}/${matchIdx}/date`] = date;
    updates[`tournament_data/${path}/${matchIdx}/time`] = time;
    update(ref(db), updates).then(() => setToast({ message: "Match Result Updated", type: "success" }));
  };

  const handleDeleteScore = (id) => {
    if(!window.confirm("Are you sure you want to reset this match?")) return;
    const isGroup = id < 100;
    const path = isGroup ? "groupMatches" : "koMatches";
    const matchIdx = appData[path].findIndex(m => m.id === id);
    const updates = {};
    updates[`tournament_data/${path}/${matchIdx}/homeScore`] = null;
    updates[`tournament_data/${path}/${matchIdx}/awayScore`] = null;
    updates[`tournament_data/${path}/${matchIdx}/played`] = false;
    update(ref(db), updates).then(() => setToast({ message: "Match Reset", type: "info" }));
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="font-black text-orange-500 tracking-widest text-xs animate-pulse">LOADING DATA...</span>
        </div>
    </div>
  );

  const { teams, groupMatches, koMatches } = appData;
  const standings = computeStandings(teams, groupMatches);
  const allMatches = [...groupMatches, ...koMatches];
  
  const totalMatches = allMatches.length;
  const playedMatches = allMatches.filter(m => m.played).length;
  const progress = Math.round((playedMatches / (totalMatches || 1)) * 100);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 pb-24">
      <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      <header className="relative z-10 pt-12 pb-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/5 mb-4 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest">Live Tournament System</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter leading-none mb-2">
                BANGMOD <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">2026</span>
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm font-medium tracking-wide uppercase">Official Basketball Championship</p>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-4 mb-8">
          <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md shadow-xl">
             <div className="flex justify-between items-end mb-2">
                 <span className="text-[10px] font-black text-gray-400 uppercase">Tournament Progress</span>
                 <span className="text-xs font-black text-white">{progress}%</span>
             </div>
             <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-orange-600 to-yellow-400 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
             </div>
             <div className="flex justify-between mt-4 text-center divide-x divide-gray-800">
                 <div className="flex-1 px-2">
                     <div className="text-xl font-black text-white">{totalMatches}</div>
                     <div className="text-[8px] uppercase text-gray-500 font-bold">Matches</div>
                 </div>
                 <div className="flex-1 px-2">
                     <div className="text-xl font-black text-green-400">{playedMatches}</div>
                     <div className="text-[8px] uppercase text-gray-500 font-bold">Completed</div>
                 </div>
                 <div className="flex-1 px-2">
                     <div className="text-xl font-black text-orange-400">{totalMatches - playedMatches}</div>
                     <div className="text-[8px] uppercase text-gray-500 font-bold">Remaining</div>
                 </div>
             </div>
          </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 mb-6">
        <div className="max-w-2xl mx-auto px-4 flex">
          <TabBtn active={tab === "standings"} onClick={() => setTab("standings")} icon="📊">Table</TabBtn>
          <TabBtn active={tab === "schedule"} onClick={() => setTab("schedule")} icon="📅">Matches</TabBtn>
          <TabBtn active={tab === "bracket"} onClick={() => setTab("bracket")} icon="⚡">Bracket</TabBtn>
        </div>
      </div>

      <main className="relative z-10 max-w-2xl mx-auto px-4 min-h-[50vh]">
        {tab === "standings" && <StandingsTab standings={standings} />}
        {tab === "schedule" && <ScheduleTab matches={allMatches} isAdmin={isAdmin} onEditScore={setScoreModal} onDeleteScore={handleDeleteScore} />}
        {tab === "bracket" && <BracketTab matches={koMatches} />}
      </main>

      {/* Footer & Admin Button */}
      <footer className="relative z-10 text-center py-10">
        <p className="text-[9px] font-mono text-gray-600">POWERED BY FIREBASE • BANGMOD 2026 SYSTEM</p>
        <button 
          onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)} 
          className={`mt-4 text-[9px] font-bold uppercase tracking-widest transition-all ${isAdmin ? "text-red-500 opacity-100" : "text-gray-800 opacity-30 hover:opacity-100 hover:text-white"}`}
        >
          {isAdmin ? "Logout Admin" : "Admin Login"}
        </button>
      </footer>

      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={() => { setIsAdmin(true); setToast({message: "Welcome Admin", type: "success"}); }} />}
      {scoreModal && <ScoreModal match={scoreModal} onClose={() => setScoreModal(null)} onSave={handleSaveScore} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}