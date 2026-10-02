/**
 * OFFICE COMMUNICATION — the example office behind the demonstrations
 * (Tools preview, tool page). Synthetic data: one week in the technical
 * office of a simplified road contract. People are shown by role, not by name.
 *
 * The idea in code:
 *   messages   the office conversation
 *   tasks      work given to one person, with a due day
 *   notes      written against a day
 *   calendar   one week that shows the meetings, the task due days and the notes together
 *
 * No React here: plain data in, plain data out.
 */

export type PersonId = "tm" | "pe" | "qs" | "se" | "dc" | "me";
export type Kind = "message" | "task" | "note" | "meeting";

export const KIND_COLORS: Record<Kind, string> = {
  message: "#7aa8e6",
  task: "#6fc9c9",
  note: "#b59ce6",
  meeting: "#97a1ad",
};

export const PEOPLE: Record<PersonId, { role: string; short: string; color: string }> = {
  tm: { role: "Technical office manager", short: "TM", color: "#e8dd8a" },
  pe: { role: "Planning engineer", short: "PE", color: "#7aa8e6" },
  qs: { role: "Quantity surveyor", short: "QS", color: "#6fc9c9" },
  se: { role: "Site engineer", short: "SE", color: "#9fd07a" },
  dc: { role: "Document controller", short: "DC", color: "#b59ce6" },
  me: { role: "You", short: "ME", color: "#3ee08f" },
};
/** The people a task can be given to. */
export const TEAM: PersonId[] = ["pe", "qs", "se", "dc", "tm"];

/** The week on the calendar (Monday to Friday). The example's "today" is the Monday. */
export const WEEK = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
export const TODAY = WEEK[0];

export type Message = { id: string; from: PersonId; time: string; text: string };
export type Task = {
  id: string;
  title: string;
  to: PersonId;
  /** the day it is due (ISO date) */
  due: string;
  /** the message it came from, if any */
  from?: string;
  done: boolean;
};
export type Note = { id: string; title: string; lines: string[]; day: string };
export type Meeting = { id: string; title: string; day: string; time: string };

export const MESSAGES: Message[] = [
  { id: "M-1", from: "tm", time: "09:12", text: "Consultant wants the asphalt quantities rechecked by Thursday." },
  { id: "M-2", from: "qs", time: "09:15", text: "I can take the asphalt. The kerbs need the as-built survey first." },
  { id: "M-3", from: "se", time: "09:21", text: "The survey crew is on the kerb line tomorrow morning." },
  { id: "M-4", from: "pe", time: "09:30", text: "The progress meeting is on Wednesday at 10:00." },
];

export const TASKS: Task[] = [
  { id: "T-1", title: "Recheck asphalt quantities", to: "qs", due: WEEK[2], from: "M-1", done: false },
  { id: "T-2", title: "As-built survey, kerb line", to: "se", due: WEEK[1], from: "M-3", done: false },
  { id: "T-3", title: "Issue revised measurement sheets", to: "dc", due: WEEK[3], done: false },
];

export const NOTES: Note[] = [
  { id: "N-1", title: "Progress meeting notes", lines: ["Kerb survey first, then the recheck", "Revised sheets go out on Thursday"], day: WEEK[2] },
];

export const MEETINGS: Meeting[] = [
  { id: "E-0", title: "Week planning", day: WEEK[0], time: "08:30" },
  { id: "E-1", title: "Progress meeting", day: WEEK[2], time: "10:00" },
  { id: "E-2", title: "Weekly report", day: WEEK[4], time: "14:00" },
];

/** The order the preview puts things on the calendar. */
export const CALENDAR_ORDER = ["T-2", "T-1", "N-1", "T-3"];

/* ---------------- the tool page ---------------- */

export type State = { messages: Message[]; tasks: Task[]; notes: Note[]; seq: number };

/** The office as the visitor finds it: the conversation, one task already given out, one note. */
export function initialState(): State {
  return { messages: MESSAGES, tasks: [TASKS[1]], notes: NOTES, seq: 0 };
}

export function addMessage(s: State, text: string): State {
  const n = s.seq + 1;
  const m: Message = { id: `M-N${n}`, from: "me", time: "now", text };
  return { ...s, seq: n, messages: [...s.messages, m] };
}

export function assignTask(s: State, t: { title: string; to: PersonId; due: string; from?: string }): State {
  const n = s.seq + 1;
  return { ...s, seq: n, tasks: [...s.tasks, { ...t, id: `T-N${n}`, done: false }] };
}

export function toggleTask(s: State, id: string): State {
  return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) };
}

export function addNote(s: State, text: string, day: string): State {
  const n = s.seq + 1;
  const [title, ...lines] = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { ...s, seq: n, notes: [...s.notes, { id: `N-N${n}`, title, lines, day }] };
}

/* ---------------- the calendar ---------------- */

export type CalItem = { id: string; kind: "meeting" | "task" | "note"; title: string; sub: string; done?: boolean };

/** Everything that falls on one day: meetings first, then task due days, then notes. */
export function onDay(day: string, tasks: Task[], notes: Note[]): CalItem[] {
  return [
    ...MEETINGS.filter((m) => m.day === day).map((m): CalItem => ({ id: m.id, kind: "meeting", title: m.title, sub: m.time })),
    ...tasks.filter((t) => t.due === day).map((t): CalItem => ({ id: t.id, kind: "task", title: t.title, sub: PEOPLE[t.to].short, done: t.done })),
    ...notes.filter((n) => n.day === day).map((n): CalItem => ({ id: n.id, kind: "note", title: n.title, sub: "Note" })),
  ];
}

/* ---------------- formatting ---------------- */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};
/** "2026-10-07" → "Wed" */
export const dayName = (iso: string) => DAYS[parts(iso).wd];
/** "2026-10-07" → "07" */
export const dayNum = (iso: string) => String(parts(iso).d).padStart(2, "0");
/** "2026-10-07" → "Wed 07 Oct" */
export const fmtDay = (iso: string) => `${dayName(iso)} ${dayNum(iso)} ${MONTHS[parts(iso).m - 1]}`;
