"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bbox,
  chainageRange,
  CLASS_IDS,
  CLASSES,
  fmtQty,
  getDrawing,
  identify,
  identifyOrder,
  length,
  levelRange,
  nextTag,
  OPTIONS,
  quantity,
  rows as exportRows,
  SHAPE_LABEL,
  STATUSES,
  ZONES,
  type ClassId,
  type Idents,
  type RawEnt,
  type Status,
  type Zone,
} from "@/lib/terminal/model";
import TerminalDrawing, { FULL, sx, sy, type ViewBox } from "./TerminalDrawing";
import styles from "./terminal.module.css";

/**
 * CAD TERMINAL — interactive demonstration.
 *   01 Drawing          the example drawing and its command line: pick a grey
 *                       object, tell it what it is; or type a command
 *   02 Properties       the project information on the selected object
 *   03 Project browser  every structure, by type, zone or status: click to find it
 *   04 Export           only the structures you want, with their project information
 * Everything runs in the browser on a synthetic example drawing (lib/terminal).
 */

type Line = { k: "cmd" | "out" | "ok" | "err"; text: string; tag?: string; c?: string };

const FILE = "example-road.dwg";
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** a view that frames one object, in the sheet's proportion */
function frame(e: RawEnt): ViewBox {
  const b = bbox(e);
  const aspect = FULL.w / FULL.h;
  let w = Math.max(200, b.x1 - b.x0 + 80);
  let h = Math.max(b.y1 - b.y0 + 40, w / aspect);
  w = h * aspect;
  if (w > FULL.w) {
    w = FULL.w;
    h = FULL.h;
  }
  const cx = (sx(b.x0) + sx(b.x1)) / 2;
  const cy = (sy(b.y0) + sy(b.y1)) / 2;
  return { x: Math.min(Math.max(FULL.x, cx - w / 2), FULL.x + FULL.w - w), y: Math.min(Math.max(FULL.y, cy - h / 2), FULL.y + FULL.h - h), w, h };
}

export default function TerminalDemo() {
  const ents = getDrawing();
  const byId = useMemo(() => new Map(ents.map((e) => [e.id, e])), [ents]);

  const [ids, setIdsState] = useState<Idents>({});
  const idsRef = useRef<Idents>({});
  const setIds = useCallback((next: Idents) => {
    idsRef.current = next;
    setIdsState(next);
  }, []);

  const [selected, setSelected] = useState<string | null>(null);
  const [retype, setRetype] = useState(false);
  const [focus, setFocus] = useState<{ label: string; ids: Set<string> } | null>(null);
  const [fresh, setFresh] = useState<{ id: string; n: number } | null>(null);
  const [reopening, setReopening] = useState(false);
  const [log, setLog] = useState<Line[]>([
    { k: "cmd", text: `Command: OPEN ${FILE}` },
    { k: "out", text: `${ents.length} objects on layers 0, C-TOPO and SURVEY. None of them is a structure yet.` },
  ]);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLElement>(null);
  const script = useRef(0); // bumps when the visitor takes over from a running sequence

  /* ---------- the view: tweened between the whole sheet and one structure ---------- */
  const [view, setViewState] = useState<ViewBox>(FULL);
  const viewRef = useRef<ViewBox>(FULL);
  const viewAnim = useRef(0);
  const zoomTo = useCallback((to: ViewBox) => {
    const from = viewRef.current;
    const token = ++viewAnim.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    const step = (now: number) => {
      if (token !== viewAnim.current) return;
      const t = reduce ? 1 : Math.min(1, (now - t0) / 650);
      const k = ease(t);
      const v = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, w: from.w + (to.w - from.w) * k, h: from.h + (to.h - from.h) * k };
      viewRef.current = v;
      setViewState(v);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);
  const zoomed = view.w < FULL.w - 1;

  /* ---------- log ---------- */
  const say = useCallback((...lines: Line[]) => setLog((l) => [...l, ...lines].slice(-60)), []);
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  /* ---------- the one thing the tool is about ---------- */
  const doIdentify = useCallback(
    (e: RawEnt, cls: ClassId, how: "pick" | "type" | "auto" = "pick") => {
      const before = idsRef.current[e.id];
      const next = identify(idsRef.current, e, cls);
      setIds(next);
      const it = next[e.id];
      setFresh((f) => ({ id: e.id, n: (f?.n ?? 0) + 1 }));
      const c = CLASSES[cls];
      const lv = levelRange(e);
      if (how !== "type") say({ k: "cmd", text: `Command: IDENTIFY ${c.label.toUpperCase()}` });
      say({
        k: "ok",
        text: `${before ? `${before.tag} is now ` : `${SHAPE_LABEL[e.shape]} → `}${c.label} {tag} · ${it.zone} · ${chainageRange(e)} · ${lv ? `levels ${lv[0].toFixed(2)} to ${lv[1].toFixed(2)}` : fmtQty(quantity(e, cls), c.unit)}`,
        tag: it.tag,
        c: c.color,
      });
    },
    [say, setIds],
  );

  const select = useCallback(
    (id: string | null, zoom = false) => {
      setSelected(id);
      setRetype(false);
      setTip(null);
      if (id && zoom) zoomTo(frame(byId.get(id)!));
    },
    [byId, zoomTo],
  );

  const identifyRest = useCallback(async () => {
    const token = ++script.current;
    const todo = identifyOrder().filter((e) => !idsRef.current[e.id]);
    if (!todo.length) return say({ k: "out", text: "Everything in the drawing is already identified." });
    say({ k: "cmd", text: "Command: IDENTIFY ALL" });
    setFocus(null);
    zoomTo(FULL);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const e of todo) {
      if (token !== script.current) return;
      setSelected(e.id);
      if (!reduce) await wait(170);
      if (token !== script.current) return;
      doIdentify(e, e.truth, "type");
    }
    setSelected(null);
    say({ k: "out", text: `${Object.keys(idsRef.current).length} structures, all kept in ${FILE}. Try REOPEN, FIND MH-02 or the export below.` });
  }, [doIdentify, say, zoomTo]);

  const reopen = useCallback(async () => {
    ++script.current;
    const n = Object.keys(idsRef.current).length;
    say({ k: "cmd", text: `Command: CLOSE ${FILE}` }, { k: "cmd", text: `Command: OPEN ${FILE}` });
    setSelected(null);
    setFocus(null);
    setReopening(true);
    zoomTo(FULL);
    await wait(650);
    setReopening(false);
    say(
      n
        ? { k: "ok", text: `Read ${n} structure${n === 1 ? "" : "s"} back from the drawing. Nothing to identify twice.` }
        : { k: "out", text: "Nothing identified yet, so there was nothing to remember. Identify something, then try again." },
    );
  }, [say, zoomTo]);

  const reset = useCallback(() => {
    ++script.current;
    setIds({});
    setSelected(null);
    setFocus(null);
    zoomTo(FULL);
    say({ k: "cmd", text: "Command: RESET" }, { k: "out", text: `Back to ${ents.length} plain objects.` });
  }, [ents.length, say, setIds, zoomTo]);

  /* ---------- plays once when the tool comes into view: two objects, then it's yours ---------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const token = ++script.current;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const demo = identifyOrder();
        const first = [demo.find((d) => d.truth === "kerb")!, demo.find((d) => d.truth === "manhole")!];
        for (const d of first) {
          await wait(reduce ? 0 : 800);
          if (token !== script.current) return;
          setSelected(d.id);
          await wait(reduce ? 0 : 700);
          if (token !== script.current) return;
          doIdentify(d, d.truth);
        }
        await wait(reduce ? 0 : 600);
        if (token !== script.current) return;
        setSelected(null);
        say({ k: "out", text: "Your turn: pick a grey object in the drawing, or type IDENTIFY ALL." });
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      // cancel whatever is still playing (these are counters, not DOM refs)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      script.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      viewAnim.current++;
    };
  }, [doIdentify, say]);

  /* ---------- pointer ---------- */
  const onPick = useCallback(
    (id: string | null) => {
      ++script.current;
      select(id);
      if (id) {
        const e = byId.get(id)!;
        const it = idsRef.current[id];
        say({ k: "cmd", text: `Select object: ${it ? `${it.tag} (${CLASSES[it.cls].label})` : `${e.cad} on layer ${e.layer}`}` });
      }
    },
    [byId, say, select],
  );
  const onHover = useCallback((id: string | null, ev?: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!id || !ev || !stage) return setTip(null);
    const r = stage.getBoundingClientRect();
    const x = Math.max(4, Math.min(ev.clientX - r.left + 14, r.width - 196));
    const y = ev.clientY - r.top + 14;
    setTip({ id, x, y: y > r.height - 80 ? y - 96 : y });
  }, []);

  /* ---------- derived ---------- */
  const count = Object.keys(ids).length;
  const sel = selected ? byId.get(selected)! : null;
  const selIdent = selected ? ids[selected] : undefined;
  const allRows = useMemo(() => exportRows(ids), [ids]);
  const shown = allRows;

  const groups = useMemo(() => {
    const idd = ents.filter((e) => ids[e.id]);
    const list: { key: string; label: string; color?: string; items: RawEnt[] }[] = CLASS_IDS.map((c) => ({
      key: c,
      label: CLASSES[c].plural,
      color: CLASSES[c].color,
      items: idd.filter((e) => ids[e.id].cls === c),
    }));
    for (const g of list) g.items.sort((a, b) => ids[a.id].tag.localeCompare(ids[b.id].tag));
    return list.filter((g) => g.items.length);
  }, [ents, ids]);

  const update = (patch: Partial<{ zone: Zone; status: Status }>) => {
    if (!selected || !selIdent) return;
    setIds({ ...idsRef.current, [selected]: { ...selIdent, ...patch } });
    const [k, v] = Object.entries(patch)[0];
    say({ k: "cmd", text: `Command: SET ${selIdent.tag} ${k.toUpperCase()} "${v}"` }, { k: "ok", text: `{tag} ${k} is now ${v}. Saved with the drawing.`, tag: selIdent.tag, c: CLASSES[selIdent.cls].color });
  };

  const download = () => {
    const head = ["ID", "Structure", "Package", "Zone", "Chainage", "Status", "Quantity", "Unit", "Levels"];
    const esc = (v: string) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const body = shown.map((r) => [r.tag, CLASSES[r.cls].label, r.pkg, r.zone, r.chainage, r.status, r.unit === "nr" ? String(r.qty) : r.qty.toFixed(2), r.unit, r.note].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cad-terminal-export.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say({ k: "cmd", text: "Command: EXPORT" }, { k: "ok", text: `${shown.length} rows written to cad-terminal-export.csv` });
  };

  const tipEnt = tip ? byId.get(tip.id) : null;
  const tipId = tip ? ids[tip.id] : undefined;

  return (
    <div className={styles.app} id="ct-demo">
      <div className={styles.grid}>
        {/* 01 ------------------------------------------------------------ */}
        <section className={styles.cellView} aria-labelledby="ct-h-view">
          <StepHead n="01" id="ct-h-view" title="Drawing" note={FILE} />
          <div className={styles.viewBar}>
            <p className={styles.counts} aria-live="polite">
              <span>
                <b className="num">{ents.length}</b> objects
              </span>
              <span className={count ? styles.ok : undefined}>
                <b className="num">{count}</b> structures
              </span>
              <span>
                <b className="num">{ents.length - count}</b> to identify
              </span>
            </p>
            <div className={styles.tools}>
              <button type="button" className={styles.go} onClick={() => void identifyRest()} disabled={count === ents.length}>
                Identify the rest
              </button>
              <button type="button" onClick={() => void reopen()}>
                Reopen drawing
              </button>
              <button type="button" onClick={reset} disabled={!count}>
                Start over
              </button>
            </div>
          </div>

          <div className={styles.stage} ref={stageRef} data-reopen={reopening}>
            <TerminalDrawing ents={ents} ids={ids} view={view} selected={selected} focus={focus?.ids ?? null} fresh={fresh} onPick={onPick} onHover={onHover} />
            {focus && (
              <p className={styles.stageNote}>
                Showing <b>{focus.label}</b> ·{" "}
                <button type="button" className={styles.linkBtn} style={{ pointerEvents: "auto" }} onClick={() => setFocus(null)}>
                  show all
                </button>
              </p>
            )}
            {zoomed && (
              <button type="button" className={styles.zoomOut} onClick={() => zoomTo(FULL)}>
                Zoom extents
              </button>
            )}
            {tip && tipEnt && (
              <div className={styles.tip} style={{ left: tip.x, top: tip.y, ...(tipId ? ({ "--c": CLASSES[tipId.cls].color } as React.CSSProperties) : {}) }} role="status">
                <span className={styles.tipKind}>{tipId ? CLASSES[tipId.cls].label : "Not identified"}</span>
                <b>{tipId ? tipId.tag : `${tipEnt.cad} · layer ${tipEnt.layer}`}</b>
                {tipId ? `${tipId.zone} · ${tipId.status}` : "Click to identify it"}
                <div className={styles.tipQty}>{tipId ? fmtQty(quantity(tipEnt, tipId.cls), CLASSES[tipId.cls].unit) : rawValue(tipEnt)}</div>
              </div>
            )}
          </div>

        </section>

        {/* 02 + 03 ------------------------------------------------------- */}
        <section className={`${styles.cellSide} ${styles.side}`} aria-label="Properties and project browser">
          <div>
            <StepHead n="02" id="ct-h-props" title="Properties" />
            <div className={styles.props}>
              {!sel ? (
                <p className={styles.propsEmpty}>Click a grey object in the drawing and pick what it is.</p>
              ) : !selIdent || retype ? (
                <>
                  <div className={styles.objHead}>
                    <span className={styles.swatch} aria-hidden="true" />
                    <b>{SHAPE_LABEL[sel.shape]}</b>
                    <span className={styles.pill}>{selIdent ? selIdent.tag : "Not identified"}</span>
                  </div>
                  <dl className={styles.kv}>
                    <dt>Object</dt>
                    <dd>{sel.cad}</dd>
                    <dt>Layer</dt>
                    <dd>{sel.layer}</dd>
                  </dl>
                  <p className={styles.mono} style={{ margin: "4px 0 0" }}>
                    This is a
                  </p>
                  <div className={styles.choices}>
                    {OPTIONS[sel.shape].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={styles.choice}
                        aria-pressed={selIdent?.cls === c}
                        style={{ "--c": CLASSES[c].color } as React.CSSProperties}
                        onClick={() => {
                          ++script.current;
                          setRetype(false);
                          doIdentify(sel, c);
                        }}
                      >
                        <span className={styles.swatch} aria-hidden="true" />
                        {CLASSES[c].label}
                        <em>{selIdent?.cls === c ? selIdent.tag : nextTag(ids, c)}</em>
                      </button>
                    ))}
                  </div>
                  {retype && (
                    <button type="button" className={styles.linkBtn} onClick={() => setRetype(false)}>
                      ← Keep it as it is
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className={styles.objHead} style={{ "--c": CLASSES[selIdent.cls].color } as React.CSSProperties}>
                    <span className={styles.swatch} aria-hidden="true" />
                    <b>{selIdent.tag}</b>
                    <span className={styles.pill} data-on="true">
                      Saved
                    </span>
                  </div>
                  <dl className={styles.kv}>
                    <dt>Structure</dt>
                    <dd>{CLASSES[selIdent.cls].label}</dd>
                    <dt>Zone</dt>
                    <dd>
                      <select aria-label="Zone" value={selIdent.zone} onChange={(e) => update({ zone: e.target.value as Zone })}>
                        {ZONES.map((z) => (
                          <option key={z}>{z}</option>
                        ))}
                      </select>
                    </dd>
                    <dt>Status</dt>
                    <dd>
                      <select aria-label="Status" value={selIdent.status} onChange={(e) => update({ status: e.target.value as Status })}>
                        {STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </dd>
                    <dt>Quantity</dt>
                    <dd className="num">{fmtQty(quantity(sel, selIdent.cls), CLASSES[selIdent.cls].unit)}</dd>
                  </dl>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <button type="button" className={styles.linkBtn} onClick={() => setRetype(true)}>
                      Change type
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <StepHead n="03" id="ct-h-browser" title="Structures" />
            <ul className={styles.tree}>
              {groups.map((g) => {
                const on = focus?.label === g.label;
                return (
                  <li key={g.key} className={styles.group}>
                    <button
                      type="button"
                      className={styles.groupHead}
                      aria-pressed={on}
                      style={g.color ? ({ "--c": g.color } as React.CSSProperties) : undefined}
                      onClick={() => {
                        setFocus(on ? null : { label: g.label, ids: new Set(g.items.map((e) => e.id)) });
                        zoomTo(FULL);
                      }}
                      title={on ? "Show everything" : `Show only ${g.label.toLowerCase()}`}
                    >
                      <span className={styles.swatch} aria-hidden="true" />
                      {g.label}
                      <b>{g.items.length}</b>
                    </button>
                    <ul className={styles.items}>
                      {g.items.map((e) => {
                        const it = ids[e.id];
                        return (
                          <li key={e.id}>
                            <button
                              type="button"
                              className={styles.item}
                              aria-current={selected === e.id}
                              style={{ "--c": CLASSES[it.cls].color } as React.CSSProperties}
                              onClick={() => {
                                ++script.current;
                                select(e.id, true);
                              }}
                            >
                              <b>{it.tag}</b>
                              {it.status}
                              <span>{chainageRange(e).split(" to ")[0]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* 04 ------------------------------------------------------------ */}
        <section className={styles.cellExport} aria-labelledby="ct-h-export" ref={exportRef}>
          <StepHead n="04" id="ct-h-export" title="Export" note={`${shown.length} structures`} />
          <div className={styles.exportBar}>
            <button type="button" className={styles.primary} onClick={download} disabled={!shown.length}>
              Download CSV <span className="arrow" aria-hidden="true">↓</span>
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Structure</th>
                  <th scope="col">Zone</th>
                  <th scope="col">Status</th>
                  <th scope="col">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    aria-selected={selected === r.id}
                    style={{ "--c": CLASSES[r.cls].color } as React.CSSProperties}
                    onClick={() => select(r.id, true)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select(r.id, true))}
                  >
                    <td>
                      <b>{r.tag}</b>
                    </td>
                    <td>{CLASSES[r.cls].label}</td>
                    <td>{r.zone}</td>
                    <td className={styles.status} data-s={r.status}>
                      {r.status}
                    </td>
                    <td className="num">{fmtQty(r.qty, r.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <p className={styles.empty}>Identify a few objects first.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function rawValue(e: RawEnt) {
  if (e.shape === "line") return `${length(e.pts).toFixed(2)} m`;
  if (e.shape === "dot") return `${e.pts[0][0].toFixed(2)}, ${e.pts[0][1].toFixed(2)}`;
  if (e.shape === "tin") return `${e.tris!.length} triangles`;
  return `${e.levels!.length} points, ${e.levels!.length} texts`;
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
