/**
 * Horror soundtrack for the Backrooms and the Skinwalker (replaces the cozy music there).
 *
 *  - Music: a low, dissonant drone that slowly breathes, out-of-tune music-box fragments and
 *    lonely low piano notes a semitone apart.
 *  - Danger ("tension" 0 → 1, set by the level every frame): a trembling string layer and a
 *    heartbeat that speeds up the closer something is (or with 1 heart left).
 *  - Background scares every few seconds, from a random side: far footsteps, knocks, whispers,
 *    creaks, drips, sparking lamps and, rarely, a distant scream.
 *  - One-shots for moments: power down/up, giggles, bones cracking, a creaking door, levers…
 *
 * Every sound can be replaced by a recording (see customSounds.ts).
 */
import { CUSTOM_SOUNDS, CustomSoundName } from './customSounds';

export class HorrorAudio {
  private active = false;
  private tension = 0;
  private drone: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private trem: GainNode | null = null;
  private beatTimer: number | null = null;
  private scareTimer: number | null = null;
  private barTimer: number | null = null;
  private noise: AudioBuffer | null = null;
  private files = new Map<CustomSoundName, AudioBuffer>();
  private loops = new Map<CustomSoundName, { src: AudioBufferSourceNode; gain: GainNode }>();

  constructor(
    private ctx: AudioContext,
    private music: GainNode,
    private ambient: GainNode,
    private sfx: GainNode,
    private muted: () => boolean
  ) {
    this.loadCustomFiles();
  }

  // ------------------------------------------------------------------ custom files
  private loadCustomFiles() {
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    for (const [name, file] of Object.entries(CUSTOM_SOUNDS) as [CustomSoundName, string][]) {
      if (!file) continue;
      fetch(`${base}sounds/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audio) => {
          this.files.set(name, audio);
          if (this.active) this.syncLoops();
        })
        .catch(() => {
          /* missing or unreadable: the synthesized sound is used */
        });
    }
  }

  /** Plays your recording for this moment, if there is one. */
  private file(name: CustomSoundName, volume = 1, pan = 0): boolean {
    const buf = this.files.get(name);
    if (!buf) return false;
    if (this.muted()) return true;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g);
    g.connect(p);
    p.connect(this.sfx);
    src.start();
    return true;
  }

  /** Music loops from files (background, and the chase layer that follows the danger). */
  private syncLoops() {
    for (const name of ['musica_backrooms', 'musica_persecucion'] as CustomSoundName[]) {
      const buf = this.files.get(name);
      if (!buf) continue;
      let l = this.loops.get(name);
      if (!l) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain);
        gain.connect(this.music);
        src.start();
        l = { src, gain };
        this.loops.set(name, l);
      }
      const target = !this.active ? 0 : name === 'musica_backrooms' ? 0.9 : this.tension;
      l.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    }
  }

  // ------------------------------------------------------------------ on / off
  get isActive() {
    return this.active;
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    const now = this.ctx.currentTime;
    if (on) {
      this.ensureDrone();
      // With your own music file, the synthesized drone stays quiet
      this.drone!.gain.gain.setTargetAtTime(this.files.has('musica_backrooms') ? 0 : 0.16, now, 1.5);
      this.scheduleBar(1500);
      this.scheduleScare(5000);
      this.scheduleBeat();
    } else {
      this.drone?.gain.gain.setTargetAtTime(0, now, 0.8);
      this.trem?.gain.setTargetAtTime(0, now, 0.4);
      for (const t of [this.barTimer, this.scareTimer, this.beatTimer]) if (t) window.clearTimeout(t);
      this.barTimer = this.scareTimer = this.beatTimer = null;
      this.tension = 0;
    }
    this.syncLoops();
  }

  /** 0 = calm, 1 = something is right behind you. */
  setTension(t: number) {
    t = Math.max(0, Math.min(1, t));
    if (Math.abs(t - this.tension) < 0.03) return;
    this.tension = t;
    if (!this.active) return;
    this.ensureTrem();
    this.trem!.gain.setTargetAtTime(this.files.has('musica_persecucion') ? 0 : t * t * 0.09, this.ctx.currentTime, 0.4);
    this.drone?.filter.frequency.setTargetAtTime(180 + t * 520, this.ctx.currentTime, 0.6);
    this.syncLoops();
  }

  // ------------------------------------------------------------------ music
  private ensureDrone() {
    if (this.drone) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 4;
    // A1 and B♭1 rubbing against each other, plus a quiet tritone above
    for (const [f, type, g] of [
      [55, 'sawtooth', 0.5],
      [58.27, 'sawtooth', 0.45],
      [77.78, 'triangle', 0.25],
      [27.5, 'sine', 0.6],
    ] as [number, OscillatorType, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(filter);
      o.start();
    }
    // It breathes: the filter slowly opens and closes
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 90;
    lfo.connect(lg);
    lg.connect(filter.frequency);
    lfo.start();
    filter.connect(gain);
    gain.connect(this.music);
    this.drone = { gain, filter };
  }

  /** Strings trembling, louder with the danger */
  private ensureTrem() {
    if (this.trem) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg);
    lg.connect(amp.gain);
    lfo.start();
    for (const f of [311.1, 329.6, 466.2]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 20;
      o.connect(amp);
      o.start();
    }
    amp.connect(bp);
    bp.connect(out);
    out.connect(this.music);
    this.trem = out;
  }

  private scheduleBar(ms: number) {
    this.barTimer = window.setTimeout(() => {
      if (!this.active) return;
      if (!this.files.has('musica_backrooms')) {
        const r = Math.random();
        if (r < 0.4) this.musicBox();
        else if (r < 0.75) this.lowPiano();
      }
      this.scheduleBar(4500 + Math.random() * 4000);
    }, ms);
  }

  /** A few out-of-tune music-box notes */
  private musicBox() {
    const ctx = this.ctx;
    const notes = [880, 932.3, 1046.5, 1244.5, 1318.5, 1479.98, 698.5];
    const n = 3 + Math.floor(Math.random() * 3);
    const now = ctx.currentTime;
    let t = now;
    const slow = Math.random() < 0.5 ? 1.6 : 1;
    for (let i = 0; i < n; i++) {
      const f = notes[Math.floor(Math.random() * notes.length)] * (1 + (Math.random() - 0.5) * 0.02);
      for (const [mult, g0] of [
        [1, 0.035],
        [3.01, 0.01],
      ]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(g0, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g);
        g.connect(this.music);
        o.start(t);
        o.stop(t + 1.7);
      }
      t += (0.35 + Math.random() * 0.35) * slow;
    }
  }

  /** Two low piano notes a semitone apart */
  private lowPiano() {
    const ctx = this.ctx;
    const base = [61.7, 65.4, 69.3, 73.4][Math.floor(Math.random() * 4)];
    const now = ctx.currentTime;
    [base, base * 1.0595, base * 1.4142].slice(0, 2 + (Math.random() < 0.4 ? 1 : 0)).forEach((f, i) => {
      const t = now + i * 0.6;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.music);
      o.start(t);
      o.stop(t + 5.1);
    });
  }

  // ------------------------------------------------------------------ heartbeat
  private scheduleBeat() {
    const t = this.tension;
    const bpm = 55 + t * 80;
    this.beatTimer = window.setTimeout(() => {
      if (!this.active) return;
      if (this.tension > 0.45) this.heartbeat(0.4 + this.tension * 0.6);
      this.scheduleBeat();
    }, 60000 / bpm);
  }

  heartbeat(volume = 1) {
    if (this.muted()) return;
    if (this.file('latido', volume)) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const [dt, f, g0] of [
      [0, 62, 0.5],
      [0.16, 52, 0.35],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.6, now + dt);
      o.frequency.exponentialRampToValueAtTime(f, now + dt + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + dt);
      g.gain.exponentialRampToValueAtTime(g0 * volume, now + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.22);
      o.connect(g);
      g.connect(this.sfx);
      o.start(now + dt);
      o.stop(now + dt + 0.25);
    }
  }

  // ------------------------------------------------------------------ background scares
  private scheduleScare(ms: number) {
    this.scareTimer = window.setTimeout(() => {
      if (!this.active) return;
      this.randomScare();
      this.scheduleScare(6000 + Math.random() * 10000);
    }, ms);
  }

  private randomScare() {
    if (this.muted()) return;
    const pan = (Math.random() * 2 - 1) * 0.9;
    const r = Math.random();
    if (r < 0.22) this.farFootsteps(pan);
    else if (r < 0.38) this.knock(pan);
    else if (r < 0.54) this.whisper(0.5, pan);
    else if (r < 0.68) this.creak(pan);
    else if (r < 0.8) this.drip(pan);
    else if (r < 0.93) this.spark(pan);
    else this.farScream(pan);
  }

  private noiseBuf(): AudioBuffer {
    if (this.noise) return this.noise;
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    return b;
  }

  /** Output chain with stereo position and distance (lowpass) */
  private out(pan: number, far: number): AudioNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000 - far * 5000;
    lp.connect(p);
    p.connect(this.ambient);
    return lp;
  }

  private thump(at: number, f: number, g0: number, dest: AudioNode, len = 0.12) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 0.4, at + len);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(g0, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + len + 0.02);
  }

  private noiseHit(at: number, dur: number, type: BiquadFilterType, f: number, q: number, g0: number, dest: AudioNode) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf();
    const bf = this.ctx.createBiquadFilter();
    bf.type = type;
    bf.frequency.value = f;
    bf.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(g0, at + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(bf);
    bf.connect(g);
    g.connect(dest);
    s.start(at, Math.random());
    s.stop(at + dur + 0.05);
    return bf;
  }

  farFootsteps(pan = 0) {
    if (this.file('pasos_lejanos', 0.7, pan)) return;
    const dest = this.out(pan, 0.8);
    const now = this.ctx.currentTime;
    const n = 4 + Math.floor(Math.random() * 4);
    const gap = 0.42 + Math.random() * 0.2;
    for (let i = 0; i < n; i++) this.thump(now + i * gap, 120 + Math.random() * 30, 0.12, dest);
  }

  knock(pan = 0) {
    if (this.file('golpe_lejano', 0.7, pan)) return;
    const dest = this.out(pan, 0.6);
    const now = this.ctx.currentTime;
    if (Math.random() < 0.5) {
      // three knocks on a door
      for (let i = 0; i < 3; i++) this.thump(now + i * 0.28, 160, 0.3, dest, 0.15);
    } else {
      // a door slamming somewhere
      this.thump(now, 90, 0.5, dest, 0.5);
      this.noiseHit(now, 0.4, 'lowpass', 600, 0.7, 0.25, dest);
    }
  }

  whisper(volume = 1, pan = 0) {
    if (this.file('susurro', volume, pan)) return;
    const dest = this.out(pan, 0.3);
    const now = this.ctx.currentTime;
    // Breathy noise through moving "vowel" filters
    const dur = 1.6 + Math.random() * 1.2;
    for (const f0 of [900, 2300]) {
      const bf = this.noiseHit(now, dur, 'bandpass', f0, 6, 0.12 * volume, dest);
      for (let k = 0; k < 6; k++) bf.frequency.setValueAtTime(f0 * (0.7 + Math.random() * 0.7), now + (k * dur) / 6);
    }
  }

  creak(pan = 0) {
    if (this.file('rechinido', 0.7, pan)) return;
    const dest = this.out(pan, 0.5);
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, now);
    o.frequency.linearRampToValueAtTime(110, now + 0.7);
    o.frequency.linearRampToValueAtTime(60, now + 1.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 8;
    const am = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 23;
    const lg = this.ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg);
    lg.connect(am.gain);
    am.gain.setValueAtTime(0.0001, now);
    am.gain.exponentialRampToValueAtTime(0.5, now + 0.15);
    am.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    o.connect(bp);
    bp.connect(am);
    am.connect(dest);
    o.start(now);
    lfo.start(now);
    o.stop(now + 1.5);
    lfo.stop(now + 1.5);
  }

  drip(pan = 0) {
    if (this.file('gota', 0.8, pan)) return;
    const dest = this.out(pan, 0.2);
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const t = now + i * (0.6 + Math.random() * 0.5);
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1400 + Math.random() * 500, t);
      o.frequency.exponentialRampToValueAtTime(500, t + 0.07);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + 0.13);
    }
  }

  spark(pan = 0) {
    if (this.file('chispa', 0.6, pan)) return;
    const dest = this.out(pan, 0.3);
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.noiseHit(now + i * (0.05 + Math.random() * 0.12), 0.05, 'highpass', 3000, 0.7, 0.18, dest);
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 120;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    o.connect(g);
    g.connect(dest);
    o.start(now);
    o.stop(now + 0.85);
  }

  farScream(pan = 0) {
    if (this.file('grito_lejano', 0.5, pan)) return;
    const dest = this.out(pan, 0.9);
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, now);
    o.frequency.linearRampToValueAtTime(980, now + 0.3);
    o.frequency.exponentialRampToValueAtTime(400, now + 1.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    o.connect(g);
    g.connect(dest);
    o.start(now);
    o.stop(now + 1.8);
  }

  // ------------------------------------------------------------------ moments
  powerDown() {
    if (this.muted() || this.file('apagon', 1)) return;
    const now = this.ctx.currentTime;
    this.thump(now, 70, 0.6, this.sfx, 0.4);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(240, now);
    o.frequency.exponentialRampToValueAtTime(30, now + 1.3);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    o.start(now);
    o.stop(now + 1.5);
  }

  powerUp() {
    if (this.muted() || this.file('luz_vuelve', 1)) return;
    const now = this.ctx.currentTime;
    // fluorescent tubes ticking on
    for (let i = 0; i < 4; i++) this.noiseHit(now + i * 0.11 + Math.random() * 0.05, 0.04, 'highpass', 2500, 0.7, 0.2, this.sfx);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(40, now);
    o.frequency.exponentialRampToValueAtTime(120, now + 0.6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    o.start(now);
    o.stop(now + 1.3);
  }

  giggle(volume = 1) {
    if (this.muted() || this.file('risa', volume)) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.13;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(620 - i * 30, t);
      o.frequency.exponentialRampToValueAtTime(480 - i * 30, t + 0.1);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * volume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(bp);
      bp.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  boneCrack(volume = 1) {
    if (this.muted() || this.file('huesos', volume)) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.noiseHit(now + i * (0.07 + Math.random() * 0.12), 0.035, 'bandpass', 1800 + Math.random() * 1500, 3, 0.35 * volume, this.sfx);
    this.thump(now + 0.3, 110, 0.3 * volume, this.sfx, 0.2);
  }

  doorCreak() {
    if (this.muted() || this.file('puerta_abre', 1)) return;
    this.creak(0);
    this.thump(this.ctx.currentTime + 1.2, 80, 0.4, this.sfx, 0.4);
  }

  clank() {
    if (this.muted() || this.file('palanca', 1)) return;
    const now = this.ctx.currentTime;
    for (const [f, g0] of [
      [430, 0.15],
      [1170, 0.06],
      [2210, 0.03],
    ]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(g0, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      o.connect(g);
      g.connect(this.sfx);
      o.start(now);
      o.stop(now + 0.95);
    }
    this.thump(now, 140, 0.4, this.sfx, 0.15);
  }

  /** The corridor stretching: a sucking whoosh with a falling tone */
  stretch() {
    if (this.muted() || this.file('pasillo_alarga', 1)) return;
    const now = this.ctx.currentTime;
    const bf = this.noiseHit(now, 1.4, 'bandpass', 2000, 2, 0.25, this.sfx);
    bf.frequency.exponentialRampToValueAtTime(150, now + 1.3);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 1.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    o.connect(g);
    g.connect(this.sfx);
    o.start(now);
    o.stop(now + 1.5);
  }

  /** Recordings for sounds the synthesizer already makes (scream, rip, walls moving) */
  tryFile(name: CustomSoundName, volume = 1): boolean {
    return this.file(name, volume);
  }
}
