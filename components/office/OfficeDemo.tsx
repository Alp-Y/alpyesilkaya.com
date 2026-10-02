"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MEETINGS,
  PEOPLE,
  TEAM,
  TODAY,
  WEEK,
  addMessage,
  addNote,
  assignTask,
  dayName,
  dayNum,
  fmtDay,
  initialState,
  onDay,
  toggleTask,
  type Message,
  type PersonId,
  type State,
} from "@/lib/office/model";
import styles from "./office.module.css";

/**
 * OFFICE COMMUNICATION — interactive demonstration.
 *   01 Messages   the office conversation; send one, or turn one into a task
 *   02 Tasks      give a task to a person with a due day; tick it when it is done
 *   03 Notes      write a note against a day
 *   04 Calendar   the week: meetings, task due days and notes together
 * Everything runs in the browser on a synthetic example office (lib/office).
 */

const FRESH_MS = 2400;

export default function OfficeDemo() {
  const [st, setSt] = useState<State>(() => initialState());
  const [text, setText] = useState("");
  const [task, setTask] = useState<{ title: string; to: PersonId; due: string; from?: string }>({ title: "", to: "qs", due: WEEK[2] });
  const [note, setNote] = useState({ text: "", day: WEEK[3] });
  const [fresh, setFresh] = useState<string[]>([]);
  const [hot, setHot] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const threadRef = useRef<HTMLUListElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  // a new message scrolls the conversation to its end
  useEffect(() => {
    const el = threadRef.current;
    if (el && st.seq > 0) el.scrollTop = el.scrollHeight;
  }, [st.messages.length, st.seq]);

  /** light a new entry up for a moment, where it is listed and on the calendar */
  const flash = (id: string) => {
    setFresh((f) => [...f, id]);
    timers.current.push(window.setTimeout(() => setFresh((f) => f.filter((x) => x !== id)), FRESH_MS));
  };
  const nextId = (prefix: string) => `${prefix}-N${st.seq + 1}`;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setSt((s) => addMessage(s, t));
    setText("");
  };
  /** 01 → 02: a message becomes the task being written */
  const fromMessage = (m: Message) => {
    setTask((t) => ({ ...t, title: m.text.replace(/\.$/, ""), from: m.id }));
    titleRef.current?.focus({ preventScroll: window.innerWidth >= 1000 });
  };
  const assign = () => {
    const title = task.title.trim();
    if (!title) return;
    flash(nextId("T"));
    setSt((s) => assignTask(s, { ...task, title }));
    setTask((t) => ({ ...t, title: "", from: undefined }));
  };
  const save = () => {
    if (!note.text.trim()) return;
    flash(nextId("N"));
    setSt((s) => addNote(s, note.text, note.day));
    setNote((n) => ({ ...n, text: "" }));
  };
  const reset = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setSt(initialState());
    setText("");
    setTask({ title: "", to: "qs", due: WEEK[2] });
    setNote({ text: "", day: WEEK[3] });
    setFresh([]);
    setHot(null);
  };

  const taskOf = (messageId: string) => st.tasks.find((t) => t.from === messageId);
  const open = st.tasks.filter((t) => !t.done).length;
  const onCalendar = useMemo(() => st.tasks.length + st.notes.length + MEETINGS.length, [st]);
  const source = task.from ? st.messages.find((m) => m.id === task.from) : undefined;

  return (
    <div className={styles.app} id="ofc-demo">
      <div className={styles.grid}>
        {/* 01 ------------------------------------------------------------ */}
        <section className={styles.cellThread} aria-labelledby="ofc-h-msg">
          <StepHead n="01" id="ofc-h-msg" title="Messages" note="Technical office" />
          <ul className={styles.thread} ref={threadRef}>
            {st.messages.map((m) => {
              const made = taskOf(m.id);
              return (
                <li key={m.id} className={styles.msg} data-mine={m.from === "me"} data-picked={task.from === m.id}>
                  <Avatar id={m.from} />
                  <div className={styles.msgBody}>
                    <span className={styles.meta}>
                      {PEOPLE[m.from].role} <em>{m.time}</em>
                    </span>
                    <p>{m.text}</p>
                    {made ? (
                      <span className={styles.madeTask}>
                        <span className={styles.tick}>✓</span> Task for {PEOPLE[made.to].role.toLowerCase()}, due {fmtDay(made.due)}
                      </span>
                    ) : (
                      <button type="button" className={styles.toTask} onClick={() => fromMessage(m)} aria-pressed={task.from === m.id}>
                        Make it a task <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className={styles.compose}>
            <input
              className={styles.input}
              type="text"
              value={text}
              placeholder="Write to the office"
              aria-label="Message"
              maxLength={160}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button type="button" className={styles.apply} disabled={!text.trim()} onClick={send}>
              Send <span className="arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* 02 ------------------------------------------------------------ */}
        <section className={styles.cellTasks} aria-labelledby="ofc-h-task">
          <StepHead n="02" id="ofc-h-task" title="Assign a task" note={`${open} open`} />
          <div className={styles.form} data-kind="task">
            <input
              ref={titleRef}
              className={styles.input}
              type="text"
              value={task.title}
              placeholder="What needs doing?"
              aria-label="Task"
              maxLength={120}
              onChange={(e) => setTask((t) => ({ ...t, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && assign()}
            />
            {source && (
              <p className={styles.source}>
                From the message by the {PEOPLE[source.from].role.toLowerCase()}, {source.time}
              </p>
            )}
            <div className={styles.pick} role="group" aria-label="Assign to">
              <span className={styles.pickLabel}>To</span>
              {TEAM.map((p) => (
                <button key={p} type="button" className={styles.person} aria-pressed={task.to === p} onClick={() => setTask((t) => ({ ...t, to: p }))} title={PEOPLE[p].role}>
                  <Avatar id={p} />
                  <span className="sr-only">{PEOPLE[p].role}</span>
                </button>
              ))}
              <span className={styles.who}>{PEOPLE[task.to].role}</span>
            </div>
            <Days label="Due" value={task.due} onPick={(due) => setTask((t) => ({ ...t, due }))} />
            <button type="button" className={styles.primary} disabled={!task.title.trim()} onClick={assign}>
              Assign <span className="arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <ul className={styles.tasks}>
            {st.tasks.map((t) => (
              <li key={t.id} className={styles.task} data-done={t.done} data-fresh={fresh.includes(t.id)} data-hot={hot === t.id} onPointerEnter={() => setHot(t.id)} onPointerLeave={() => setHot(null)}>
                <button type="button" className={styles.check} role="checkbox" aria-checked={t.done} aria-label={`${t.title}: done`} onClick={() => setSt((s) => toggleTask(s, t.id))}>
                  {t.done && "✓"}
                </button>
                <span className={styles.taskText}>
                  <b>{t.title}</b>
                  <small>{PEOPLE[t.to].role}</small>
                </span>
                <Avatar id={t.to} />
                <span className={styles.due}>
                  {dayName(t.due)} {dayNum(t.due)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 03 ------------------------------------------------------------ */}
        <section className={styles.cellNotes} aria-labelledby="ofc-h-note">
          <StepHead n="03" id="ofc-h-note" title="Take a note" note={`${st.notes.length} ${st.notes.length === 1 ? "note" : "notes"}`} />
          <div className={styles.form} data-kind="note">
            <textarea
              className={`${styles.input} ${styles.area}`}
              value={note.text}
              rows={3}
              placeholder={"First line is the title\nThen the points to keep"}
              aria-label="Note"
              maxLength={400}
              onChange={(e) => setNote((n) => ({ ...n, text: e.target.value }))}
            />
            <Days label="Day" value={note.day} onPick={(day) => setNote((n) => ({ ...n, day }))} />
            <button type="button" className={styles.primary} disabled={!note.text.trim()} onClick={save}>
              Save note <span className="arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <ul className={styles.notes}>
            {st.notes.map((n) => (
              <li key={n.id} className={styles.note} data-fresh={fresh.includes(n.id)} data-hot={hot === n.id} onPointerEnter={() => setHot(n.id)} onPointerLeave={() => setHot(null)}>
                <span className={styles.noteHead}>
                  <b>{n.title}</b>
                  <span className={styles.due}>
                    {dayName(n.day)} {dayNum(n.day)}
                  </span>
                </span>
                {n.lines.length > 0 && (
                  <ul>
                    {n.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 04 ------------------------------------------------------------ */}
        <section className={styles.cellWeek} aria-labelledby="ofc-h-week">
          <div className={styles.weekBar}>
            <StepHead n="04" id="ofc-h-week" title="Calendar" note={`${fmtDay(WEEK[0])} to ${fmtDay(WEEK[4])}`} />
            <span className={styles.status} aria-live="polite">
              <b>{onCalendar}</b> on the calendar
              <span className={styles.keys}>
                <span data-kind="meeting">
                  <i />
                  Meeting
                </span>
                <span data-kind="task">
                  <i />
                  Task due
                </span>
                <span data-kind="note">
                  <i />
                  Note
                </span>
              </span>
            </span>
            <button type="button" className={styles.replay} onClick={reset}>
              ↻ Reset example
            </button>
          </div>
          <div className={styles.weekWrap}>
            <div className={styles.week}>
              {WEEK.map((day) => {
                const items = onDay(day, st.tasks, st.notes);
                return (
                  <div key={day} className={styles.day} data-today={day === TODAY}>
                    <span className={styles.dayHead}>
                      {dayName(day)} <b className="num">{dayNum(day)}</b>
                      {day === TODAY && <em>Today</em>}
                    </span>
                    {items.map((it) => (
                      <span
                        key={it.id}
                        className={styles.item}
                        data-kind={it.kind}
                        data-done={it.done === true}
                        data-fresh={fresh.includes(it.id)}
                        data-hot={hot === it.id}
                        onPointerEnter={() => it.kind !== "meeting" && setHot(it.id)}
                        onPointerLeave={() => setHot(null)}
                      >
                        <b>{it.title}</b>
                        <small>{it.kind === "task" ? PEOPLE[st.tasks.find((t) => t.id === it.id)!.to].role : it.sub}</small>
                      </span>
                    ))}
                    {items.length === 0 && <span className={styles.empty}>Nothing yet</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Avatar({ id }: { id: PersonId }) {
  return (
    <span className={styles.avatar} style={{ "--p": PEOPLE[id].color } as React.CSSProperties} aria-hidden="true">
      {PEOPLE[id].short}
    </span>
  );
}

/** Pick one day of the week. */
function Days({ label, value, onPick }: { label: string; value: string; onPick: (day: string) => void }) {
  return (
    <div className={styles.pick} role="group" aria-label={label}>
      <span className={styles.pickLabel}>{label}</span>
      {WEEK.map((d) => (
        <button key={d} type="button" className={styles.dayPick} aria-pressed={value === d} onClick={() => onPick(d)} aria-label={fmtDay(d)}>
          {dayName(d)}
          <b className="num">{dayNum(d)}</b>
        </button>
      ))}
    </div>
  );
}

function StepHead({ n, id, title, note }: { n: string; id: string; title: string; note?: string }) {
  return (
    <h3 className={styles.step} id={id}>
      <span className="num accent">{n}</span>
      <span className={styles.stepTitle}>{title}</span>
      {note && <span className={styles.stepNote}>{note}</span>}
    </h3>
  );
}
