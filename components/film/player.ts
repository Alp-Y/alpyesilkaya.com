/**
 * FILM PLAYER — owns the canvas and the clock. Loaded only when the film is
 * about to scroll into view (ToolsFilm imports it dynamically).
 *
 *   · time runs only while playing, on screen and with the tab visible
 *   · the canvas is sized to its box × devicePixelRatio (capped), and the
 *     resolution steps down by itself if frames take too long
 *   · weaker devices get a lighter survey (fewer points and triangles)
 */

import { buildData, type FilmData } from "./data";
import type { Frame } from "./draw";
import { buildTimeline, type Scene } from "./timeline";
import type { ChapterId } from "./chapters";

export type PlayerOptions = {
  chapters?: readonly ChapterId[];
  loop: boolean;
  low: boolean;
  fonts: { sans: string; mono: string };
  onTime?: (t: number, scene: number) => void;
  onEnd?: () => void;
};

export class FilmPlayer {
  readonly duration: number;
  readonly scenes: Scene[];
  private ctx: CanvasRenderingContext2D;
  private data: FilmData;
  private t = 0;
  private playing = false;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private maxDpr: number;
  private slow = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: PlayerOptions,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    const tl = buildTimeline(opts.chapters);
    this.scenes = tl.scenes;
    this.duration = tl.duration;
    this.data = buildData(opts.low);
    this.maxDpr = Math.min(window.devicePixelRatio || 1, opts.low ? 1.5 : 2);
    this.dpr = this.maxDpr;
  }

  get time() {
    return this.t;
  }
  get isPlaying() {
    return this.playing;
  }

  resize(w: number, h: number) {
    if (w < 2 || h < 2) return;
    this.w = w;
    this.h = h;
    this.applySize();
    this.render();
  }
  private applySize() {
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  play() {
    if (this.playing) return;
    if (this.t >= this.duration - 0.01) this.t = 0;
    this.playing = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }
  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  seek(t: number) {
    this.t = Math.max(0, Math.min(this.duration, t));
    this.render();
  }
  /** jump to the start of a scene (by index in this timeline) */
  seekScene(i: number, into = 0) {
    const s = this.scenes[i];
    if (s) this.seek(s.start + into);
  }
  destroy() {
    this.pause();
  }

  private frame = (now: number) => {
    if (!this.playing) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.t += dt;
    if (this.t >= this.duration) {
      if (this.opts.loop) this.t %= this.duration;
      else {
        this.t = this.duration;
        this.render();
        this.pause();
        this.opts.onEnd?.();
        return;
      }
    }
    const t0 = performance.now();
    this.render();
    this.adapt(performance.now() - t0);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** if drawing keeps taking longer than a frame, draw fewer pixels */
  private adapt(ms: number) {
    this.slow = ms > 14 ? this.slow + 1 : Math.max(0, this.slow - 1);
    if (this.slow > 40 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.5);
      this.slow = 0;
      this.applySize();
    }
  }

  render() {
    if (!this.w) return;
    const i = this.sceneAt(this.t);
    const scene = this.scenes[i];
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    const f: Frame = {
      ctx,
      W: this.w,
      H: this.h,
      tall: this.w / this.h < 1.05,
      u: this.w / this.h < 1.05 ? Math.min(1.1, Math.max(0.9, this.w / 400)) : Math.min(1.25, Math.max(0.82, this.w / 1150)),
      t: this.t,
      lt: Math.min(scene.dur - 1e-3, this.t - scene.start),
      data: this.data,
      low: this.opts.low,
      sans: this.opts.fonts.sans,
      mono: this.opts.fonts.mono,
      dpr: this.dpr,
    };
    ctx.save();
    scene.draw(f);
    ctx.restore();
    // chapters fade through the background into each other (the last one holds)
    const FADE = 0.7;
    const last = i === this.scenes.length - 1 && !this.opts.loop;
    const lift = Math.min(1, f.lt / FADE, last ? 1 : (scene.dur - f.lt) / FADE);
    if (lift < 1) {
      ctx.globalAlpha = 1 - Math.max(0, lift) ** 1.5;
      ctx.fillStyle = "#07090b";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
    this.opts.onTime?.(this.t, i);
  }

  sceneAt(t: number) {
    for (let i = this.scenes.length - 1; i >= 0; i--) if (t >= this.scenes[i].start) return i;
    return 0;
  }
}
