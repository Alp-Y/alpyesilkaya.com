"use client";

import { useEffect, useRef, useState } from "react";
import { MESSAGES, PEOPLE, TEAM, TODAY, WEEK, addNote, assignTask, dayName, dayNum, fmtDay, initialState, onDay, toggleTask, type Message, type PersonId, type State } from "@/lib/office/model";
import styles from "./office.module.css";

/**
 * OFFICE COMMUNICATION — interactive demonstration.
 *   01 Messages   the office conversation; pick one to make it a task
 *   02 Task       one owner and a due day
 *   03 Note       written against a day
 *   04 Calendar   the week: meetings, task due days and notes together;
 *                 a task is ticked off where it sits
 * Everything runs in the browser on a synthetic example office (lib/office).
 */

const FRESH_MS = 2200;
const EMPTY_TASK: { title: string; to: PersonId; due: string; from?: string } = { title: "", to: "qs", due: WEEK[2] };

export default function OfficeDemo() {
  const [st, setSt] = useState<State>(() => initialState());
  const [task, setTask] = useState(EMPTY_TASK);
  const [note, setNote] = useState({ title: "", day: WEEK[1] });
  const [fresh, setFresh] = useState<string[]>([]);
  const timers = useRef<number[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  /** light a new entry up for a moment on the calendar */
  const flash = (id: string) => {
    setFresh((f) => [...f, id]);
    timers.current.push(window.setTimeout(() => setFresh((f) => f.filter((x) => x !== id)), FRESH_MS));
  };

  /** 01 → 02: a message becomes the task being written */
  const pick = (m: Message) => {
    setTask((t) => ({ ...t, title: m.ask, from: m.id }));
    titleRef.current?.focus({ preventScroll: window.innerWidth >= 1000 });
  };
  const assign = () => {
    const title = task.title.trim();
    if (!title) return;
    flash(`T-N${st.seq + 1}`);
    setSt((s) => assignTask(s, { ...task, title }));
    setTask((t) => ({ ...t, title: "", from: undefined }));
  };
  const save = () => {
    const title = note.title.trim();
    if (!title) return;
    flash(`N-N${st.seq + 1}`);
    setSt((s) => addNote(s, title, note.day));
    setNote((n) => ({ ...n, title: "" }));
  };
  const reset = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setSt(initialState());
    setTask(EMPTY_TASK);
    setNote({ title: "", day: WEEK[1] });
    setFresh([]);
  };

  return (
    <div className={styles.app} id="ofc-demo">
      <div className={styles.grid}>
        {/* 01 ------------------------------------------------------------ */}
        <section className={styles.cellThread} aria-labelledby="ofc-h-msg">
          <StepHead n="01" id="ofc-h-msg" title="Messages" />
          <ul className={styles.thread}>
            {MESSAGES.map((m) => {
              const made = st.tasks.find((t) => t.from === m.id);
              return (
                <li key={m.id}>
                  <button type="button" className={styles.msg} disabled={!!made} aria-pressed={task.from === m.id} onClick={() => pick(m)}>
                    <Avatar id={m.from} />
                    <span className={styles.msgBody}>
                      <span className={styles.meta}>
                        {PEOPLE[m.from].role} <em>{m.time}</em>
                      </span>
                      <span className={styles.text}>{m.text}</span>
                      {made ? (
                        <span className={styles.made}>
                          ✓ Task · {PEOPLE[made.to].short} · {dayName(made.due)} {dayNum(made.due)}
                        </span>
                      ) : (
                        <span className={styles.toTask}>
                          Make it a task <span aria-hidden="true">→</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 02 ------------------------------------------------------------ */}
        <section className={styles.cellTask} aria-labelledby="ofc-h-task">
          <StepHead n="02" id="ofc-h-task" title="Task" note={PEOPLE[task.to].role} />
          <div className={styles.form} data-kind="task">
            <input
              ref={titleRef}
              className={styles.input}
              type="text"
              value={task.title}
              placeholder="What needs doing?"
              aria-label="Task"
              maxLength={80}
              onChange={(e) => setTask((t) => ({ ...t, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && assign()}
            />
            <div className={styles.pick} role="group" aria-label="Assign to">
              <span className={styles.pickLabel}>To</span>
              {TEAM.map((p) => (
                <button key={p} type="button" className={styles.person} aria-pressed={task.to === p} onClick={() => setTask((t) => ({ ...t, to: p }))} title={PEOPLE[p].role}>
                  <Avatar id={p} />
                  <span className="sr-only">{PEOPLE[p].role}</span>
                </button>
              ))}
            </div>
            <Days label="Due" value={task.due} onPick={(due) => setTask((t) => ({ ...t, due }))} />
            <button type="button" className={styles.primary} disabled={!task.title.trim()} onClick={assign}>
              Assign <span className="arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* 03 ------------------------------------------------------------ */}
        <section className={styles.cellNote} aria-labelledby="ofc-h-note">
          <StepHead n="03" id="ofc-h-note" title="Note" />
          <div className={styles.form} data-kind="note">
            <input
              className={styles.input}
              type="text"
              value={note.title}
              placeholder="What to keep?"
              aria-label="Note"
              maxLength={80}
              onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <Days label="Day" value={note.day} onPick={(day) => setNote((n) => ({ ...n, day }))} />
            <button type="button" className={styles.primary} disabled={!note.title.trim()} onClick={save}>
              Save <span className="arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* 04 ------------------------------------------------------------ */}
        <section className={styles.cellWeek} aria-labelledby="ofc-h-week">
          <div className={styles.weekBar}>
            <StepHead n="04" id="ofc-h-week" title="Calendar" note={`${fmtDay(WEEK[0])} to ${fmtDay(WEEK[4])}`} />
            <button type="button" className={styles.replay} onClick={reset}>
              ↻ Reset example
            </button>
          </div>
          <div className={styles.weekWrap}>
            <div className={styles.week} aria-live="polite">
              {WEEK.map((day) => (
                <div key={day} className={styles.day} data-today={day === TODAY}>
                  <span className={styles.dayHead}>
                    {dayName(day)} <b className="num">{dayNum(day)}</b>
                  </span>
                  {onDay(day, st.tasks, st.notes).map((it) => (
                    <span key={it.id} className={styles.item} data-kind={it.kind} data-done={it.done === true} data-fresh={fresh.includes(it.id)}>
                      {it.kind === "task" && (
                        <button type="button" className={styles.check} role="checkbox" aria-checked={it.done === true} aria-label={`${it.title}: done`} onClick={() => setSt((s) => toggleTask(s, it.id))}>
                          {it.done && "✓"}
                        </button>
                      )}
                      <b>{it.title}</b>
                      {it.to && <Avatar id={it.to} />}
                      {it.time && <small>{it.time}</small>}
                    </span>
                  ))}
                </div>
              ))}
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
