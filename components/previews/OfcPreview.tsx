"use client";

import { useRef, useState } from "react";
import { CALENDAR_ORDER, MESSAGES, NOTES, PEOPLE, TASKS, TODAY, WEEK, dayName, dayNum, onDay } from "@/lib/office/model";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import styles from "./preview.module.css";
import c from "./ofc.module.css";

/** the conversation → tasks given out → a note → all of it on the week's calendar → result, on repeat */
const PHASES = [
  { label: "Messages", ms: 2200 },
  { label: "Assign", ms: 2600 },
  { label: "Note", ms: 2200 },
  { label: "Calendar", ms: 2400 },
  { label: "Result", ms: 4600 },
];

type Frame = { msg: number; task: number; note: number; cal: number; res: number; fade: number };
const FINAL: Frame = { msg: 1, task: 1, note: 1, cal: 1, res: 1, fade: 1 };
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
/** how many of n things have arrived, a little ahead of time so the last one can be read */
const arrived = (t: number, n: number) => (t <= 0 ? 0 : Math.min(n, Math.floor(t * n * 1.15) + 1));

/**
 * OFFICE COMMUNICATION — homepage preview. The office conversation comes in,
 * tasks are given to people with a due day, a note is written, and then the
 * due days and the note land on the week's calendar. Point at a task, the
 * note or a calendar entry to see where it sits on the other side; press and
 * hold to pause.
 */
export default function OfcPreview({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const { held, heldRef } = useHold(area, "press");
  const [f, setF] = useState<Frame>(FINAL);
  const [hot, setHot] = useState<string | null>(null);

  const { phase, seek } = usePreviewLoop(
    ref,
    PHASES.map((p) => p.ms),
    (p, t, _dt, wrapped) => {
      if (wrapped) setHot(null);
      if (p === 0) setF({ msg: t, task: 0, note: 0, cal: 0, res: 0, fade: Math.min(1, t * 5) });
      else if (p === 1) setF({ msg: 1, task: t, note: 0, cal: 0, res: 0, fade: 1 });
      else if (p === 2) setF({ msg: 1, task: 1, note: t, cal: 0, res: 0, fade: 1 });
      else if (p === 3) setF({ msg: 1, task: 1, note: 1, cal: t, res: 0, fade: 1 });
      else setF({ msg: 1, task: 1, note: 1, cal: 1, res: Math.min(1, t * 2.5), fade: t > 0.93 ? 1 - (t - 0.93) / 0.07 : 1 });
    },
    heldRef,
  );

  const note = NOTES[0];
  const msgs = arrived(f.msg, MESSAGES.length);
  const tasks = arrived(f.task, TASKS.length);
  const typed = Math.round(ease(Math.min(1, f.note * 1.8)) * note.title.length);
  const noteLines = f.note >= 1 ? note.lines.length : f.note > 0.75 ? 2 : f.note > 0.55 ? 1 : 0;
  const placed = CALENDAR_ORDER.slice(0, arrived(f.cal, CALENDAR_ORDER.length));
  const res = held && f.cal >= 1 ? 1 : ease(f.res);
  const people = new Set(TASKS.map((t) => t.to)).size;
  // the messages that became tasks, once their task is there
  const becameTask = (id: string) => TASKS.slice(0, tasks).some((t) => t.from === id);

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={area} className={`${styles.stage} ${c.stage} ${styles.pointable}`} onPointerLeave={() => setHot(null)}>
        <div className={c.inner} style={{ opacity: f.fade }}>
          <div className={c.top}>
            <span className={c.channel}>
              <i aria-hidden="true" />
              Technical office
            </span>
            <span className={c.counts}>
              <span data-show={tasks > 0}>
                <b>{tasks}</b> {tasks === 1 ? "task" : "tasks"} assigned
              </span>
              <span data-show={f.cal > 0}>
                <b className={c.ok}>
                  {placed.length}/{CALENDAR_ORDER.length}
                </b>{" "}
                on the calendar
              </span>
            </span>
          </div>

          <div className={c.main}>
            {/* the conversation */}
            <ul className={c.thread}>
              {MESSAGES.map((m, i) => (
                <li key={m.id} className={c.msg} data-show={i < msgs} data-task={becameTask(m.id)}>
                  <Avatar id={m.from} />
                  <span className={c.msgBody}>
                    <span className={c.meta}>
                      {PEOPLE[m.from].role} <em>{m.time}</em>
                    </span>
                    <span className={c.text}>{m.text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className={c.side}>
              {/* the tasks, each with a person and a due day */}
              <ul className={c.tasks}>
                {TASKS.map((t, i) => (
                  <li
                    key={t.id}
                    className={c.task}
                    data-show={i < tasks}
                    data-placed={placed.includes(t.id)}
                    data-hot={hot === t.id}
                    onPointerEnter={() => setHot(t.id)}
                    onPointerLeave={() => setHot(null)}
                  >
                    <i className={c.box} aria-hidden="true" />
                    <span className={c.taskTitle}>{t.title}</span>
                    <Avatar id={t.to} />
                    <span className={c.due}>
                      {dayName(t.due)} {dayNum(t.due)}
                    </span>
                  </li>
                ))}
              </ul>
              {/* the note */}
              <div
                className={c.note}
                data-show={f.note > 0}
                data-placed={placed.includes(note.id)}
                data-hot={hot === note.id}
                onPointerEnter={() => setHot(note.id)}
                onPointerLeave={() => setHot(null)}
              >
                <span className={c.noteHead}>
                  <b>
                    {note.title.slice(0, typed)}
                    {f.note > 0 && f.note < 0.56 && <i className={c.caret} aria-hidden="true" />}
                  </b>
                  <span className={c.due}>
                    {dayName(note.day)} {dayNum(note.day)}
                  </span>
                </span>
                {note.lines.map((l, i) => (
                  <span key={l} className={c.noteLine} data-show={i < noteLines}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* the week: meetings, then what the office just put on it */}
          <div className={c.week}>
            {WEEK.map((day) => (
              <div key={day} className={c.day} data-today={day === TODAY}>
                <span className={c.dayHead}>
                  {dayName(day)} <b>{dayNum(day)}</b>
                </span>
                {onDay(day, TASKS, NOTES).map((it) => (
                  <span
                    key={it.id}
                    className={c.chip}
                    data-kind={it.kind}
                    data-show={it.kind === "meeting" || placed.includes(it.id)}
                    data-hot={hot === it.id}
                    onPointerEnter={() => it.kind !== "meeting" && setHot(it.id)}
                    onPointerLeave={() => setHot(null)}
                  >
                    {it.title}
                  </span>
                ))}
              </div>
            ))}
          </div>

          {/* before the result: what is in the office */}
          <p className={c.legend} style={{ opacity: 1 - res }} aria-hidden={res > 0.5}>
            <span data-kind="message">
              <i />
              Messages
            </span>
            <span data-kind="task">
              <i />
              Tasks
            </span>
            <span data-kind="note">
              <i />
              Notes
            </span>
            <span data-kind="meeting">
              <i />
              Meetings
            </span>
          </p>

          {/* the result */}
          <dl className={c.result} style={{ opacity: res, transform: `translate3d(0, ${(1 - res) * 8}px, 0)` }}>
            <div>
              <dt>Messages</dt>
              <dd className="num">{MESSAGES.length}</dd>
            </div>
            <div>
              <dt>Tasks assigned</dt>
              <dd className="num">
                {TASKS.length}
                <em>to {people} people</em>
              </dd>
            </div>
            <div>
              <dt>On the calendar</dt>
              <dd className={`num ${c.ok}`}>
                {CALENDAR_ORDER.length}
                <em>
                  {TASKS.length} due days · {NOTES.length} note
                </em>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <PreviewBar
        labels={PHASES.map((p) => p.label)}
        durations={PHASES.map((p) => p.ms)}
        phase={phase}
        held={held}
        hint={f.task >= 1 ? "Point at a task" : undefined}
        onSeek={(i) => {
          setHot(null);
          seek(i);
        }}
        name={title}
      />
    </div>
  );
}

function Avatar({ id }: { id: keyof typeof PEOPLE }) {
  return (
    <span className={c.avatar} style={{ "--p": PEOPLE[id].color } as React.CSSProperties} title={PEOPLE[id].role}>
      {PEOPLE[id].short}
    </span>
  );
}
