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
  PACKAGES,
  quantity,
  rawRows,
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
type Group = "class" | "zone" | "status";

const FILE = "example-road.dwg";
const HELP: Line[] = [
  { k: "out", text: "IDENTIFY <type>   identify the selected object (KERB, PIPE, MANHOLE, LIGHT, ASPHALT, DEMOLITION, EXCAVATION)" },
  { k: "out", text: "IDENTIFY ALL      identify everything left, the way the example intends" },
  { k: "out", text: "FIND <id>         find a structure, e.g. FIND MH-02" },
  { k: "out", text: "SHOW <type>       show one type of structure (SHOW ALL to clear)" },
  { k: "out", text: "LIST · EXPORT · REOPEN · RESET · ZOOM · CLEAR" },
];
const WORDS: Record<string, ClassId> = {
  KERB: "kerb",
  KERBS: "kerb",
  PIPE: "pipe",
  PIPES: "pipe",
  MANHOLE: "manhole",
  MANHOLES: "manhole",
  MH: "manhole",
  LIGHT: "light",
  LIGHTS: "light",
  ASPHALT: "asphalt",
  DEMOLITION: "demolition",
  DEMO: "demolition",
  EXCAVATION: "excavation",
  EX: "excavation",
};

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
  const [group, setGroup] = useState<Group>("class");
  const [reopening, setReopening] = useState(false);
  const [log, setLog] = useState<Line[]>([
    { k: "cmd", text: `Command: OPEN ${FILE}` },
    { k: "out", text: `${ents.length} objects on layers 0, C-TOPO and SURVEY. None of them is a structure yet.` },
  ]);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"ct" | "raw">("ct");
  const [pkg, setPkg] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [cmd, setCmd] = useState("");

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

  /* ---------- the command line ---------- */
  const run = (raw: string) => {
    const input = raw.trim().toUpperCase().replace(/\s+/g, " ");
    if (!input) return;
    ++script.current;
    const [verb, ...rest] = input.split(" ");
    const arg = rest.join(" ");
    say({ k: "cmd", text: `Command: ${input}` });
    const sel = selected ? byId.get(selected) : null;
    switch (verb) {
      case "HELP":
      case "?":
        return say(...HELP);
      case "CLEAR":
        return setLog([]);
      case "IDENTIFY":
      case "ID": {
        if (arg === "ALL") return void identifyRest();
        if (!sel) return say({ k: "err", text: "Select an object first (click it in the drawing), then IDENTIFY <type>." });
        const cls = WORDS[arg];
        const opts = OPTIONS[sel.shape];
        if (!cls) return say({ k: "out", text: `A ${SHAPE_LABEL[sel.shape].toLowerCase()} can be: ${opts.map((o) => CLASSES[o].label.toUpperCase()).join(", ")}.` });
        if (!opts.includes(cls)) return say({ k: "err", text: `A ${SHAPE_LABEL[sel.shape].toLowerCase()} can't be a ${CLASSES[cls].label.toLowerCase()}. Try ${opts.map((o) => CLASSES[o].label.toUpperCase()).join(" or ")}.` });
        return doIdentify(sel, cls, "type");
      }
      case "FIND": {
        const hit = Object.entries(idsRef.current).find(([, v]) => v.tag.replace("-", "") === arg.replace("-", ""));
        if (!hit) return say({ k: "err", text: arg ? `No structure called ${arg} yet.` : "FIND what? e.g. FIND MH-02" });
        select(hit[0], true);
        const e = byId.get(hit[0])!;
        return say({ k: "ok", text: `{tag} ${CLASSES[hit[1].cls].label} · ${hit[1].zone} · ${chainageRange(e)} · ${hit[1].status}`, tag: hit[1].tag, c: CLASSES[hit[1].cls].color });
      }
      case "SHOW": {
        if (!arg || arg === "ALL") {
          setFocus(null);
          return say({ k: "out", text: "Showing everything." });
        }
        const cls = WORDS[arg];
        if (!cls) return say({ k: "err", text: `Unknown type ${arg}. Try SHOW KERBS or SHOW MANHOLES.` });
        const set = new Set(Object.entries(idsRef.current).filter(([, v]) => v.cls === cls).map(([k]) => k));
        setFocus({ label: CLASSES[cls].plural, ids: set });
        return say({ k: "out", text: `${set.size} ${CLASSES[cls].plural.toLowerCase()} shown.` });
      }
      case "LIST": {
        const all = Object.values(idsRef.current);
        if (!all.length) return say({ k: "out", text: "No structures yet." });
        return say(
          ...CLASS_IDS.filter((c) => all.some((a) => a.cls === c)).map<Line>((c) => ({
            k: "out",
            text: `${CLASSES[c].plural.padEnd(20)} ${all
              .filter((a) => a.cls === c)
              .map((a) => a.tag)
              .sort()
              .join(" ")}`,
          })),
          { k: "out", text: `${ents.length - all.length} objects not identified.` },
        );
      }
      case "EXPORT":
        exportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return say({ k: "out", text: `${Object.keys(idsRef.current).length} structures ready to export, below.` });
      case "REOPEN":
      case "OPEN":
        return void reopen();
      case "RESET":
        return reset();
      case "ZOOM":
      case "Z":
      case "ZE":
        select(null);
        return zoomTo(FULL);
      default:
        return say({ k: "err", text: `Unknown command ${verb}. Type HELP.` });
    }
  };

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
  const shown = allRows.filter((r) => (!pkg || r.pkg === pkg) && (!zone || r.zone === zone) && (!status || r.status === status));
  const raws = useMemo(() => rawRows(), []);

  const groups = useMemo(() => {
    const idd = ents.filter((e) => ids[e.id]);
    const list: { key: string; label: string; color?: string; items: RawEnt[] }[] =
      group === "class"
        ? CLASS_IDS.map((c) => ({ key: c, label: CLASSES[c].plural, color: CLASSES[c].color, items: idd.filter((e) => ids[e.id].cls === c) }))
        : group === "zone"
          ? ZONES.map((z) => ({ key: z, label: z, items: idd.filter((e) => ids[e.id].zone === z) }))
          : STATUSES.map((s) => ({ key: s, label: s, items: idd.filter((e) => ids[e.id].status === s) }));
    for (const g of list) g.items.sort((a, b) => ids[a.id].tag.localeCompare(ids[b.id].tag));
    return list.filter((g) => g.items.length);
  }, [ents, group, ids]);
  const unidentified = ents.filter((e) => !ids[e.id]);

  const update = (patch: Partial<{ zone: Zone; status: Status }>) => {
    if (!selected || !selIdent) return;
    setIds({ ...idsRef.current, [selected]: { ...selIdent, ...patch } });
    const [k, v] = Object.entries(patch)[0];
    say({ k: "cmd", text: `Command: SET ${selIdent.tag} ${k.toUpperCase()} "${v}"` }, { k: "ok", text: `{tag} ${k} is now ${v}. Saved with the drawing.`, tag: selIdent.tag, c: CLASSES[selIdent.cls].color });
  };

  const unidentify = () => {
    if (!selected || !selIdent) return;
    const next = { ...idsRef.current };
    delete next[selected];
    setIds(next);
    say({ k: "cmd", text: `Command: UNIDENTIFY ${selIdent.tag}` }, { k: "out", text: `${selIdent.tag} is a plain ${SHAPE_LABEL[sel!.shape].toLowerCase()} again.` });
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

          <div className={styles.console}>
            <div className={styles.history} ref={historyRef} aria-live="polite">
              {log.map((l, i) => (
                <p key={i} data-k={l.k}>
                  {l.tag ? (
                    <>
                      {l.text.split("{tag}")[0]}
                      <i style={{ "--c": l.c } as React.CSSProperties}>{l.tag}</i>
                      {l.text.split("{tag}")[1]}
                    </>
                  ) : (
                    l.text
                  )}
                </p>
              ))}
            </div>
            <form
              className={styles.prompt}
              onSubmit={(e) => {
                e.preventDefault();
                run(cmd);
                setCmd("");
              }}
            >
              <span aria-hidden="true">Command:</span>
              <label className="sr-only" htmlFor="ct-cmd">
                CAD Terminal command. Type HELP for the list.
              </label>
              <input
                id="ct-cmd"
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                placeholder={sel && !selIdent ? `e.g. IDENTIFY ${CLASSES[OPTIONS[sel.shape][0]].label.split(" ")[0].toUpperCase()}` : "e.g. FIND MH-01, SHOW KERBS or HELP"}
              />
            </form>
            <div className={styles.chips} aria-label="Suggested commands">
              {["IDENTIFY ALL", "FIND MH-02", "SHOW KERBS", "LIST", "REOPEN", "HELP"].map((c) => (
                <button key={c} type="button" onClick={() => run(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 02 + 03 ------------------------------------------------------- */}
        <section className={`${styles.cellSide} ${styles.side}`} aria-label="Properties and project browser">
          <div>
            <StepHead n="02" id="ct-h-props" title="Properties" />
            <div className={styles.props}>
              {!sel ? (
                <p className={styles.propsEmpty}>Pick any object in the drawing. A grey one is still just geometry: tell CAD Terminal what it is, and it becomes a structure.</p>
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
                    <dt>Handle</dt>
                    <dd className="num">{sel.handle}</dd>
                    <dt>{sel.shape === "line" ? "Length" : sel.shape === "dot" ? "Position" : "Contains"}</dt>
                    <dd className="num">{rawValue(sel)}</dd>
                  </dl>
                  <p className={styles.mono} style={{ margin: "4px 0 0" }}>
                    Identify as
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
                      Kept in drawing
                    </span>
                  </div>
                  <dl className={styles.kv}>
                    <dt>Structure</dt>
                    <dd>{CLASSES[selIdent.cls].label}</dd>
                    <dt>Package</dt>
                    <dd>{CLASSES[selIdent.cls].pkg}</dd>
                    <dt>Zone</dt>
                    <dd>
                      <select aria-label="Zone" value={selIdent.zone} onChange={(e) => update({ zone: e.target.value as Zone })}>
                        {ZONES.map((z) => (
                          <option key={z}>{z}</option>
                        ))}
                      </select>
                    </dd>
                    <dt>Chainage</dt>
                    <dd className="num">{chainageRange(sel)}</dd>
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
                    {levelRange(sel) && (
                      <>
                        <dt>Levels</dt>
                        <dd className="num">
                          {levelRange(sel)![0].toFixed(2)} to {levelRange(sel)![1].toFixed(2)}
                        </dd>
                      </>
                    )}
                    <dt>From</dt>
                    <dd className="num">
                      {sel.cad} · {sel.handle}
                    </dd>
                  </dl>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <button type="button" className={styles.linkBtn} onClick={() => setRetype(true)}>
                      Change type
                    </button>
                    <button type="button" className={styles.linkBtn} onClick={unidentify}>
                      Unidentify
                    </button>
                    <button type="button" className={styles.linkBtn} onClick={() => zoomTo(frame(sel))}>
                      Zoom to it
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <StepHead n="03" id="ct-h-browser" title="Project browser" />
            <div className={styles.segmented} role="group" aria-label="Group structures by">
              {(["class", "zone", "status"] as Group[]).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {g === "class" ? "Type" : g}
                </button>
              ))}
            </div>
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
                              {group !== "class" ? CLASSES[it.cls].label : it.status}
                              <span>{chainageRange(e).split(" to ")[0]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
              {unidentified.length > 0 && (
                <li className={styles.group}>
                  <p className={styles.groupHead} style={{ cursor: "default" }}>
                    <span className={styles.swatch} aria-hidden="true" />
                    Not identified
                    <b>{unidentified.length}</b>
                  </p>
                  <ul className={styles.items}>
                    {unidentified.map((e) => (
                      <li key={e.id}>
                        <button type="button" className={styles.item} aria-current={selected === e.id} onClick={() => onPick(e.id)}>
                          {e.cad}
                          <span>{e.handle}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* 04 ------------------------------------------------------------ */}
        <section className={styles.cellExport} aria-labelledby="ct-h-export" ref={exportRef}>
          <StepHead n="04" id="ct-h-export" title="Export" note={mode === "ct" ? `${shown.length} of ${allRows.length} structures` : `${raws.length} objects`} />
          <div className={styles.exportBar}>
            <div className={styles.segmented} role="group" aria-label="Export" style={{ flex: "none" }}>
              <button type="button" aria-pressed={mode === "ct"} onClick={() => setMode("ct")}>
                CAD Terminal export
              </button>
              <button type="button" aria-pressed={mode === "raw"} onClick={() => setMode("raw")}>
                Plain CAD export
              </button>
            </div>
            {mode === "ct" && (
              <button type="button" className={styles.primary} onClick={download} disabled={!shown.length}>
                Download CSV <span className="arrow" aria-hidden="true">↓</span>
              </button>
            )}
          </div>

          {mode === "ct" ? (
            <>
              <div className={styles.exportBar}>
                <Chips label="Package" all="All packages" values={PACKAGES} value={pkg} onChange={setPkg} present={new Set(allRows.map((r) => r.pkg))} />
                <Chips label="Zone" all="All zones" values={ZONES} value={zone} onChange={(v) => setZone(v as Zone | null)} present={new Set(allRows.map((r) => r.zone))} />
                <Chips label="Status" all="Any status" values={STATUSES} value={status} onChange={(v) => setStatus(v as Status | null)} present={new Set(allRows.map((r) => r.status))} />
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Structure</th>
                      <th scope="col">Package</th>
                      <th scope="col">Zone</th>
                      <th scope="col">Chainage</th>
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
                        <td>{r.pkg}</td>
                        <td>{r.zone}</td>
                        <td>{r.chainage}</td>
                        <td className={styles.status} data-s={r.status}>
                          {r.status}
                        </td>
                        <td className="num">
                          {fmtQty(r.qty, r.unit)}
                          {r.note && <small style={{ display: "block", fontSize: 10, color: "var(--text-3)" }}>{r.note}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!shown.length && <p className={styles.empty}>{allRows.length ? "Nothing matches these filters." : "Nothing to export yet: identify a few objects in the drawing first."}</p>}
              </div>
              {shown.length > 0 && (
                <p className={styles.sum}>
                  {CLASS_IDS.filter((c) => shown.some((r) => r.cls === c)).map((c) => {
                    const rs = shown.filter((r) => r.cls === c);
                    return (
                      <span key={c}>
                        {CLASSES[c].plural}: <b className="num">{fmtQty(rs.reduce((s, r) => s + r.qty, 0), CLASSES[c].unit)}</b>
                      </span>
                    );
                  })}
                </p>
              )}
            </>
          ) : (
            <>
              <p className={styles.compareNote}>The same drawing through a plain data extraction: object types, layers and handles. Nothing in it says which line is a kerb or which surface is being broken out.</p>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.rawTable}`}>
                  <thead>
                    <tr>
                      <th scope="col">Handle</th>
                      <th scope="col">Object</th>
                      <th scope="col">Layer</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raws.map((r) => (
                      <tr key={r.handle}>
                        <td>{r.handle}</td>
                        <td>{r.cad}</td>
                        <td>{r.layer}</td>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <p className={styles.fine}>
        The example drawing is synthetic and everything runs in your browser. In the demonstration, &ldquo;Reopen drawing&rdquo; stands in for closing and opening the DWG: the structures come back with it.
      </p>
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

function Chips({ label, all, values, value, onChange, present }: { label: string; all: string; values: string[]; value: string | null; onChange: (v: string | null) => void; present: Set<string> }) {
  return (
    <div className={styles.filters} role="group" aria-label={label}>
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
        {all}
      </button>
      {values.map((v) => (
        <button key={v} type="button" aria-pressed={value === v} disabled={!present.has(v)} onClick={() => onChange(value === v ? null : v)}>
          {v}
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
