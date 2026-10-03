/**
 * Built-in music library. Every track is synthesised in the browser (Web Audio), so it is
 * original, royalty-free and needs no download. Each render is cached as a WAV blob.
 */

export interface Track {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  seconds: number;
}

export const LIBRARY: Track[] = [
  { id: "lofi", name: "Lo-fi Sunday", mood: "Chill · relaxed", bpm: 80, seconds: 24 },
  { id: "pop", name: "Bright Side", mood: "Upbeat · happy", bpm: 118, seconds: 24 },
  { id: "house", name: "Night Drive", mood: "Energetic · dance", bpm: 124, seconds: 24 },
  { id: "ambient", name: "Soft Clouds", mood: "Calm · dreamy", bpm: 70, seconds: 27 },
  { id: "pluck", name: "Paper Planes", mood: "Light · playful", bpm: 100, seconds: 24 },
  { id: "cinematic", name: "The Reveal", mood: "Epic · dramatic", bpm: 90, seconds: 26 },
  { id: "corporate", name: "Fresh Start", mood: "Positive · business", bpm: 110, seconds: 26 },
  { id: "trap", name: "Hype Mode", mood: "Bold · street", bpm: 140, seconds: 20 },
];

const SR = 32000;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

type Ctx = OfflineAudioContext;

function noiseBuffer(ctx: Ctx) {
  const b = ctx.createBuffer(1, SR, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function tone(ctx: Ctx, out: AudioNode, f: number, t: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number; release?: number; detune?: number } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.value = f;
  if (opts.detune) o.detune.value = opts.detune;
  const peak = opts.gain ?? 0.2;
  const a = opts.attack ?? 0.01;
  const r = opts.release ?? 0.2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, dur - r));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function kick(ctx: Ctx, out: AudioNode, t: number, gain = 0.9) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.4);
}

function noiseHit(ctx: Ctx, out: AudioNode, buf: AudioBuffer, t: number, dur: number, freq: number, type: BiquadFilterType, gain: number) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

// chord progressions as MIDI notes
const PROG = {
  warm: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], // Am7 Fmaj7 G7 Em7
  happy: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], // C G Am F
  minor: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
  dreamy: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 66]],
};

function build(ctx: Ctx, id: string, seconds: number, bpm: number) {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const nb = noiseBuffer(ctx);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const bars = Math.floor(seconds / bar);

  const pad = (prog: number[][], type: OscillatorType, gain: number, octave = 0) => {
    for (let b = 0; b < bars; b++)
      for (const n of prog[b % prog.length]) {
        tone(ctx, master, midi(n + octave), b * bar, bar, { type, gain, attack: bar * 0.3, release: bar * 0.4, detune: 6 });
        tone(ctx, master, midi(n + octave), b * bar, bar, { type, gain: gain * 0.6, attack: bar * 0.3, release: bar * 0.4, detune: -8 });
      }
  };
  const bass = (prog: number[][], gain = 0.35, pattern = [0, 2]) => {
    for (let b = 0; b < bars; b++)
      for (const p of pattern) tone(ctx, master, midi(prog[b % prog.length][0] - 12), b * bar + p * beat, beat * 1.6, { type: "triangle", gain, release: 0.2 });
  };
  const drums = (opts: { kick: number[]; snare: number[]; hats: number; snareGain?: number }) => {
    for (let b = 0; b < bars; b++) {
      const t0 = b * bar;
      opts.kick.forEach((k) => kick(ctx, master, t0 + k * beat));
      opts.snare.forEach((s) => noiseHit(ctx, master, nb, t0 + s * beat, 0.18, 1800, "bandpass", opts.snareGain ?? 0.5));
      for (let i = 0; i < 4 * opts.hats; i++) noiseHit(ctx, master, nb, t0 + (i * beat) / opts.hats, 0.04, 8000, "highpass", i % 2 ? 0.08 : 0.14);
    }
  };
  const arp = (prog: number[][], notesPerBeat: number, type: OscillatorType, gain: number, octave = 12) => {
    for (let b = 0; b < bars; b++) {
      const ch = prog[b % prog.length];
      for (let i = 0; i < 4 * notesPerBeat; i++)
        tone(ctx, master, midi(ch[i % ch.length] + octave), b * bar + (i * beat) / notesPerBeat, beat / notesPerBeat, { type, gain, attack: 0.005, release: beat / notesPerBeat * 0.8 });
    }
  };

  switch (id) {
    case "lofi":
      pad(PROG.warm, "triangle", 0.05);
      bass(PROG.warm, 0.3, [0, 2.5]);
      drums({ kick: [0, 2.5], snare: [1, 3], hats: 2, snareGain: 0.35 });
      noiseHit(ctx, master, nb, 0, seconds, 3000, "lowpass", 0.015); // vinyl hiss
      break;
    case "pop":
      pad(PROG.happy, "sawtooth", 0.025);
      bass(PROG.happy, 0.3, [0, 1, 2, 3]);
      arp(PROG.happy, 2, "square", 0.04);
      drums({ kick: [0, 2], snare: [1, 3], hats: 2 });
      break;
    case "house":
      pad(PROG.minor, "sawtooth", 0.025);
      bass(PROG.minor, 0.32, [0.5, 1.5, 2.5, 3.5]);
      drums({ kick: [0, 1, 2, 3], snare: [1, 3], hats: 4, snareGain: 0.3 });
      break;
    case "ambient":
      pad(PROG.dreamy, "sine", 0.06);
      pad(PROG.dreamy, "triangle", 0.02, 12);
      arp(PROG.dreamy, 0.5, "sine", 0.05, 24);
      break;
    case "pluck":
      arp(PROG.happy, 2, "triangle", 0.12, 12);
      bass(PROG.happy, 0.25, [0, 2]);
      drums({ kick: [0, 2], snare: [], hats: 1 });
      for (let b = 0; b < bars; b++) noiseHit(ctx, master, nb, b * bar + 3 * beat, 0.06, 4000, "bandpass", 0.3); // clap-ish
      break;
    case "cinematic":
      pad(PROG.minor, "sawtooth", 0.035, -12);
      for (let b = 0; b < bars; b++) {
        kick(ctx, master, b * bar, 1);
        if (b % 2) kick(ctx, master, b * bar + 2 * beat, 0.8);
      }
      arp(PROG.minor, 4, "triangle", 0.03, 12);
      break;
    case "corporate":
      pad(PROG.happy, "triangle", 0.04);
      arp(PROG.happy, 4, "sine", 0.06, 12);
      bass(PROG.happy, 0.28, [0, 1.5, 2, 3.5]);
      drums({ kick: [0, 2], snare: [1, 3], hats: 4, snareGain: 0.3 });
      break;
    case "trap":
      pad(PROG.minor, "square", 0.02);
      for (let b = 0; b < bars; b++) {
        tone(ctx, master, midi(PROG.minor[b % 4][0] - 24), b * bar, bar * 0.9, { type: "sine", gain: 0.5, release: 0.6 }); // 808
      }
      drums({ kick: [0, 2.75], snare: [2], hats: 4, snareGain: 0.6 });
      for (let b = 0; b < bars; b++) for (let i = 0; i < 6; i++) noiseHit(ctx, master, nb, b * bar + 3 * beat + i * beat / 6, 0.03, 9000, "highpass", 0.1);
      break;
  }

  // gentle fade at both ends so it loops / cuts nicely
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.8, 0.4);
  master.gain.setValueAtTime(0.8, seconds - 1.2);
  master.gain.linearRampToValueAtTime(0, seconds);
}

function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length * ch * 2 + 44;
  const view = new DataView(new ArrayBuffer(len));
  const w = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  view.setUint32(4, len - 8, true);
  w(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, len - 44, true);
  const data = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < buf.length; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return new Blob([view.buffer], { type: "audio/wav" });
}

const cache = new Map<string, Blob>();

export async function renderTrack(t: Track): Promise<Blob> {
  const hit = cache.get(t.id);
  if (hit) return hit;
  const ctx = new OfflineAudioContext(2, SR * t.seconds, SR);
  build(ctx, t.id, t.seconds, t.bpm);
  const blob = toWav(await ctx.startRendering());
  cache.set(t.id, blob);
  return blob;
}

/** Gain for a track at timeline time t (handles fades). */
export function trackGain(a: { start: number; volume: number; fadeIn: number; fadeOut: number }, end: number, t: number) {
  const into = t - a.start;
  const left = end - t;
  let g = a.volume;
  if (a.fadeIn > 0) g *= Math.max(0, Math.min(1, into / a.fadeIn));
  if (a.fadeOut > 0) g *= Math.max(0, Math.min(1, left / a.fadeOut));
  return g;
}
