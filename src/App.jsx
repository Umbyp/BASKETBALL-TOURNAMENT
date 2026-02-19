import { useState, useEffect, useMemo, useRef } from "react";
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

const GROUP_COLORS = {
  A: { badge: "bg-amber-500/20 text-amber-400 border border-amber-500/30",   dot: "bg-amber-400",   ring: "border-l-amber-500",   header: "from-amber-600/15 to-transparent", icon: "bg-amber-500" },
  B: { badge: "bg-blue-500/20 text-blue-400 border border-blue-500/30",       dot: "bg-blue-400",    ring: "border-l-blue-500",    header: "from-blue-600/15 to-transparent",  icon: "bg-blue-500" },
  C: { badge: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", dot: "bg-emerald-400", ring: "border-l-emerald-500", header: "from-emerald-600/15 to-transparent", icon: "bg-emerald-500" },
  D: { badge: "bg-purple-500/20 text-purple-400 border border-purple-500/30", dot: "bg-purple-400",  ring: "border-l-purple-500",  header: "from-purple-600/15 to-transparent", icon: "bg-purple-500" },
};

const MATCH_SCHEDULE = {
  19: { matchNo:1,  date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.", time:"13:00-14:00" },
  12: { matchNo:2,  date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.", time:"14:10-15:10" },
  18: { matchNo:3,  date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.", time:"15:40-16:40" },
   3: { matchNo:4,  date:"2026-02-28", dateLabel:"เสาร์ 28 ก.พ.", time:"16:50-17:50" },
   4: { matchNo:5,  date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"13:00-14:00" },
   7: { matchNo:6,  date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"14:10-15:10" },
  13: { matchNo:7,  date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"15:40-16:40" },
  24: { matchNo:8,  date:"2026-03-01", dateLabel:"อาทิตย์ 1 มี.ค.", time:"16:50-17:50" },
  20: { matchNo:9,  date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.", time:"13:00-14:00" },
   2: { matchNo:10, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.", time:"14:10-15:10" },
  14: { matchNo:11, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.", time:"15:40-16:40" },
   8: { matchNo:12, date:"2026-03-15", dateLabel:"อาทิตย์ 15 มี.ค.", time:"16:50-17:50" },
  16: { matchNo:13, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.", time:"13:00-14:00" },
  23: { matchNo:14, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.", time:"14:10-15:10" },
   5: { matchNo:15, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.", time:"15:40-16:40" },
   9: { matchNo:16, date:"2026-03-21", dateLabel:"เสาร์ 21 มี.ค.", time:"16:50-17:50" },
  10: { matchNo:17, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.", time:"13:00-14:00" },
  21: { matchNo:18, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.", time:"14:10-15:10" },
   1: { matchNo:19, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.", time:"15:40-16:40" },
  17: { matchNo:20, date:"2026-03-22", dateLabel:"อาทิตย์ 22 มี.ค.", time:"16:50-17:50" },
  22: { matchNo:21, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.", time:"13:00-14:00" },
  11: { matchNo:22, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.", time:"14:10-15:10" },
   6: { matchNo:23, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.", time:"15:40-16:40" },
  15: { matchNo:24, date:"2026-03-28", dateLabel:"เสาร์ 28 มี.ค.", time:"16:50-17:50" },
  100:{ matchNo:25, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.", time:"13:00-14:00" },
  101:{ matchNo:26, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.", time:"14:10-15:10" },
  102:{ matchNo:27, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.", time:"15:40-16:40" },
  103:{ matchNo:28, date:"2026-03-29", dateLabel:"อาทิตย์ 29 มี.ค.", time:"16:50-17:50" },
  200:{ matchNo:29, date:"2026-04-04", dateLabel:"เสาร์ 4 เม.ย.", time:"16:00-17:00" },
  201:{ matchNo:30, date:"2026-04-04", dateLabel:"เสาร์ 4 เม.ย.", time:"17:00-18:00" },
  300:{ matchNo:31, date:"2026-04-05", dateLabel:"อาทิตย์ 5 เม.ย.", time:"16:00-17:00" },
  301:{ matchNo:32, date:"2026-04-05", dateLabel:"อาทิตย์ 5 เม.ย.", time:"17:00-18:00" },
};

function enrichMatch(m) {
  const s = MATCH_SCHEDULE[m.id] || {};
  return { ...m, matchNo: s.matchNo || m.id, dateLabel: s.dateLabel || "", schedDate: s.date || "", schedTime: s.time || "" };
}

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
    h.played++; a.played++;
    h.pf += m.homeScore; h.pa += m.awayScore;
    a.pf += m.awayScore; a.pa += m.homeScore;
    const isHomeForfeit = (m.homeScore === 0 && m.awayScore === 20);
    const isAwayForfeit = (m.awayScore === 0 && m.homeScore === 20);
    if (m.homeScore > m.awayScore) {
      h.wins++; h.pts += 3; a.losses++; a.pts += isAwayForfeit ? 0 : 1;
    } else if (m.awayScore > m.homeScore) {
      a.wins++; a.pts += 3; h.losses++; h.pts += isHomeForfeit ? 0 : 1;
    }
  });
  const grouped = {};
  Object.keys(teams).forEach((g) => {
    grouped[g] = teams[g].map((t) => stats[t]).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const h2h = matches.find(m => m.round === 1 && m.played && ((m.home === a.team && m.away === b.team) || (m.home === b.team && m.away === a.team)));
      if (h2h) {
        const aScore = h2h.home === a.team ? h2h.homeScore : h2h.awayScore;
        const bScore = h2h.home === b.team ? h2h.homeScore : h2h.awayScore;
        if (aScore !== bScore) return bScore - aScore;
      }
      return (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf;
    });
  });
  return grouped;
}

function resolveKoMatches(koMatches, standings, groupMatches) {
  const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.played);
  const getFromStandings = (code) => {
    const rank = parseInt(code[0]) - 1;
    const group = code[1];
    return standings[group]?.[rank]?.team || code;
  };
  const getKoWinnerOrLoser = (code, resolved) => {
    const [outcome, label] = code.split("-");
    const m = resolved.find(r => r.shortLabel === label);
    if (!m || !m.played) return code;
    const homeWon = m.homeScore > m.awayScore;
    if (outcome === "W") return homeWon ? m.resolvedHome : m.resolvedAway;
    if (outcome === "L") return homeWon ? m.resolvedAway : m.resolvedHome;
    return code;
  };
  const resolved = [];
  for (const m of koMatches) {
    let rHome = m.home, rAway = m.away;
    if (allGroupDone) {
      if (/^[1-4][A-D]$/.test(m.home)) rHome = getFromStandings(m.home);
      if (/^[1-4][A-D]$/.test(m.away)) rAway = getFromStandings(m.away);
      if (m.home.includes("-")) rHome = getKoWinnerOrLoser(m.home, resolved);
      if (m.away.includes("-")) rAway = getKoWinnerOrLoser(m.away, resolved);
    }
    resolved.push({ ...m, resolvedHome: rHome, resolvedAway: rAway });
  }
  return { resolved, allGroupDone };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useNextMatch(matches) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = useMemo(() => {
    if (!matches) return null;
    const candidates = matches
      .filter((m) => !m.played)
      .map((m) => {
        const s = MATCH_SCHEDULE[m.id];
        if (!s) return null;
        const startStr = s.time.split("-")[0]; // "13:00"
        const dt = new Date(`${s.date}T${startStr}:00+07:00`);
        return { ...m, dt, sched: s };
      })
      .filter(Boolean)
      .sort((a, b) => a.dt - b.dt);
    return candidates[0] || null;
  }, [matches]);

  const diff = next ? Math.max(0, next.dt - now) : 0;
  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const isLive  = next ? now >= next.dt && now < new Date(next.dt.getTime() + 70 * 60000) : false;

  return { next, days, hours, minutes, seconds, isLive, diff };
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

const getTeamStyle = (name) => {
  const gradients = [
    "from-orange-500 to-red-700", "from-blue-600 to-indigo-900", "from-emerald-600 to-teal-900",
    "from-purple-600 to-fuchsia-900", "from-amber-500 to-yellow-800", "from-rose-600 to-pink-900",
    "from-cyan-600 to-blue-800", "from-slate-500 to-slate-800",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
};

function TeamAvatar({ name, size = "md" }) {
  const [imgError, setImgError] = useState(false);
  const gradient = useMemo(() => getTeamStyle(name || "??"), [name]);
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const imgSrc = `/photo/${(name || "").replace(/\s+/g, '_')}.jpg`;
  const sizeClass = { sm: "w-8 h-8 text-xs", md: "w-12 h-12 text-sm", lg: "w-16 h-16 text-xl", xl: "w-20 h-20 text-3xl" };
  return (
    <div className={`${sizeClass[size]} rounded-full flex items-center justify-center font-black text-white shadow-lg border border-white/20 shrink-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
      {!imgError
        ? <img src={imgSrc} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        : <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{initial}</span>}
    </div>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  const styles = { success: "bg-emerald-500/10 border-emerald-500/50 text-emerald-400", error: "bg-rose-500/10 border-rose-500/50 text-rose-400", info: "bg-blue-500/10 border-blue-500/50 text-blue-400" };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full border backdrop-blur-xl text-sm font-bold shadow-2xl animate-slide-up ${styles[type]}`}>
      {message}
    </div>
  );
}

function Badge({ children, color = "orange", className = "" }) {
  const c = { orange: "bg-orange-500/10 text-orange-400 border-orange-500/20", blue: "bg-blue-500/10 text-blue-400 border-blue-500/20", green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", gray: "bg-gray-800 text-gray-400 border-gray-700", purple: "bg-purple-500/10 text-purple-400 border-purple-500/20", red: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
  return <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${c[color]} ${className}`}>{children}</span>;
}

function TabBtn({ active, onClick, children, icon, notify }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold tracking-widest uppercase transition-all duration-300 relative overflow-hidden group ${active ? "text-orange-400" : "text-gray-500 hover:text-gray-300"}`}>
      {active && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />}
      <span className={`text-lg transition-transform duration-300 relative ${active ? "scale-110" : "group-hover:scale-110"}`}>
        {icon}
        {notify && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
      </span>
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function SkeletonPulse({ className }) {
  return <div className={`animate-pulse bg-gray-800/80 rounded-lg ${className}`} />;
}

function SkeletonStandings() {
  return (
    <div className="space-y-6">
      {["A", "B", "C", "D"].map((g) => (
        <div key={g} className="border border-gray-800 rounded-3xl overflow-hidden bg-gray-900">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
            <SkeletonPulse className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <SkeletonPulse className="w-20 h-3" />
              <SkeletonPulse className="w-28 h-2" />
            </div>
          </div>
          {[0,1,2,3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-800/40 last:border-0">
              <SkeletonPulse className="w-7 h-7 rounded-lg" />
              <SkeletonPulse className="w-10 h-10 rounded-full" />
              <SkeletonPulse className="flex-1 h-3 max-w-[120px]" />
              <div className="flex gap-4 ml-auto">
                {[0,1,2,3,4].map(j => <SkeletonPulse key={j} className="w-6 h-4" />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonSchedule() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[0,1,2,3].map(i => <SkeletonPulse key={i} className="h-14 rounded-xl" />)}
      </div>
      <SkeletonPulse className="h-8 rounded-full w-48" />
      {[0,1,2,3,4,5].map(i => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function FlipDigit({ value }) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div className="relative w-9 h-9 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-800 border border-white/[0.07] rounded-lg shadow-inner" />
      <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px bg-black/50 z-10" />
      <span
        className="relative z-20 text-sm font-black font-mono text-white tabular-nums select-none"
        style={{ textShadow: "0 0 14px rgba(249,115,22,0.5)" }}
      >
        {pad(value)}
      </span>
    </div>
  );
}

function NextMatchCountdown({ allMatches }) {
  const { next, days, hours, minutes, seconds, isLive } = useNextMatch(allMatches);
  if (!next) return null;

  const home  = next.resolvedHome || next.home;
  const away  = next.resolvedAway || next.away;
  const gc    = next.group ? GROUP_COLORS[next.group] : null;
  const sched = MATCH_SCHEDULE[next.id] || {};

  const units = [
    { label: "วัน",  value: days },
    { label: "ชม.",  value: hours },
    { label: "นาที", value: minutes },
    { label: "วิ",   value: seconds },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-950/80 shadow-2xl mt-4">
      {/* ambient glow */}
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-orange-600/15 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />

      {/* header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-black/30">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-red-500 shadow-[0_0_8px_#ef4444]" : "bg-green-400 shadow-[0_0_6px_#4ade80]"} animate-pulse`} />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
            {isLive ? "กำลังแข่งขัน" : "นัดถัดไป"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {gc && <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${gc.badge}`}>กลุ่ม {next.group}</span>}
          {!next.group && next.shortLabel && (
            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-orange-500/20 text-orange-400 border-orange-500/30">{next.shortLabel}</span>
          )}
          <span className="text-[8px] font-mono text-gray-700">#{sched.matchNo}</span>
        </div>
      </div>

      {/* content */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        {/* Home */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <TeamAvatar name={home} size="md" />
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-wide truncate max-w-[75px] text-center leading-tight">{home}</span>
        </div>

        {/* Center countdown */}
        <div className="flex flex-col items-center shrink-0 gap-1">
          {isLive ? (
            <div className="flex flex-col items-center">
              <span className="text-red-400 font-black text-base animate-pulse tracking-widest">LIVE</span>
              <span className="text-[8px] text-red-600 font-bold">⚡ กำลังแข่ง</span>
            </div>
          ) : (
            <div className="flex items-end gap-0.5">
              {units.map(({ label, value }, i) => (
                <div key={label} className="flex items-end gap-0.5">
                  <div className="flex flex-col items-center">
                    <FlipDigit value={value} />
                    <span className="text-[7px] text-gray-600 font-bold mt-0.5 uppercase">{label}</span>
                  </div>
                  {i < units.length - 1 && (
                    <span className="text-gray-700 font-black text-xs pb-4 leading-none">:</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col items-center mt-0.5">
            <span className="text-[8px] text-gray-600 font-mono">{sched.time}</span>
            <span className="text-[8px] text-gray-500 font-bold">{sched.dateLabel}</span>
          </div>
        </div>

        {/* Away */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <TeamAvatar name={away} size="md" />
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-wide truncate max-w-[75px] text-center leading-tight">{away}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Last Updated indicator ───────────────────────────────────────────────────

function LastUpdated({ time }) {
  const [label, setLabel] = useState("เพิ่งอัปเดต");
  useEffect(() => {
    const update = () => {
      if (!time) return;
      const diff = Math.floor((Date.now() - time) / 1000);
      if (diff < 10)       setLabel("เพิ่งอัปเดต");
      else if (diff < 60)  setLabel(`${diff} วิที่แล้ว`);
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)} นาทีที่แล้ว`);
      else                 setLabel(`${Math.floor(diff / 3600)} ชม.ที่แล้ว`);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [time]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      <span className="text-[9px] text-gray-600 font-mono">sync {label}</span>
    </div>
  );
}

// ─── Animated Tab Content ─────────────────────────────────────────────────────

function AnimatedTab({ active, children }) {
  const [visible, setVisible] = useState(active);
  const [animClass, setAnimClass] = useState(active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none absolute");

  useEffect(() => {
    if (active) {
      setVisible(true);
      // small delay so the element is in DOM before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimClass("opacity-100 translate-y-0 transition-all duration-300 ease-out");
        });
      });
    } else {
      setAnimClass("opacity-0 translate-y-2 pointer-events-none absolute transition-all duration-150");
      const t = setTimeout(() => setVisible(false), 150);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (!visible && !active) return null;

  return (
    <div className={`w-full ${animClass}`}>
      {children}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AdminLoginModal({ onClose, onSuccess }) {
  const [pw, setPw] = useState("");
  const attempt = () => { if (pw === ADMIN_PASSWORD) { onSuccess(); onClose(); } else setPw(""); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-xs shadow-2xl relative overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-purple-600" />
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
  const [h, setH] = useState(match.homeScore ?? "");
  const [a, setA] = useState(match.awayScore ?? "");
  const [date, setDate] = useState(match.date ?? "");
  const [time, setTime] = useState(match.time ?? "");
  const displayHome = match.resolvedHome || match.home;
  const displayAway = match.resolvedAway || match.away;
  const handleForfeit = (side) => { if (side === "home") { setH(20); setA(0); } else { setH(0); setA(20); } };
  const handleSave = () => { if (h === "" || a === "") return; onSave(match.id, parseInt(h), parseInt(a), date, time); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-scale-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors">✕</button>
        <div className="text-center mb-6">
          <Badge color="purple" className="mb-2">Update Result</Badge>
          <div className="text-xs text-gray-500 font-mono mt-1">{match.label || `Match #${match.id}`}</div>
        </div>
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex flex-col items-center flex-1">
            <TeamAvatar name={displayHome} size="lg" />
            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase truncate max-w-[90px] text-center">{displayHome}</p>
            <button onClick={() => handleForfeit("home")} className="mt-2 text-[9px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-tighter">ชนะบาย (20-0)</button>
            <input type="number" value={h} onChange={e => setH(e.target.value)} className="mt-2 w-16 h-12 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-black text-white focus:border-orange-500 outline-none tabular-nums transition-colors" placeholder="-" autoFocus />
          </div>
          <div className="text-gray-700 text-xl font-black">VS</div>
          <div className="flex flex-col items-center flex-1">
            <TeamAvatar name={displayAway} size="lg" />
            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase truncate max-w-[90px] text-center">{displayAway}</p>
            <button onClick={() => handleForfeit("away")} className="mt-2 text-[9px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-tighter">ชนะบาย (20-0)</button>
            <input type="number" value={a} onChange={e => setA(e.target.value)} className="mt-2 w-16 h-12 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl font-black text-white focus:border-orange-500 outline-none tabular-nums transition-colors" placeholder="-" />
          </div>
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
        <button onClick={handleSave} disabled={h === "" || a === ""} className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98]">Confirm Result</button>
      </div>
    </div>
  );
}

function ResetMatchModal({ match, onClose, onConfirm }) {
  const displayHome = match.resolvedHome || match.home;
  const displayAway = match.resolvedAway || match.away;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-5">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="font-black text-white text-sm">Reset ผลแมทช์นี้?</p>
          <p className="text-[11px] text-gray-400 mt-2 font-mono">{displayHome} <span className="text-gray-600">vs</span> {displayAway}</p>
          <p className="text-[10px] text-gray-600 mt-1">คะแนนจะถูกลบออก ไม่สามารถกู้คืนได้</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 text-xs font-bold hover:bg-gray-800 transition-colors">ยกเลิก</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors">Reset</button>
        </div>
      </div>
    </div>
  );
}

function ResetAllModal({ onClose, onConfirm }) {
  const [confirm, setConfirm] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-rose-500/40 rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🚨</div>
          <p className="font-black text-white">Reset คะแนนทั้งหมด?</p>
          <p className="text-[10px] text-gray-500 mt-2">ลบผลแมทช์ทุกนัดในระบบ ไม่สามารถกู้คืนได้</p>
          <p className="text-[10px] text-orange-400 mt-3 font-bold">พิมพ์ RESET เพื่อยืนยัน</p>
        </div>
        <input value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-center text-white outline-none focus:border-rose-500 text-xs font-mono mb-4 transition-colors" placeholder="RESET" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 text-xs font-bold hover:bg-gray-800 transition-colors">ยกเลิก</button>
          <button onClick={() => { if (confirm === "RESET") { onConfirm(); onClose(); } }} disabled={confirm !== "RESET"} className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white text-xs font-black transition-colors">Reset ทั้งหมด</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bracket ──────────────────────────────────────────────────────────────────

function BracketNode({ match, isAdmin, onEditScore, onResetScore }) {
  const displayHome = match.resolvedHome || match.home;
  const displayAway = match.resolvedAway || match.away;
  const homeWins = match.played && match.homeScore > match.awayScore;
  const awayWins = match.played && match.homeScore < match.awayScore;
  const isResolved = displayHome !== match.home || displayAway !== match.away;
  const isFinal = match.shortLabel === "FINAL";
  return (
    <div className={`relative z-10 rounded-xl overflow-hidden border shadow-lg w-44 flex-shrink-0 transition-all ${isFinal ? "border-orange-500/50 shadow-orange-900/20" : "border-gray-800 hover:border-gray-600"} bg-gray-900`}>
      <div className={`px-3 py-1.5 flex items-center justify-between border-b ${isFinal ? "border-orange-500/20 bg-orange-950/30" : "border-gray-800 bg-gray-950/40"}`}>
        <span className={`text-[9px] font-black uppercase tracking-wider ${isFinal ? "text-orange-400" : "text-gray-500"}`}>{match.shortLabel}</span>
        <div className="flex items-center gap-1.5">
          {match.played && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          {!match.played && isResolved && <span className="text-[8px] text-blue-400 font-bold">READY</span>}
        </div>
      </div>
      <div className={`flex items-center justify-between px-3 py-2 gap-1 ${homeWins ? "bg-orange-500/10" : ""}`}>
        <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
          <TeamAvatar name={displayHome} size="sm" />
          <span className={`text-[10px] font-bold truncate ${homeWins ? "text-white" : "text-gray-400"}`}>{displayHome}</span>
        </div>
        <span className={`text-[11px] font-black font-mono shrink-0 ${homeWins ? "text-orange-400" : "text-gray-600"}`}>{match.played ? match.homeScore : "—"}</span>
      </div>
      <div className="h-px bg-gray-800 mx-2" />
      <div className={`flex items-center justify-between px-3 py-2 gap-1 ${awayWins ? "bg-orange-500/10" : ""}`}>
        <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
          <TeamAvatar name={displayAway} size="sm" />
          <span className={`text-[10px] font-bold truncate ${awayWins ? "text-white" : "text-gray-400"}`}>{displayAway}</span>
        </div>
        <span className={`text-[11px] font-black font-mono shrink-0 ${awayWins ? "text-orange-400" : "text-gray-600"}`}>{match.played ? match.awayScore : "—"}</span>
      </div>
      {isAdmin && (
        <div className="flex border-t border-gray-800/70">
          <button onClick={() => onEditScore({ ...match, resolvedHome: displayHome, resolvedAway: displayAway })} className="flex-1 py-1.5 text-[9px] text-orange-400 hover:bg-orange-500/10 font-bold transition-colors text-center">
            {match.played ? "✏️ Edit" : "+ Score"}
          </button>
          {match.played && (
            <button onClick={() => onResetScore({ ...match, resolvedHome: displayHome, resolvedAway: displayAway })} className="px-3 py-1.5 text-[9px] text-rose-500 hover:bg-rose-500/10 font-bold transition-colors border-l border-gray-800">✕</button>
          )}
        </div>
      )}
    </div>
  );
}

function BracketTab({ resolvedKo, isAdmin, onEditScore, onResetScore, allGroupDone }) {
  const scrollRef = useRef(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { if (el.scrollLeft > 20) setShowSwipeHint(false); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const m = (id) => resolvedKo.find(x => x.id === id) || {};

  return (
    <div className="space-y-5">
      {allGroupDone ? (
        <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-orange-950/20 px-5 py-4">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-xs font-black text-orange-400 uppercase tracking-widest">รอบกลุ่มจบแล้ว!</p>
              <p className="text-[10px] text-gray-400 mt-0.5">ทีมที่ผ่านเข้ารอบถูกจัดลงสายแข่งขันอัตโนมัติแล้ว</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">รอรอบกลุ่มจบก่อน</p>
              <p className="text-[10px] text-gray-600 mt-0.5">สายแข่งขันจะอัปเดตอัตโนมัติเมื่อทุกแมทช์รอบกลุ่มจบ</p>
            </div>
          </div>
        </div>
      )}

      {/* Swipe hint */}
      {showSwipeHint && (
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest animate-pulse">← เลื่อนดูสาย →</span>
        </div>
      )}

      {/* Scrollable bracket */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-6 -mx-4 px-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex items-start gap-8 min-w-[680px] pt-2">
          {/* QF */}
          <div className="flex flex-col gap-4">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center mb-1">QF</p>
            <div className="flex flex-col gap-4 relative">
              <BracketNode match={m(100)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
              <div className="absolute right-[-20px] top-[25%] bottom-[25%] w-[20px] border-r border-t border-b border-gray-700 rounded-r-lg" />
              <BracketNode match={m(101)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
            </div>
            <div className="flex flex-col gap-4 relative mt-4">
              <BracketNode match={m(102)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
              <div className="absolute right-[-20px] top-[25%] bottom-[25%] w-[20px] border-r border-t border-b border-gray-700 rounded-r-lg" />
              <BracketNode match={m(103)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
            </div>
          </div>

          {/* SF */}
          <div className="flex flex-col gap-32 mt-16">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center -mt-14 mb-2">SF</p>
            <div className="relative">
              <div className="absolute left-[-20px] top-1/2 w-[20px] border-t border-gray-700" />
              <BracketNode match={m(200)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
              <div className="absolute right-[-20px] top-1/2 h-[120px] w-[20px] border-r border-t border-gray-700 rounded-tr-lg" />
            </div>
            <div className="relative">
              <div className="absolute left-[-20px] top-1/2 w-[20px] border-t border-gray-700" />
              <BracketNode match={m(201)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
              <div className="absolute right-[-20px] bottom-1/2 h-[120px] w-[20px] border-r border-b border-gray-700 rounded-br-lg" />
            </div>
          </div>

          {/* Final */}
          <div className="flex flex-col gap-10 mt-44">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center -mt-14 mb-2">FINAL</p>
            <div className="relative">
              <div className="absolute left-[-20px] top-1/2 w-[20px] border-t border-gray-700" />
              <p className="text-[10px] text-yellow-500 font-black uppercase tracking-widest text-center mb-2 animate-pulse">🏆 Grand Final</p>
              <BracketNode match={m(301)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
            </div>
            <div className="relative opacity-70 mt-4">
              <p className="text-[9px] text-center text-gray-600 uppercase mb-2">3rd Place</p>
              <BracketNode match={m(300)} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
        <p className="font-black text-white text-xs mb-3 uppercase tracking-wider">🏆 เงินรางวัล</p>
        {[["🥇 ชนะเลิศ", "20,000 บาท", "text-yellow-300"], ["🥈 รองชนะเลิศ อันดับ 1", "9,000 บาท", "text-gray-300"], ["🥉 รองชนะเลิศ อันดับ 2", "6,000 บาท", "text-orange-400"]].map(([r, p, c]) => (
          <div key={r} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
            <span className="text-xs text-gray-400">{r}</span>
            <span className={`font-black text-sm ${c}`}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ m, isAdmin, onEditScore, onResetScore }) {
  const displayHome = m.resolvedHome || m.home;
  const displayAway = m.resolvedAway || m.away;
  const hw = m.played && m.homeScore > m.awayScore;
  const aw = m.played && m.awayScore > m.homeScore;
  const gc = m.group ? GROUP_COLORS[m.group] : null;
  const sched = MATCH_SCHEDULE[m.id] || {};
  const showTime = sched.time || m.time || "";
  const leftBorder = gc ? gc.ring : "border-l-gray-700";

  return (
    <div className={`relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg hover:border-gray-700 hover:shadow-xl transition-all duration-200 border-l-4 ${leftBorder}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-950/50 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-gray-600 font-mono w-5">#{sched.matchNo || m.id}</span>
          {m.group && gc && <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${gc.badge}`}>กลุ่ม {m.group}</span>}
          {m.shortLabel && !m.group && <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border bg-orange-500/20 text-orange-400 border-orange-500/30">{m.shortLabel}</span>}
          {m.played
            ? <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />จบแล้ว</span>
            : <span className="text-[9px] text-gray-600">รอแข่ง</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          {sched.dateLabel && <span className="text-gray-500">{sched.dateLabel}</span>}
          {showTime && <span className={`px-2 py-0.5 rounded font-bold ${gc ? gc.badge : "bg-gray-800 text-gray-300 border border-gray-700"}`}>{showTime}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <TeamAvatar name={displayHome} size="md" />
          <div className="min-w-0">
            <p className={`text-xs font-bold truncate ${m.played && !hw ? "text-gray-500" : "text-white"}`}>{displayHome}</p>
            {hw && <span className="text-[8px] text-green-400 font-black uppercase">Winner ✓</span>}
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0 min-w-[72px]">
          {m.played ? (
            <div className="flex items-center gap-1 tabular-nums">
              <span className={`text-2xl font-black ${hw ? "text-white" : "text-gray-600"}`}>{m.homeScore}</span>
              <span className="text-gray-700 text-base px-0.5">:</span>
              <span className={`text-2xl font-black ${aw ? "text-white" : "text-gray-600"}`}>{m.awayScore}</span>
            </div>
          ) : (
            <span className="text-lg font-black text-gray-800 tracking-widest">VS</span>
          )}
          {isAdmin && (
            <div className="flex gap-2 mt-0.5">
              <button onClick={() => onEditScore({ ...m, resolvedHome: displayHome, resolvedAway: displayAway })} className="text-[9px] text-orange-400 hover:text-orange-300 font-bold transition-colors">
                {m.played ? "✏️" : "+ Score"}
              </button>
              {m.played && (
                <button onClick={() => onResetScore({ ...m, resolvedHome: displayHome, resolvedAway: displayAway })} className="text-[9px] text-rose-500 hover:text-rose-400 font-bold transition-colors">✕</button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-1 justify-end min-w-0">
          <div className="min-w-0 text-right">
            <p className={`text-xs font-bold truncate ${m.played && !aw ? "text-gray-500" : "text-white"}`}>{displayAway}</p>
            {aw && <span className="text-[8px] text-green-400 font-black uppercase">Winner ✓</span>}
          </div>
          <TeamAvatar name={displayAway} size="md" />
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ matches, isAdmin, onEditScore, onResetScore }) {
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("date");

  const enriched = matches.map(m => ({ ...m, ...enrichMatch(m) })).sort((a, b) => (a.matchNo || 999) - (b.matchNo || 999));
  const groupFilters = [
    { id: "all", label: "ทั้งหมด" }, { id: "A", label: "กลุ่ม A" }, { id: "B", label: "กลุ่ม B" },
    { id: "C", label: "กลุ่ม C" }, { id: "D", label: "กลุ่ม D" }, { id: "ko", label: "Knockout" },
  ];

  const filtered = enriched.filter(m => {
    const gOk = filterGroup === "all" || (filterGroup === "ko" ? m.round > 1 : m.group === filterGroup);
    const sOk = filterStatus === "all" || (filterStatus === "played" ? m.played : !m.played);
    return gOk && sOk;
  });

  const totalPlayed  = enriched.filter(m => m.played).length;
  const totalMatches = enriched.length;

  const byDate = filtered.reduce((acc, m) => {
    const key = m.schedDate || m.date || "TBD";
    const label = m.dateLabel || key;
    if (!acc[key]) acc[key] = { label, matches: [] };
    acc[key].matches.push(m);
    return acc;
  }, {});
  const dateKeys = Object.keys(byDate).sort();

  const byGroup = filtered.reduce((acc, m) => {
    const key = m.group || (m.round === 2 ? "QF" : m.round === 3 ? "SF" : m.round === 4 ? "Final" : "?");
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "ทั้งหมด", value: totalMatches, color: "text-white" },
          { label: "จบแล้ว",  value: totalPlayed,             color: "text-emerald-400" },
          { label: "รอแข่ง",  value: totalMatches - totalPlayed, color: "text-orange-400" },
          { label: "คืบหน้า", value: `${Math.round((totalPlayed / totalMatches) * 100)}%`, color: "text-white" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl py-2.5 hover:border-gray-700 transition-colors">
            <p className={`text-sm font-black ${color}`}>{value}</p>
            <p className="text-[9px] text-gray-500 uppercase">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        {Object.entries(GROUP_COLORS).map(([g, c]) => (
          <div key={g} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
            <span className="text-[10px] text-gray-500 font-bold">กลุ่ม {g}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2.5 h-2.5 rounded bg-orange-500/60" />
          <span className="text-[10px] text-gray-500 font-bold">Knockout</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {groupFilters.map(f => {
            const gc = GROUP_COLORS[f.id];
            const isActive = filterGroup === f.id;
            return (
              <button key={f.id} onClick={() => setFilterGroup(f.id)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? gc ? gc.badge : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    : "bg-gray-900 text-gray-600 border-gray-800 hover:border-gray-600 hover:text-gray-400"
                }`}>
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1.5 flex-1">
            {[["all","ทั้งหมด","text-white"], ["played","จบแล้ว","text-emerald-400"], ["pending","รอแข่ง","text-orange-400"]].map(([v,l,tc]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${filterStatus === v ? `bg-gray-800 ${tc} border-gray-700` : "border-transparent text-gray-600 hover:text-gray-400"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shrink-0">
            <button onClick={() => setViewMode("date")} className={`px-2.5 py-1.5 text-[10px] font-bold transition-colors ${viewMode === "date" ? "bg-gray-700 text-white" : "text-gray-600"}`}>📅</button>
            <button onClick={() => setViewMode("group")} className={`px-2.5 py-1.5 text-[10px] font-bold transition-colors ${viewMode === "group" ? "bg-gray-700 text-white" : "text-gray-600"}`}>🏷</button>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-600 text-xs font-mono">ไม่พบแมทช์ที่ตรงเงื่อนไข</div>
      )}

      {viewMode === "date" && dateKeys.map(dk => {
        const { label, matches: dayMatches } = byDate[dk];
        const dayDone    = dayMatches.every(m => m.played);
        const dayOngoing = !dayDone && dayMatches.some(m => m.played);
        return (
          <div key={dk} className="space-y-2">
            <div className="flex items-center gap-3 sticky top-[57px] z-20 bg-[#050505]/95 backdrop-blur py-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black ${dayDone ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : dayOngoing ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-gray-900 border-gray-800 text-gray-400"}`}>
                📅 {label}
                {dayDone && <span className="text-[9px]">✓ จบแล้ว</span>}
              </div>
              <span className="text-[9px] text-gray-700 font-mono">{dayMatches.filter(m => m.played).length}/{dayMatches.length} แมทช์</span>
            </div>
            {dayMatches.map(m => <MatchCard key={m.id} m={m} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />)}
          </div>
        );
      })}

      {viewMode === "group" && Object.entries(byGroup).sort(([a],[b]) => a.localeCompare(b)).map(([grp, grpMatches]) => {
        const gc = GROUP_COLORS[grp];
        return (
          <div key={grp} className="space-y-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black ${gc ? gc.badge : "bg-orange-500/10 border-orange-500/20 text-orange-400"}`}>
              {gc ? `กลุ่ม ${grp}` : grp}
              <span className="ml-auto text-[9px] opacity-60">{grpMatches.filter(m => m.played).length}/{grpMatches.length}</span>
            </div>
            {grpMatches.map(m => <MatchCard key={m.id} m={m} isAdmin={isAdmin} onEditScore={onEditScore} onResetScore={onResetScore} />)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────────────

function StandingsTab({ standings }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(GROUP_COLORS).map(([g, c]) => (
          <div key={g} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
            <span className="text-[10px] text-gray-500 font-bold">กลุ่ม {g}</span>
          </div>
        ))}
        <span className="ml-auto text-[10px] text-gray-600">🟠 = ผ่านรอบ</span>
      </div>

      {Object.entries(standings).map(([group, teams]) => {
        const gc = GROUP_COLORS[group];
        return (
          <div key={group} className={`border rounded-3xl overflow-hidden shadow-2xl bg-gray-900 ${gc.ring}`} style={{ borderLeftWidth: "4px" }}>
            <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${gc.header} border-b border-gray-800`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${gc.icon} flex items-center justify-center text-xl font-black text-white shadow-lg`}>{group}</div>
                <div>
                  <h3 className={`font-black text-sm uppercase tracking-widest ${gc.dot.replace('bg-','text-')}`}>Group {group}</h3>
                  <p className="text-[10px] text-gray-500">อันดับ 1-2 ผ่านรอบ</p>
                </div>
              </div>
              <Badge color="gray">{teams.filter(t => t.played > 0).length > 0 ? `${teams.reduce((s,t)=>s+t.played,0)/2}/${teams.length*(teams.length-1)/2} แมทช์` : "ยังไม่เริ่ม"}</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-950/60 border-b border-gray-800">
                    <th className="px-4 py-3 text-left w-10"><span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">#</span></th>
                    <th className="px-4 py-3 text-left"><span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Team</span></th>
                    <th className="px-3 py-3 text-center w-12"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">P</span></th>
                    <th className="px-3 py-3 text-center w-12"><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">W</span></th>
                    <th className="px-3 py-3 text-center w-12"><span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">L</span></th>
                    <th className="px-3 py-3 text-center w-14"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">+/-</span></th>
                    <th className="px-4 py-3 text-center w-16"><span className="text-[10px] font-black text-white uppercase tracking-widest">PTS</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {teams.map((t, i) => {
                    const qualified = i < 2;
                    const diff = t.pf - t.pa;
                    return (
                      <tr key={t.team} className={`transition-colors duration-150 group ${qualified ? "hover:bg-white/[0.03] bg-orange-500/[0.03]" : "hover:bg-white/[0.02]"}`}>
                        <td className="px-4 py-4">
                          <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black transition-transform group-hover:scale-110 ${i === 0 ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" : i === 1 ? "bg-gray-400 text-black shadow-sm" : "text-gray-700 bg-gray-800/50"}`}>{i + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <TeamAvatar name={t.team} size="md" />
                            <div>
                              <div className={`text-sm font-bold leading-tight ${qualified ? "text-white" : "text-gray-400"}`}>{t.team}</div>
                              {qualified && <span className={`text-[8px] font-black uppercase tracking-wide ${gc.dot.replace('bg-','text-')}`}>Qualified ✓</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center"><span className="text-sm font-bold text-gray-400 tabular-nums font-mono">{t.played}</span></td>
                        <td className="px-3 py-4 text-center"><span className={`text-sm font-black tabular-nums font-mono ${t.wins > 0 ? "text-emerald-400" : "text-gray-600"}`}>{t.wins}</span></td>
                        <td className="px-3 py-4 text-center"><span className={`text-sm font-bold tabular-nums font-mono ${t.losses > 0 ? "text-rose-400" : "text-gray-600"}`}>{t.losses}</span></td>
                        <td className="px-3 py-4 text-center">
                          <span className={`text-sm font-black tabular-nums font-mono ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-gray-600"}`}>
                            {diff > 0 ? "+" : ""}{diff}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-xl font-black tabular-nums font-mono ${qualified ? gc.dot.replace('bg-','text-') : "text-gray-600"}`}>
                            {t.pts}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("standings");
  const [prevTab, setPrevTab] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);
  const [scoreModal, setScoreModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [toast, setToast] = useState(null);

  const switchTab = (newTab) => {
    if (newTab === tab) return;
    setPrevTab(tab);
    setTab(newTab);
  };

  useEffect(() => {
    const dataRef = ref(db, "tournament_data");
    const unsub = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAppData(data);
        setLastSyncTime(Date.now());
      } else {
        set(dataRef, { teams: DEFAULT_TEAMS, groupMatches: generateGroupMatches(DEFAULT_TEAMS), koMatches: KO_TEMPLATE });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSaveScore = (id, h, a, date, time) => {
    const isGroup = id < 100;
    const path = isGroup ? "groupMatches" : "koMatches";
    const idx = appData[path].findIndex(m => m.id === id);
    const updates = {};
    updates[`tournament_data/${path}/${idx}/homeScore`] = h;
    updates[`tournament_data/${path}/${idx}/awayScore`] = a;
    updates[`tournament_data/${path}/${idx}/played`] = true;
    updates[`tournament_data/${path}/${idx}/date`] = date;
    updates[`tournament_data/${path}/${idx}/time`] = time;
    update(ref(db), updates).then(() => setToast({ message: "✅ บันทึกผลแล้ว", type: "success" }));
  };

  const handleResetMatch = (id) => {
    const isGroup = id < 100;
    const path = isGroup ? "groupMatches" : "koMatches";
    const idx = appData[path].findIndex(m => m.id === id);
    const updates = {};
    updates[`tournament_data/${path}/${idx}/homeScore`] = null;
    updates[`tournament_data/${path}/${idx}/awayScore`] = null;
    updates[`tournament_data/${path}/${idx}/played`] = false;
    update(ref(db), updates).then(() => setToast({ message: "🗑️ Reset แมทช์แล้ว", type: "info" }));
  };

  const handleResetAll = () => {
    const fresh = { teams: appData.teams || DEFAULT_TEAMS, groupMatches: generateGroupMatches(appData.teams || DEFAULT_TEAMS), koMatches: KO_TEMPLATE };
    set(ref(db, "tournament_data"), fresh).then(() => setToast({ message: "🚨 Reset ทั้งหมดแล้ว", type: "error" }));
  };

  // ── Loading skeleton ──
  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Header skeleton */}
      <header className="relative z-10 pt-12 pb-6 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <SkeletonPulse className="h-3 w-40 mx-auto rounded-full" />
          <SkeletonPulse className="h-10 w-72 mx-auto" />
          <SkeletonPulse className="h-2.5 w-48 mx-auto" />
        </div>
      </header>

      {/* Progress card skeleton */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 mb-6">
        <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-5">
          <SkeletonPulse className="h-1.5 w-full rounded-full mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonPulse className="h-12 rounded-xl" />
            <SkeletonPulse className="h-12 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 mb-6">
        <div className="max-w-2xl mx-auto px-4 flex h-14" />
      </div>

      {/* Content skeleton */}
      <main className="relative z-10 max-w-2xl mx-auto px-4">
        <SkeletonStandings />
      </main>
    </div>
  );

  const { teams, groupMatches, koMatches } = appData;
  const standings = computeStandings(teams, groupMatches);
  const { resolved: resolvedKo, allGroupDone } = resolveKoMatches(koMatches, standings, groupMatches);
  const allMatches = [...groupMatches, ...resolvedKo];
  const progress = Math.round((allMatches.filter(m => m.played).length / (allMatches.length || 1)) * 100);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      {/* Global animations */}
      <style>{`
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
        .animate-slide-up  { animation: slide-up 0.25s ease-out forwards; }
      `}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 pt-12 pb-6 px-4">
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
          <img src="/logo.png" alt="Logo" className="w-14 h-14 sm:w-20 sm:h-20 object-contain rounded-lg shadow-lg border border-white/10" />
        </div>
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/5 mb-4 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest">Live Tournament System</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter leading-none mb-2">
            BANGMOD CUP #1 <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">2026</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium tracking-wide uppercase">Official Basketball Championship</p>
        </div>
      </header>

      {/* Progress + Countdown card */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 mb-6">
        <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-gray-400 uppercase">Tournament Progress</span>
            <div className="flex items-center gap-3">
              <LastUpdated time={lastSyncTime} />
              <span className="text-xs font-black text-white">{progress}%</span>
            </div>
          </div>
          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-orange-600 to-yellow-400 transition-all duration-1000 ease-out rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-gray-800/50 rounded-xl py-2">
              <p className="text-xs font-black text-white">{groupMatches.filter(m => m.played).length}<span className="text-gray-600 font-normal">/{groupMatches.length}</span></p>
              <p className="text-[9px] text-gray-500 uppercase">Group Stage</p>
            </div>
            <div className={`rounded-xl py-2 transition-colors ${allGroupDone ? "bg-orange-500/10 border border-orange-500/20" : "bg-gray-800/50"}`}>
              <p className={`text-xs font-black ${allGroupDone ? "text-orange-400" : "text-white"}`}>{allGroupDone ? "✅ DONE" : `${Math.round((groupMatches.filter(m => m.played).length / groupMatches.length) * 100)}%`}</p>
              <p className="text-[9px] text-gray-500 uppercase">Qualification</p>
            </div>
          </div>

          {/* ── Countdown ── */}
          <NextMatchCountdown allMatches={allMatches} />

          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 flex-wrap">
              <Badge color="purple">Admin Mode</Badge>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowResetAll(true)} className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black hover:bg-rose-500/20 transition-colors">🚨 Reset ทั้งหมด</button>
                <button onClick={() => setIsAdmin(false)} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 text-[10px] font-bold hover:bg-gray-700 transition-colors">Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Qualify alert */}
      {allGroupDone && tab !== "bracket" && (
        <div className="relative z-10 max-w-2xl mx-auto px-4 mb-4">
          <button onClick={() => switchTab("bracket")} className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-orange-600/10 border border-orange-500/30 hover:bg-orange-600/20 transition-all group">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <div className="text-left">
                <p className="text-xs font-black text-orange-400">รอบกลุ่มจบแล้ว! → ดูสายการแข่งขันรอบต่อไป</p>
                <p className="text-[10px] text-gray-500">ทีมที่ผ่านเข้ารอบถูกจัดสายอัตโนมัติแล้ว</p>
              </div>
            </div>
            <span className="text-orange-400 group-hover:translate-x-1 transition-transform text-lg">→</span>
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 mb-6">
        <div className="max-w-2xl mx-auto px-4 flex">
          <TabBtn active={tab === "standings"} onClick={() => switchTab("standings")} icon="📊">Table</TabBtn>
          <TabBtn active={tab === "schedule"}  onClick={() => switchTab("schedule")}  icon="📅">Matches</TabBtn>
          <TabBtn active={tab === "bracket"}   onClick={() => switchTab("bracket")}   icon="⚡" notify={allGroupDone}>Bracket</TabBtn>
        </div>
      </div>

      {/* Tab content with animations */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 min-h-[50vh]">
        <AnimatedTab active={tab === "standings"}>
          <StandingsTab standings={standings} />
        </AnimatedTab>
        <AnimatedTab active={tab === "schedule"}>
          <ScheduleTab matches={allMatches} isAdmin={isAdmin} onEditScore={setScoreModal} onResetScore={setResetModal} />
        </AnimatedTab>
        <AnimatedTab active={tab === "bracket"}>
          <BracketTab resolvedKo={resolvedKo} isAdmin={isAdmin} onEditScore={setScoreModal} onResetScore={setResetModal} allGroupDone={allGroupDone} />
        </AnimatedTab>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-10">
        <p className="text-[9px] font-mono text-gray-700">POWERED BY BANGMOD CUP</p>
        <button
          onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)}
          className={`mt-4 text-[9px] font-bold uppercase tracking-widest transition-all ${isAdmin ? "text-red-500" : "text-gray-800 opacity-30 hover:opacity-100 hover:text-white"}`}
        >
          {isAdmin ? "Logout Admin" : "Admin Login"}
        </button>
      </footer>

      {/* Modals & Toast */}
      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={() => { setIsAdmin(true); setToast({ message: "🔓 Welcome Admin", type: "success" }); }} />}
      {showResetAll   && <ResetAllModal  onClose={() => setShowResetAll(false)}   onConfirm={handleResetAll} />}
      {scoreModal     && <ScoreModal     match={scoreModal}  onClose={() => setScoreModal(null)}  onSave={handleSaveScore} />}
      {resetModal     && <ResetMatchModal match={resetModal} onClose={() => setResetModal(null)}  onConfirm={() => handleResetMatch(resetModal.id)} />}
      {toast          && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}