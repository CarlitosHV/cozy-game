/**
 * Procedural Audio Synthesizer & Generative Ambient Soundtrack
 * 100% Web Audio API - Zero external MP3/audio files (Zero 404s).
 */

export type WeatherType = 'golden_hour' | 'cozy_rain' | 'sakura_breeze' | 'starlit_night';

class SoundtrackSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Music loop state
  private isPlayingMusic: boolean = false;
  private musicInterval: number | null = null;
  private chordIndex: number = 0;
  private noteStep: number = 0;

  // Ambient sound nodes
  private rainNode: AudioNode | null = null;
  private rainGainNode: GainNode | null = null;
  private nightGainNode: GainNode | null = null;
  private windNode: AudioNode | null = null;
  private nightNode: AudioNode | null = null;
  private isRainGenerating: boolean = false;
  private currentWeather: WeatherType = 'golden_hour';

  // Chords progression (pentatonic / jazz modal cozy: Emaj9, G#m7, C#m9, Aadd9, F#m7, Bsus4)
  // Frequencies in Hz
  private chords = [
    // Emaj9 (E3, B3, D#4, F#4, G#4)
    [164.81, 246.94, 311.13, 369.99, 415.30],
    // G#m7 (G#3, B3, D#4, F#4)
    [207.65, 246.94, 311.13, 369.99],
    // C#m9 (C#3, G#3, B3, D#4, E4)
    [138.59, 207.65, 246.94, 311.13, 329.63],
    // Aadd9 (A2, E3, A3, B3, C#4)
    [110.00, 164.81, 220.00, 246.94, 277.18],
    // F#m7 (F#2, C#3, F#3, A3, E4)
    [92.50, 138.59, 185.00, 220.00, 329.63],
    // Badd9 / Bsus4 (B2, F#3, B3, C#4, D#4)
    [123.47, 185.00, 246.94, 277.18, 311.13],
  ];

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Sub buses
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.startAmbientGenerators();
      this.startMusic();
    } catch {
      // Audio not supported or blocked
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public setMasterVolume(val: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.05);
  }

  public setMusicVolume(val: number) {
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.05);
  }

  public setAmbientVolume(val: number) {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.05);
  }

  public setWeather(weather: WeatherType, duration: number = 3.2) {
    this.currentWeather = weather;
    this.updateAmbientWeatherMix(duration);
  }

  // --- Generative Ambient Soundtrack ---
  private startMusic() {
    if (this.isPlayingMusic || !this.ctx) return;
    this.isPlayingMusic = true;

    // Trigger chords and arpeggios every 4.2 seconds
    const tick = () => {
      if (!this.ctx || this.ctx.state === 'suspended') return;
      this.playChord(this.chords[this.chordIndex]);
      this.chordIndex = (this.chordIndex + 1) % this.chords.length;

      // Also trigger a random light melodic twinkle note
      if (Math.random() > 0.2) {
        setTimeout(() => {
          this.playTwinkleNote();
        }, 1400);
      }
      if (Math.random() > 0.4) {
        setTimeout(() => {
          this.playTwinkleNote();
        }, 2800);
      }
    };

    tick();
    this.musicInterval = window.setInterval(tick, 4400);
  }

  private playChord(freqs: number[]) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    freqs.forEach((freq, idx) => {
      // Warm Rhodes / soft bell electric piano tone using FM
      const osc = this.ctx!.createOscillator();
      const oscMod = this.ctx!.createOscillator();
      const modGain = this.ctx!.createGain();
      const noteGain = this.ctx!.createGain();

      // Filter to keep it warm, soft, non-abrasive
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + idx * 80, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      oscMod.type = 'sine';
      oscMod.frequency.setValueAtTime(freq * 2, now);
      modGain.gain.setValueAtTime(freq * 0.4, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + 3.8);

      oscMod.connect(modGain);
      modGain.connect(osc.frequency);

      // Envelope with gentle attack and long cozy release
      const str = 0.06 / (idx + 1);
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(str, now + 0.35 + idx * 0.08); // slight strum
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.musicGain!);

      osc.start(now + idx * 0.04);
      oscMod.start(now + idx * 0.04);
      osc.stop(now + 4.4);
      oscMod.stop(now + 4.4);
    });
  }

  private playTwinkleNote() {
    if (!this.ctx || !this.musicGain) return;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5, D5, E5, G5, A5, C6
    const f = pentatonic[Math.floor(Math.random() * pentatonic.length)];
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc.stop(now + 2.2);
  }

  // --- Weather Soundscape Synthesizers ---
  private startAmbientGenerators() {
    if (!this.ctx || !this.ambientGain) return;

    // 1. Wind Generator (bandpass swept noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    whiteNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
    whiteNoise.start();

    // Slow organic wind modulation
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    this.windNode = windGain;

    // 2. Dedicated Rain Sub-Bus Gain
    this.rainGainNode = this.ctx.createGain();
    this.rainGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.rainGainNode.connect(this.ambientGain);

    // 3. Dedicated Night Starlit Sub-Bus Gain (Gentle resonant nocturnal shimmer)
    this.nightGainNode = this.ctx.createGain();
    this.nightGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.nightGainNode.connect(this.ambientGain);

    this.updateAmbientWeatherMix(1.0);
  }

  private updateAmbientWeatherMix(duration: number = 3.2) {
    if (!this.ctx || !this.windNode) return;
    const now = this.ctx.currentTime;
    const wGain = this.windNode as GainNode;
    const timeConstant = Math.max(0.3, duration * 0.32);

    if (this.currentWeather === 'cozy_rain') {
      wGain.gain.setTargetAtTime(0.20, now, timeConstant);
      if (this.rainGainNode) {
        this.rainGainNode.gain.setTargetAtTime(1.0, now, timeConstant);
      }
      if (this.nightGainNode) {
        this.nightGainNode.gain.setTargetAtTime(0.0, now, timeConstant);
      }
      this.ensureRainLoop();
    } else if (this.currentWeather === 'sakura_breeze') {
      wGain.gain.setTargetAtTime(0.16, now, timeConstant);
      if (this.rainGainNode) {
        this.rainGainNode.gain.setTargetAtTime(0.0, now, timeConstant);
      }
      if (this.nightGainNode) {
        this.nightGainNode.gain.setTargetAtTime(0.0, now, timeConstant);
      }
    } else if (this.currentWeather === 'starlit_night') {
      wGain.gain.setTargetAtTime(0.05, now, timeConstant);
      if (this.rainGainNode) {
        this.rainGainNode.gain.setTargetAtTime(0.0, now, timeConstant);
      }
      if (this.nightGainNode) {
        this.nightGainNode.gain.setTargetAtTime(0.22, now, timeConstant);
      }
    } else {
      // Golden Hour
      wGain.gain.setTargetAtTime(0.08, now, timeConstant);
      if (this.rainGainNode) {
        this.rainGainNode.gain.setTargetAtTime(0.0, now, timeConstant);
      }
      if (this.nightGainNode) {
        this.nightGainNode.gain.setTargetAtTime(0.0, now, timeConstant);
      }
    }
  }

  private ensureRainLoop() {
    if (this.isRainGenerating) return;
    this.isRainGenerating = true;
    this.playRainDroplets();
  }

  private playRainDroplets() {
    if (!this.ctx || !this.rainGainNode) {
      this.isRainGenerating = false;
      return;
    }

    // Only synthesize droplets if rain volume bus is active
    if (this.currentWeather === 'cozy_rain' || this.rainGainNode.gain.value > 0.005) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1300 + Math.random() * 800, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.05);

      gain.gain.setValueAtTime(0.016, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.rainGainNode);
      osc.start(now);
      osc.stop(now + 0.06);

      setTimeout(() => {
        this.playRainDroplets();
      }, 65 + Math.random() * 125);
    } else {
      this.isRainGenerating = false;
    }
  }

  // --- Sound Effects ---

  public playFootstep() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playJump() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.16);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playMushroomBounce() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    // Deep elastic boing
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.45);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  public playCollectible() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.45);
    });
  }

  public playCheckpoint() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Resonant singing bowl / peaceful chime
    const baseFreq = 440; // A4
    [1, 2.01, 3.02, 4.04].forEach((harmonic, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * harmonic, now);

      const amp = 0.12 / (idx + 1);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 2.6);
    });
  }

  public playRespawnPuff() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.35);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playUpdraft() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(540, now + 0.5);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playEnemyBoop() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    // Bright cheerful bouncy pop
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playEnemyBonk() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playWindGust() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(360, now + 0.3);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playCameraShutter() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // 1st click
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(850, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.04);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.06);

    // 2nd shutter mechanical snap
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1400, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(320, now + 0.13);
    gain2.gain.setValueAtTime(0.22, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.16);
  }

  public playWoodRattle() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playSteamPuff() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(520, now + 0.25);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playVictory() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Triumphant cozy bell cascade: C, E, G, B, D, E
    const notes = [261.63, 329.63, 392.00, 493.88, 587.33, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.8);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 1.9);
    });
  }

  public playTimeBonus() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Ascending high crystal chime for time bonus
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.4);
    });
  }

  public playTimeWarning() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(740, now + 0.08);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playStalkerWarning() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(65, now + 0.35);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  public playGameOver() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Sad descending minor chord
    const notes = [440, 392, 349.23, 293.66]; // A4, G4, F4, D4
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.12, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.6);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.65);
    });
  }


  public dispose() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundManager = new SoundtrackSynthesizer();
