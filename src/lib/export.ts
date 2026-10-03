import type { Doc } from "../types";
import { clipTime } from "./animation";
import { preloadDoc, renderDoc, videoPlayers } from "./render";
import { zipFiles } from "./zip";
import { resolveSrc } from "./media";
import { trackGain } from "./music";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function makeCanvas(doc: Doc, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(doc.frame.w * scale);
  canvas.height = Math.round(doc.frame.h * scale);
  const c = canvas.getContext("2d")!;
  c.scale(scale, scale);
  return { canvas, c };
}

async function imageBlob(doc: Doc, format: "png" | "jpeg", scale: number): Promise<Blob> {
  await preloadDoc(doc);
  const { canvas, c } = makeCanvas(doc, scale);
  renderDoc(c, doc, null);
  if (format === "jpeg") {
    // JPG has no transparency — put white behind see-through designs
    c.save();
    c.globalCompositeOperation = "destination-over";
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, doc.frame.w, doc.frame.h);
    c.restore();
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, `image/${format}`, 0.92));
  if (!blob) throw new Error("Could not create image (a photo may block export).");
  return blob;
}

export async function exportImage(doc: Doc, format: "png" | "jpeg", scale: number, name: string) {
  download(await imageBlob(doc, format, scale), `${name}.${format === "jpeg" ? "jpg" : "png"}`);
}

/** Every carousel slide as numbered images inside one .zip (in swipe order). */
export async function exportCarousel(docs: Doc[], format: "png" | "jpeg", scale: number, name: string, onProgress: (p: number) => void) {
  const ext = format === "jpeg" ? "jpg" : "png";
  const files: { name: string; data: Blob }[] = [];
  for (let i = 0; i < docs.length; i++) {
    files.push({ name: `${name}-${String(i + 1).padStart(2, "0")}.${ext}`, data: await imageBlob(docs[i], format, scale) });
    onProgress((i + 1) / docs.length);
  }
  download(await zipFiles(files), `${name}-carousel.zip`);
}

export function videoMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options = [
    { mime: "video/mp4;codecs=avc1", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

// A media element can only be wired into Web Audio once, so keep one context around.
let sharedAudio: AudioContext | null = null;
const audioCtx = () => (sharedAudio ??= new AudioContext());
const sources = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>();

/** Records the animation in real time into a video file. */
export async function exportVideo(doc: Doc, name: string, onProgress: (p: number) => void) {
  const fmt = videoMime();
  if (!fmt) throw new Error("This browser can't record video. Try Chrome, Edge or Safari.");
  await preloadDoc(doc);
  // Keep very large frames manageable for the encoder.
  const scale = Math.min(1, 1920 / Math.max(doc.frame.w, doc.frame.h));
  const { canvas, c } = makeCanvas(doc, scale);
  renderDoc(c, doc, 0);

  const stream = canvas.captureStream(30);

  // Route the clips' sound into the recording (not to the speakers).
  const clips = doc.elements.filter((e) => e.type === "video" && !e.hidden);
  const gains: GainNode[] = [];
  // background music
  const track = doc.audio;
  const trackEnd = track ? Math.min(doc.duration, track.start + track.length - track.trimStart) : 0;
  let music: HTMLAudioElement | null = null;
  let musicGain: GainNode | null = null;
  if (track && resolveSrc(track.src)) {
    music = new Audio(resolveSrc(track.src));
    music.preload = "auto";
    await new Promise<void>((r) => {
      if (music!.readyState >= 3) return r();
      music!.oncanplaythrough = () => r();
      music!.onerror = () => r();
      setTimeout(r, 4000);
    });
  }
  if (clips.some((e) => !e.muted) || music) {
    const audio = audioCtx();
    await audio.resume();
    const dest = audio.createMediaStreamDestination();
    for (const el of clips) {
      const v = videoPlayers.get(el.id);
      if (!v) continue;
      v.muted = false;
      let src = sources.get(v);
      if (!src) {
        src = audio.createMediaElementSource(v);
        sources.set(v, src);
      }
      const gain = audio.createGain();
      gain.gain.value = el.muted ? 0 : (el.volume ?? 1);
      src.connect(gain).connect(dest);
      gains.push(gain);
    }
    if (music) {
      musicGain = audio.createGain();
      musicGain.gain.value = 0;
      audio.createMediaElementSource(music).connect(musicGain).connect(dest);
      gains.push(musicGain);
    }
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const syncMusic = (t: number) => {
    if (!music || !track || !musicGain) return;
    const on = t >= track.start && t < trackEnd;
    const target = track.trimStart + (t - track.start);
    musicGain.gain.value = on ? trackGain(track, trackEnd, t) : 0;
    if (on) {
      if (music.paused) {
        music.currentTime = target;
        music.play().catch(() => undefined);
      } else if (Math.abs(music.currentTime - target) > 0.25) music.currentTime = target;
    } else if (!music.paused) music.pause();
  };
  const syncClips = (t: number) => {
    for (const el of clips) {
      const v = videoPlayers.get(el.id);
      if (!v) continue;
      const on = t >= el.anim.start && t <= el.anim.end;
      const target = clipTime(el, t);
      if (on) {
        if (v.paused) {
          v.currentTime = target;
          v.play().catch(() => undefined);
        } else if (Math.abs(v.currentTime - target) > 0.25) v.currentTime = target;
      } else if (!v.paused) v.pause();
    }
  };

  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));

  rec.start(100);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      syncClips(Math.min(t, doc.duration));
      syncMusic(Math.min(t, doc.duration));
      renderDoc(c, doc, Math.min(t, doc.duration));
      c.save();
      c.globalCompositeOperation = "destination-over"; // video can't be see-through
      c.fillStyle = "#000000";
      c.fillRect(0, 0, doc.frame.w, doc.frame.h);
      c.restore();
      onProgress(Math.min(1, t / doc.duration));
      if (t >= doc.duration + 0.15) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  clips.forEach((el) => videoPlayers.get(el.id)?.pause());
  music?.pause();
  gains.forEach((g) => g.disconnect());
  download(new Blob(chunks, { type: fmt.mime.split(";")[0] }), `${name}.${fmt.ext}`);
}
