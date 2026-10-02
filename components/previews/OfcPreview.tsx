"use client";

import { useRef, useState } from "react";
import { MESSAGES, NOTE, PEOPLE, TASK, TODAY, WEEK, dayName, dayNum } from "@/lib/office/model";
import { PreviewBar } from "./SqePreview";
import { usePreviewLoop } from "./usePreviewLoop";
import { useHold } from "./useHold";
import styles from "./preview.module.css";
import c from "./ofc.module.css";

/** a message → the task it becomes → a note → both on the week's calendar, on repeat */
const PHASES = [
  { label: "Message", ms: 1700 },
  { label: "Task", ms: 2200 },
  { label: "Note", ms: 1900 },
  { label: "Calendar", ms: 5200 },
];

type Frame = { msg: number; task: number; note: number; cal: number; fade: number };
const FINAL: Frame = { msg: 1, task: 1, note: 1, cal: 1, fade: 1 };
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/**
 * OFFICE COMMUNICATION — homepage preview, drawn as one small diagram.
 * A message comes in and becomes a task with one owner and a due day; a
 * note is written against a day; leader lines then carry both down to the
 * week's calendar. Point at the task or the note to find it on the
 * calendar; press and hold to pause.
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
      if (p === 0) setF({ msg: t, task: 0, note: 0, cal: 0, fade: Math.min(1, t * 5) });
      else if (p === 1) setF({ msg: 1, task: t, note: 0, cal: 0, fade: 1 });
      else if (p === 2) setF({ msg: 1, task: 1, note: t, cal: 0, fade: 1 });
      else setF({ msg: 1, task: 1, note: 1, cal: t, fade: t > 0.94 ? 1 - (t - 0.94) / 0.06 : 1 });
    },
    heldRef,
  );

  const m = MESSAGES[0];
  const typed = Math.round(ease(f.note * 1.6) * NOTE.title.length);
  const arrow = ease(f.task * 3); // message → task
  const drop = ease(f.cal * 4.5); // task and note → calendar
  const landed = f.cal > 0.2;
  const link = (id: string) => ({ "data-hot": hot === id, onPointerEnter: () => setHot(id), onPointerLeave: () => setHot(null) });
  const dash = (p: number) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p });

  return (
    <div ref={ref} className={styles.card} data-held={held}>
      <div ref={area} className={`${styles.stage} ${c.stage} ${styles.pointable}`} onPointerLeave={() => setHot(null)}>
        <div className={c.inner} style={{ opacity: f.fade }}>
          {/* the leader lines: message → task, then task and note → their days */}
          <svg className={c.leaders} viewBox="0 0 72 39.6" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <path d="M22.67 9.6H25.33" {...dash(arrow)} />
            {arrow >= 1 && <path d="M24.7 9.05L25.33 9.6L24.7 10.15" />}
            <path d="M36 16V22" {...dash(drop)} />
            <path d="M59.67 16V19H49.6V22" {...dash(drop)} />
          </svg>

          <div className={c.cards}>
            <div className={c.node} data-kind="message" data-show={f.msg > 0}>
              <span className={c.cap}>
                Message <em>{m.time}</em>
              </span>
              <p className={c.body}>{m.text}</p>
              <span className={c.foot}>
                <Avatar id={m.from} />
                <span className={c.role}>{PEOPLE[m.from].role}</span>
              </span>
            </div>

            <div className={c.node} data-kind="task" data-show={f.task > 0.25} data-landed={landed} {...link(TASK.id)}>
              <span className={c.cap}>
                Task <i className={c.box} aria-hidden="true" />
              </span>
              <p className={c.body}>{TASK.title}</p>
              <span className={c.foot} data-show={f.task > 0.5}>
                <Avatar id={TASK.to} />
                <span className={c.due}>
                  {dayName(TASK.due)} {dayNum(TASK.due)}
                </span>
              </span>
            </div>

            <div className={c.node} data-kind="note" data-show={f.note > 0} data-landed={landed} {...link(NOTE.id)}>
              <span className={c.cap}>Note</span>
              <p className={c.body}>
                {NOTE.title.slice(0, typed)}
                {f.note > 0 && f.note < 0.7 && <i className={c.caret} aria-hidden="true" />}
              </p>
              <span className={c.foot} data-show={f.note > 0.7}>
                <span className={c.due}>
                  {dayName(NOTE.day)} {dayNum(NOTE.day)}
                </span>
              </span>
            </div>
          </div>

          {/* the week they land on */}
          <div className={c.week}>
            {WEEK.map((day) => (
              <div key={day} className={c.day} data-today={day === TODAY}>
                <span className={c.dayHead}>
                  {dayName(day)} <b>{dayNum(day)}</b>
                </span>
                {day === TASK.due && (
                  <span className={c.chip} data-kind="task" data-show={landed} {...link(TASK.id)}>
                    <Avatar id={TASK.to} />
                    {TASK.title}
                  </span>
                )}
                {day === NOTE.day && (
                  <span className={c.chip} data-kind="note" data-show={landed} {...link(NOTE.id)}>
                    {NOTE.title}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <PreviewBar
        labels={PHASES.map((p) => p.label)}
        durations={PHASES.map((p) => p.ms)}
        phase={phase}
        held={held}
        hint={f.task >= 1 ? "Point at the task" : undefined}
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
