/**
 * VIEW CUBE CONTROLLER
 * ------------------------------------------------------------------
 * Owns everything that happens every frame, outside React:
 * renderer + camera, pointer / wheel / keyboard input, raycasting,
 * orbit with inertia, animated view changes, idle drift, compass
 * labels, resize handling and clean-up.
 *
 * Rendering is on demand: a frame is drawn only while something is
 * changing (dragging, inertia, a transition, a hover fade, idle drift)
 * or after a resize. When nothing moves, no frames run at all.
 */

import { OrthographicCamera, Raycaster, Vector2, Vector3, WebGLRenderer } from "three";
import { ViewCubeScene, COMPASS_POINTS, HALF, type Palette } from "./scene";
import {
  HOME,
  MAX_ELEVATION,
  PRESETS,
  anglesForRegion,
  clamp,
  directionFromAngles,
  easeInOutCubic,
  nearestAngle,
  presetForAngles,
  quaternionFromAngles,
  regionKey,
  regionName,
  toDegrees,
  toRadians,
  wrapAngle,
  type OrientationChange,
  type PresetName,
  type Region,
  type ViewAngles,
} from "./orientation";

export type ControllerElements = {
  /** Element the canvas is placed in (its size drives the renderer). */
  stage: HTMLElement;
  /** Focusable wrapper that receives keyboard input. */
  root: HTMLElement;
  /** N / E / S / W label elements, positioned from 3D each frame. */
  compass: Partial<Record<"N" | "E" | "S" | "W", HTMLElement>>;
  /** Small caption under the cube (view name / hovered region). */
  caption?: HTMLElement | null;
  /** Screen-reader live region. */
  live?: HTMLElement | null;
};

export type ControllerOptions = {
  onOrientationChange?: (o: OrientationChange) => void;
  /** Hovered face / edge / corner name (e.g. "TOP · FRONT"), or null. */
  onHover?: (name: string | null) => void;
};

/** World units visible from the centre to the edge of the canvas at zoom 1. */
const FRUSTUM = 2.95;
const CAMERA_DISTANCE = 10;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.6;
const DRAG_THRESHOLD = 5; // px — below this a press is a click
const KEY_STEP = toRadians(15);
const IDLE_DELAY = 6000;
const MAX_SPIN = 0.008; // rad/ms — caps the flick speed (~460°/s)

type Transition = {
  from: ViewAngles & { zoom: number };
  to: ViewAngles & { zoom: number };
  start: number;
  duration: number;
  preset: PresetName | null;
};

export class ViewCubeController {
  private readonly renderer: WebGLRenderer;
  private readonly camera: OrthographicCamera;
  private readonly cube: ViewCubeScene;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly events = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private readonly motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Orientation (radians) — the single source of truth
  private azimuth = HOME.azimuth;
  private elevation = HOME.elevation;
  private zoom = 1;

  // Motion state
  private transition: Transition | null = null;
  private velocity = { az: 0, el: 0 }; // rad / ms, for inertia after a drag
  private idleOffset = { az: 0, el: 0 };
  private idleActive = false;
  private idlePhase = 0;
  private idleTimer = 0;
  private isVisible = true;

  // Pointer state
  private pointers = new Map<number, { x: number; y: number }>();
  private press: { id: number; x: number; y: number; lastX: number; lastY: number; lastT: number } | null = null;
  private dragging = false;
  private preDrag: ViewAngles | null = null;
  private pinch: { distance: number; zoom: number } | null = null;
  private engaged = false; // wheel zooms only after the visitor has interacted with the widget
  private hovered: Region | null = null;

  // Frame loop
  private frame = 0;
  private lastFrameTime = 0;
  private width = 1;
  private height = 1;
  private lastEmitted = "";
  private lastPreset: PresetName | null = "home";
  private disposed = false;

  private readonly _v = new Vector3();
  private readonly _dir = new Vector3();

  constructor(
    private readonly el: ControllerElements,
    palette: Palette,
    private readonly options: ControllerOptions = {},
  ) {
    // Throws if WebGL is unavailable — the React component catches it and keeps the static drawing.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    // Absolutely positioned so the canvas can never push its container bigger (no resize feedback loop)
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = "none"; // only this small canvas stops touch scrolling
    canvas.style.cursor = "grab";

    this.camera = new OrthographicCamera(-FRUSTUM, FRUSTUM, FRUSTUM, -FRUSTUM, 0.1, 100);
    this.cube = new ViewCubeScene(palette);

    el.stage.appendChild(canvas);

    this.resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) this.resize(box.width, box.height);
    });
    this.resizeObserver.observe(el.stage);
    const rect = el.stage.getBoundingClientRect();
    this.resize(rect.width || 200, rect.height || 200);

    this.visibilityObserver = new IntersectionObserver((entries) => {
      this.isVisible = entries[0]?.isIntersecting ?? true;
      if (!this.isVisible) this.stopIdle();
      else this.scheduleIdle();
    });
    this.visibilityObserver.observe(el.root);

    this.bindEvents(canvas);
    this.updateCaption();
    this.scheduleIdle();
    this.requestRender();
  }

  /* ================= public API ================= */

  /** Animate to a named view. */
  goToPreset(name: PresetName) {
    this.goTo(PRESETS[name], { zoom: name === "home" ? 1 : this.zoom, preset: name });
  }

  /** Follow the workspace display mode (wireframe / shaded / analysis). */
  setDisplayMode(mode: "wireframe" | "shaded" | "analysis") {
    this.cube.setDisplayMode(mode);
    this.requestRender();
  }

  /** Home: default isometric view and default zoom. */
  goHome() {
    this.goTo(HOME, { zoom: 1, preset: "home" });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.idleTimer);
    this.events.abort();
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.cube.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    for (const label of Object.values(this.el.compass)) label?.style.removeProperty("transform");
  }

  /* ================= input ================= */

  private bindEvents(canvas: HTMLCanvasElement) {
    const opts = { signal: this.events.signal };
    canvas.addEventListener("pointerdown", this.onPointerDown, opts);
    canvas.addEventListener("pointermove", this.onPointerMove, opts);
    canvas.addEventListener("pointerup", this.onPointerUp, opts);
    canvas.addEventListener("pointercancel", this.onPointerCancel, opts);
    canvas.addEventListener("pointerleave", this.onPointerLeave, opts);
    canvas.addEventListener("lostpointercapture", this.onPointerCancel, opts);
    this.el.root.addEventListener("pointerenter", this.onInteract, opts);
    this.el.root.addEventListener("pointerleave", () => (this.engaged = false), opts);
    this.el.root.addEventListener("wheel", this.onWheel, { signal: this.events.signal, passive: false });
    this.el.root.addEventListener("keydown", this.onKeyDown, opts);
    this.el.root.addEventListener("focus", this.onInteract, opts);
    this.motionQuery.addEventListener("change", () => this.stopIdle(), opts);
    document.addEventListener("visibilitychange", () => (document.hidden ? this.stopIdle() : this.scheduleIdle()), opts);
  }

  private onInteract = () => {
    this.stopIdle();
    this.scheduleIdle();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.onInteract();
    this.engaged = true;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      // Second finger: switch from orbit to pinch-zoom
      const [a, b] = [...this.pointers.values()];
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
      this.press = null;
      this.endDrag(false);
      return;
    }
    if (this.pointers.size > 2) return;

    // Grabbing the cube stops any running transition or inertia exactly where it is
    this.transition = null;
    this.velocity.az = this.velocity.el = 0;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is optional */
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.setZoom(this.pinch.zoom * (d / Math.max(1, this.pinch.distance)));
      return;
    }

    const press = this.press;
    if (press && press.id === e.pointerId) {
      if (!this.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_THRESHOLD) {
        this.dragging = true;
        this.preDrag = { azimuth: this.azimuth, elevation: this.elevation };
        this.cube.setHover(null);
        if (this.hovered) this.options.onHover?.(null);
        this.hovered = null;
        this.cube.setRingEmphasis(true);
        this.setCursor("grabbing");
        this.updateCaption();
      }
      if (this.dragging) {
        // A drag across the whole widget turns the view by 180°.
        const k = Math.PI / Math.max(120, this.width);
        const dx = e.clientX - press.lastX;
        const dy = e.clientY - press.lastY;
        const dt = Math.max(1, e.timeStamp - press.lastT);
        const dAz = -dx * k;
        const dEl = dy * k;
        this.azimuth += dAz;
        this.elevation = clamp(this.elevation + dEl, -MAX_ELEVATION, MAX_ELEVATION);
        // Smoothed velocity for the release
        this.velocity.az = clamp(this.velocity.az * 0.5 + (dAz / dt) * 0.5, -MAX_SPIN, MAX_SPIN);
        this.velocity.el = clamp(this.velocity.el * 0.5 + (dEl / dt) * 0.5, -MAX_SPIN, MAX_SPIN);
        press.lastX = e.clientX;
        press.lastY = e.clientY;
        press.lastT = e.timeStamp;
        this.requestRender();
      }
      return;
    }

    // Plain hover (mouse / pen only — touch has no hover)
    if (e.pointerType !== "touch") this.updateHover(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const press = this.press;
    if (!press || press.id !== e.pointerId) return;
    this.press = null;

    if (this.dragging) {
      // Release: keep the recent velocity only if the pointer was still moving
      const still = e.timeStamp - press.lastT > 80;
      this.endDrag(!still);
      if (e.pointerType !== "touch") this.updateHover(e.clientX, e.clientY);
    } else {
      const region = this.pick(e.clientX, e.clientY);
      if (region) this.selectRegion(region);
    }
  };

  private onPointerCancel = (e: Event) => {
    const id = (e as PointerEvent).pointerId;
    this.pointers.delete(id);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.press && this.press.id === id) {
      this.press = null;
      this.endDrag(false);
    }
  };

  private onPointerLeave = () => {
    if (!this.dragging) {
      this.cube.setHover(null);
      if (this.hovered) this.options.onHover?.(null);
      this.hovered = null;
      this.setCursor("grab");
      this.updateCaption();
      this.requestRender();
    }
  };

  private onWheel = (e: WheelEvent) => {
    // Never hijack page scrolling: zoom only after the visitor has pressed on the
    // widget, or for trackpad pinch (which browsers report as ctrl + wheel).
    if (!this.engaged && !e.ctrlKey) return;
    const next = clamp(this.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(next - this.zoom) < 1e-4) return; // at a limit: let the page scroll
    e.preventDefault();
    this.onInteract();
    this.transition = null;
    this.setZoom(next);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const keyPresets: Record<string, PresetName> = {
      "1": "front",
      "2": "right",
      "3": "back",
      "4": "left",
      "5": "top",
      "6": "bottom",
      "0": "home",
    };
    let handled = true;
    if (keyPresets[e.key]) {
      this.goToPreset(keyPresets[e.key]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const base = this.transition?.to ?? { azimuth: this.azimuth, elevation: this.elevation };
      const dir = e.key === "ArrowLeft" ? 1 : -1;
      this.goTo({ azimuth: base.azimuth + dir * KEY_STEP, elevation: base.elevation }, { duration: 260 });
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const base = this.transition?.to ?? { azimuth: this.azimuth, elevation: this.elevation };
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const elevation = clamp(base.elevation + dir * KEY_STEP, -MAX_ELEVATION, MAX_ELEVATION);
      this.goTo({ azimuth: base.azimuth, elevation }, { duration: 260 });
    } else if (e.key === "+" || e.key === "=") {
      this.setZoom(this.zoom * 1.12);
    } else if (e.key === "-" || e.key === "_") {
      this.setZoom(this.zoom / 1.12);
    } else if (e.key === "Escape") {
      if (this.dragging && this.preDrag) {
        const back = this.preDrag;
        this.press = null;
        this.endDrag(false);
        this.goTo(back, { duration: 300 });
      } else if (this.transition || this.velocity.az || this.velocity.el) {
        // Stop where we are
        this.transition = null;
        this.velocity.az = this.velocity.el = 0;
        this.settle();
      } else {
        handled = false;
      }
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.onInteract();
    }
  };

  /* ================= picking ================= */

  private pick(clientX: number, clientY: number): Region | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.syncCamera();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.cube.tiles, false)[0];
    return hit ? (hit.object.userData.region as Region) : null;
  }

  private updateHover(clientX: number, clientY: number) {
    const region = this.pick(clientX, clientY);
    const key = region ? regionKey(region) : null;
    const prev = this.hovered ? regionKey(this.hovered) : null;
    if (key === prev) return;
    this.hovered = region;
    this.options.onHover?.(region ? regionName(region) : null);
    this.cube.setHover(region);
    this.setCursor(region ? "pointer" : "grab");
    this.updateCaption();
    this.requestRender();
  }

  private selectRegion(region: Region) {
    const angles = anglesForRegion(region);
    this.cube.setActive(region);
    this.goTo(angles, { preset: presetForAngles(angles) });
  }

  /* ================= motion ================= */

  private goTo(
    target: ViewAngles,
    opts: { zoom?: number; preset?: PresetName | null; duration?: number } = {},
  ) {
    this.foldIdle();
    this.velocity.az = this.velocity.el = 0;
    const to = {
      // Go the short way round. Plan views keep FRONT at the bottom (azimuth ≡ 0 mod 360°).
      azimuth: nearestAngle(this.azimuth, target.azimuth),
      elevation: clamp(target.elevation, -MAX_ELEVATION, MAX_ELEVATION),
      zoom: clamp(opts.zoom ?? this.zoom, ZOOM_MIN, ZOOM_MAX),
    };
    const from = { azimuth: this.azimuth, elevation: this.elevation, zoom: this.zoom };

    // Duration grows with the angle travelled: 350–650 ms (almost instant with reduced motion)
    const a = directionFromAngles(from);
    const b = directionFromAngles(to, this._v);
    const angle = Math.acos(clamp(a.dot(b), -1, 1)) + Math.abs(wrapAngle(to.azimuth - from.azimuth)) * 0.25;
    let duration = opts.duration ?? clamp(350 + (angle / Math.PI) * 300, 350, 650);
    if (this.motionQuery.matches) duration = 80;

    this.transition = { from, to, start: performance.now(), duration, preset: opts.preset ?? null };
    this.cube.pulseArc(to.azimuth);
    this.requestRender();
  }

  private setZoom(z: number) {
    const next = clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (next === this.zoom) return;
    this.zoom = next;
    this.requestRender();
  }

  private endDrag(withInertia: boolean) {
    if (!this.dragging) return;
    this.dragging = false;
    this.cube.setRingEmphasis(false);
    this.setCursor(this.hovered ? "pointer" : "grab");
    if (!withInertia || this.motionQuery.matches) {
      this.velocity.az = this.velocity.el = 0;
      this.settle();
    }
    this.requestRender();
  }

  /** Called whenever motion stops: update caption, announce presets, restart idle timer. */
  private settle() {
    // Keep the stored azimuth in (−180°, 180°] so it never grows without bound
    this.azimuth = wrapAngle(this.azimuth);
    const preset = presetForAngles({ azimuth: this.azimuth, elevation: this.elevation });
    if (preset && preset !== this.lastPreset && this.el.live) {
      this.el.live.textContent = `${preset === "home" ? "Home isometric" : preset} view`;
    }
    this.lastPreset = preset;
    this.updateCaption();
    this.scheduleIdle();
  }

  /* ================= idle drift ================= */

  private scheduleIdle() {
    clearTimeout(this.idleTimer);
    if (this.motionQuery.matches || this.disposed) return;
    this.idleTimer = window.setTimeout(() => {
      const preset = presetForAngles({ azimuth: this.azimuth, elevation: this.elevation });
      // Drift only from the home view or a free view — never from an exact plan/elevation view
      const allowed = preset === "home" || preset === null;
      if (allowed && this.isVisible && !document.hidden && !this.dragging && !this.transition) {
        this.idleActive = true;
        this.idlePhase = 0;
        this.requestRender();
      }
    }, IDLE_DELAY);
  }

  private stopIdle() {
    clearTimeout(this.idleTimer);
    this.foldIdle();
  }

  /** Keep the drifted pose as the new resting pose, so stopping never jumps. */
  private foldIdle() {
    if (!this.idleActive && !this.idleOffset.az && !this.idleOffset.el) return;
    this.azimuth += this.idleOffset.az;
    this.elevation = clamp(this.elevation + this.idleOffset.el, -MAX_ELEVATION, MAX_ELEVATION);
    this.idleOffset.az = this.idleOffset.el = 0;
    this.idleActive = false;
  }

  /* ================= frame loop ================= */

  private requestRender = () => {
    if (this.disposed || this.frame) return;
    this.lastFrameTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  };

  private tick = (now: number) => {
    this.frame = 0;
    if (this.disposed) return;
    const dt = Math.min(64, Math.max(0, now - this.lastFrameTime));
    this.lastFrameTime = now;
    let busy = false;

    // 1. Animated view change (turntable interpolation, eased)
    const tr = this.transition;
    if (tr) {
      const t = clamp((now - tr.start) / tr.duration, 0, 1);
      const e = easeInOutCubic(t);
      this.azimuth = tr.from.azimuth + (tr.to.azimuth - tr.from.azimuth) * e;
      this.elevation = tr.from.elevation + (tr.to.elevation - tr.from.elevation) * e;
      this.zoom = tr.from.zoom + (tr.to.zoom - tr.from.zoom) * e;
      if (t >= 1) {
        this.azimuth = tr.to.azimuth;
        this.elevation = tr.to.elevation;
        this.zoom = tr.to.zoom;
        this.transition = null;
        this.settle();
      } else {
        busy = true;
      }
    }

    // 2. Inertia after a flick (damping)
    if (!this.dragging && !tr && (this.velocity.az || this.velocity.el)) {
      this.azimuth += this.velocity.az * dt;
      this.elevation = clamp(this.elevation + this.velocity.el * dt, -MAX_ELEVATION, MAX_ELEVATION);
      const decay = Math.pow(0.9, dt / 16.7);
      this.velocity.az *= decay;
      this.velocity.el *= decay;
      if (Math.abs(this.velocity.az) < 1e-5 && Math.abs(this.velocity.el) < 1e-5) {
        this.velocity.az = this.velocity.el = 0;
        this.settle();
      } else {
        busy = true;
      }
    }

    // 3. Idle drift: a few degrees, very slowly
    if (this.idleActive) {
      this.idlePhase += dt / 1000;
      const ramp = Math.min(1, this.idlePhase / 3); // ease in over 3 s
      this.idleOffset.az = Math.sin(this.idlePhase * 0.55) * toRadians(3) * ramp;
      this.idleOffset.el = Math.sin(this.idlePhase * 0.37) * toRadians(1.2) * ramp;
      busy = true;
    }

    const settled = !tr && !this.dragging && !this.velocity.az && !this.velocity.el;
    if (this.cube.update(dt, settled)) busy = true;

    this.render();
    if (busy || this.dragging) this.requestRender();
  };

  private syncCamera() {
    const view = {
      azimuth: this.azimuth + this.idleOffset.az,
      elevation: clamp(this.elevation + this.idleOffset.el, -MAX_ELEVATION, MAX_ELEVATION),
    };
    quaternionFromAngles(view, this.camera.quaternion);
    directionFromAngles(view, this.camera.position).multiplyScalar(CAMERA_DISTANCE);
    if (this.camera.zoom !== this.zoom) {
      this.camera.zoom = this.zoom;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    return view;
  }

  private render() {
    const view = this.syncCamera();
    this.renderer.render(this.cube.scene, this.camera);
    this.positionCompass(view);
    this.emit(view);
  }

  /** Project the N/E/S/W anchor points and move the HTML labels there. */
  private positionCompass(view: ViewAngles) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    // Screen radius (px) that the cube covers — labels inside it fade out
    const unitsToPx = (halfH / FRUSTUM) * this.zoom;
    const cubeRadiusPx = HALF * 1.5 * unitsToPx;
    const toCamera = directionFromAngles(view, this._dir);
    for (const point of COMPASS_POINTS) {
      const label = this.el.compass[point.label];
      if (!label) continue;
      const p = this._v.copy(point.position).project(this.camera);
      const x = p.x * halfW;
      const y = -p.y * halfH;
      // Labels that would sit on top of the cube (which is centred on screen) fade out
      const inside = Math.hypot(x, y) < cubeRadiusPx;
      // Labels on the far side of the ring (away from the camera) are dimmer
      const near = point.position.dot(toCamera) >= -0.01;
      label.style.transform = `translate(-50%, -50%) translate(${(x + halfW).toFixed(1)}px, ${(y + halfH).toFixed(1)}px)`;
      label.style.opacity = inside ? "0.08" : near ? "0.95" : "0.5";
    }
  }

  private emit(view: ViewAngles) {
    const interaction: OrientationChange["interaction"] = this.dragging
      ? "drag"
      : this.transition
        ? "transition"
        : this.velocity.az || this.velocity.el
          ? "inertia"
          : "rest";
    // The interaction is part of the key: arriving at rest must always be reported,
    // even when the last animation frame was already (almost) on target.
    const key = `${view.azimuth.toFixed(5)}|${view.elevation.toFixed(5)}|${this.zoom.toFixed(4)}|${interaction}`;
    if (key === this.lastEmitted) return;
    this.lastEmitted = key;
    const moving = interaction !== "rest";
    const preset = moving ? null : presetForAngles(view);
    const detail: OrientationChange = {
      quaternion: this.camera.quaternion.clone(),
      azimuth: (toDegrees(wrapAngle(view.azimuth)) + 360) % 360, // 0–360°, 0 = from the front (south)
      elevation: toDegrees(view.elevation),
      zoom: this.zoom,
      preset,
      mode: preset ? "preset" : "free",
      interaction,
    };
    this.options.onOrientationChange?.(detail);
    this.el.root.dispatchEvent(new CustomEvent<OrientationChange>("viewcube:orientation", { detail, bubbles: true }));
    if (!moving) this.updateCaption();
  }

  private updateCaption() {
    const caption = this.el.caption;
    if (!caption) return;
    // The caption shows the current view; what's under the pointer goes to the HUD.
    const preset = presetForAngles({ azimuth: this.azimuth, elevation: this.elevation });
    const az = ((toDegrees(this.azimuth) % 360) + 360) % 360;
    const text =
      preset === "home"
        ? "ISO"
        : preset
          ? preset.toUpperCase()
          : `AZ ${az.toFixed(1)}° · EL ${toDegrees(this.elevation).toFixed(1)}°`;
    if (caption.textContent !== text) caption.textContent = text;
  }

  private setCursor(cursor: "grab" | "grabbing" | "pointer") {
    this.renderer.domElement.style.cursor = cursor;
  }

  private resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.left = -FRUSTUM * aspect;
    this.camera.right = FRUSTUM * aspect;
    this.camera.top = FRUSTUM;
    this.camera.bottom = -FRUSTUM;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.cube.setResolution(width, height);
    this.requestRender();
  }
}
