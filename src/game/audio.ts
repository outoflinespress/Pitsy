// Procedural 16-bit SNES/SPC700-inspired polyphonic Web Audio synthesizer

type BgmTrack = 'none' | 'map' | 'stage' | 'intro';

class Retro16BitAudioEngine {
  private ctx: AudioContext | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private currentTrack: BgmTrack = 'none';
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  private ensureContext(): { ctx: AudioContext; out: AudioNode } | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      // Warm 16-bit SNES low-pass master bus (softens raw square harshness into lush synth tone)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 4400;
      this.masterFilter.Q.value = 0.7;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.92;

      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.masterFilter) return null;
    return { ctx: this.ctx, out: this.masterFilter };
  }

  public unlock(): void {
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (m) {
      this.stopBgmTimer();
    } else if (this.currentTrack !== 'none') {
      this.scheduleBgm();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // Warm 16-bit dual-detuned voice for lush SNES brass/bell/flute feel
  private playVoice(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.08,
    delay = 0,
    detuneCents = 0
  ): void {
    if (this.muted) return;
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.detune.setValueAtTime(detuneCents, now);
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.02, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  // Chorus-layered 16-bit note
  private playSynthNote(
    freq: number,
    duration: number,
    volume = 0.04,
    delay = 0,
    wave: OscillatorType = 'sawtooth'
  ): void {
    this.playVoice(freq, freq, duration, wave, volume * 0.55, delay, -5);
    this.playVoice(freq, freq, duration, 'triangle', volume * 0.8, delay, 5);
  }

  private playNoise(duration: number, volume = 0.05, filterFreq = 1600, delay = 0): void {
    if (this.muted) return;
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  // Expressive 16-bit formant-filtered happy kitten "Meee-ow!" with warm vibrato + happy chirp
  public playMeow(pitchScale = 1.0, happy = true): void {
    if (this.muted) return;
    const bus = this.ensureContext();
    if (!bus) return;
    const { ctx, out } = bus;

    const now = ctx.currentTime;
    const base = 540 * pitchScale;

    // Formant bandpass filter sweeping like a kitten's mouth opening & closing ("ee-aa-oo")
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 2.4;
    formant.frequency.setValueAtTime(base * 1.9, now);
    formant.frequency.exponentialRampToValueAtTime(base * 3.1, now + 0.09);
    formant.frequency.exponentialRampToValueAtTime(base * 1.4, now + 0.28);
    formant.connect(out);

    // Rich sawtooth vocal cords + warm triangle fundamental
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    // Pitch contour: playful rise then sweet downward sigh
    [osc1, osc2].forEach((osc, i) => {
      const mult = i === 0 ? 1 : 1.005;
      osc.frequency.setValueAtTime(base * 0.88 * mult, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.66 * mult, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(base * 1.52 * mult, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(base * 0.94 * mult, now + 0.3);
    });

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gain1.gain.setValueAtTime(0.13, now + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.09, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.29);

    osc1.connect(gain1);
    gain1.connect(out);
    osc2.connect(gain2);
    gain2.connect(formant);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.33);
    osc2.stop(now + 0.33);

    if (happy) {
      // Joyful high purr-trill chirp!
      const t2 = now + 0.27;
      this.playVoice(base * 1.25, base * 1.95, 0.11, 'triangle', 0.11, 0.27);
      this.playVoice(base * 1.95, base * 1.6, 0.12, 'sine', 0.09, 0.36);
      void t2;
    }
  }

  public playJump(): void {
    this.playVoice(240, 560, 0.15, 'triangle', 0.09);
    this.playVoice(360, 740, 0.11, 'sine', 0.045, 0.015);
  }

  public playWingFlutter(): void {
    this.playVoice(340, 480, 0.08, 'triangle', 0.065);
    this.playNoise(0.06, 0.03, 2100);
  }

  public playFirePuff(isStar = false): void {
    if (isStar) {
      this.playSynthNote(659, 0.12, 0.06, 0, 'triangle');
      this.playSynthNote(988, 0.14, 0.06, 0.03, 'sine');
      this.playSynthNote(1319, 0.16, 0.05, 0.06, 'sine');
    } else {
      this.playVoice(460, 145, 0.16, 'sawtooth', 0.065);
      this.playNoise(0.11, 0.05, 950);
    }
  }

  public playTailBounce(): void {
    this.playVoice(165, 680, 0.2, 'triangle', 0.12);
    this.playVoice(260, 820, 0.16, 'sine', 0.06, 0.02);
  }

  public playEmberDash(): void {
    this.playVoice(540, 190, 0.18, 'sawtooth', 0.065);
    this.playNoise(0.16, 0.06, 1500);
  }

  public playWallKick(): void {
    this.playVoice(290, 650, 0.12, 'triangle', 0.09);
    this.playNoise(0.04, 0.035, 2400);
  }

  public playDoubleFlap(): void {
    this.playVoice(392, 784, 0.14, 'triangle', 0.095);
    this.playVoice(523, 1047, 0.12, 'sine', 0.055, 0.03);
  }

  public playStomp(): void {
    this.playVoice(300, 95, 0.12, 'triangle', 0.11);
    this.playVoice(440, 740, 0.11, 'sine', 0.065, 0.05);
  }

  public playTreat(): void {
    this.playSynthNote(659, 0.08, 0.065, 0, 'triangle');
    this.playSynthNote(988, 0.14, 0.065, 0.055, 'triangle');
    this.playVoice(1319, 1340, 0.12, 'sine', 0.04, 0.08);
  }

  public playHeal(): void {
    // Cheerful 16-bit rising heart-restore arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      this.playSynthNote(n, 0.14, 0.065, i * 0.06, 'triangle');
      this.playVoice(n * 1.5, n * 1.5, 0.12, 'sine', 0.035, i * 0.06 + 0.02);
    });
  }

  public playHurt(): void {
    this.playVoice(210, 88, 0.24, 'sawtooth', 0.08);
    this.playNoise(0.16, 0.055, 750);
  }

  public playFootstep(): void {
    this.playVoice(175, 235, 0.05, 'triangle', 0.055);
  }

  public playLockClink(): void {
    this.playVoice(210, 150, 0.09, 'triangle', 0.07);
    this.playVoice(150, 118, 0.11, 'sawtooth', 0.045, 0.06);
  }

  public playAlarmExclaim(): void {
    this.playSynthNote(587, 0.1, 0.07, 0, 'sawtooth');
    this.playSynthNote(880, 0.16, 0.07, 0.08, 'sawtooth');
  }

  public playFeatherChime(): void {
    const notes = [784, 988, 1175, 1319, 1568];
    notes.forEach((n, i) => {
      this.playVoice(n, n * 1.01, 0.22, 'sine', 0.05, i * 0.075);
      this.playVoice(n * 0.5, n * 0.5, 0.18, 'triangle', 0.03, i * 0.075);
    });
  }

  public playUnlockFanfare(): void {
    const notes = [392, 494, 587, 784, 988];
    notes.forEach((n, i) => {
      this.playSynthNote(n, 0.2, 0.065, i * 0.09, 'sawtooth');
      this.playVoice(n * 0.5, n * 0.5, 0.22, 'triangle', 0.06, i * 0.09);
    });
    // Shimmering major chord finale
    this.playSynthNote(784, 0.45, 0.05, 0.42, 'triangle');
    this.playSynthNote(988, 0.45, 0.05, 0.42, 'triangle');
    this.playSynthNote(1175, 0.45, 0.05, 0.42, 'triangle');
  }

  public playRescueFanfare(meowPitch = 1.0): void {
    // Kitten meows happily first!
    this.playMeow(meowPitch, true);
    // Warm 16-bit SNES victory fanfare with chord harmony
    const melody = [523, 659, 784, 1047, 988, 1047];
    const harm = [330, 392, 523, 659, 587, 659];
    const delays = [0.38, 0.5, 0.62, 0.76, 0.92, 1.04];
    const durs = [0.13, 0.13, 0.15, 0.18, 0.13, 0.42];
    melody.forEach((n, i) => {
      this.playSynthNote(n, durs[i], 0.065, delays[i], 'sawtooth');
      this.playVoice(harm[i], harm[i], durs[i], 'triangle', 0.055, delays[i]);
      this.playVoice(n * 0.5, n * 0.5, durs[i], 'sine', 0.05, delays[i]);
    });
  }

  // Lush 3-channel 16-bit SNES chiptune BGM loops (lead + chord pad + melodic bass)
  public startBgm(track: BgmTrack): void {
    if (this.currentTrack === track && this.bgmTimer !== null) return;
    this.currentTrack = track;
    this.bgmStep = 0;
    this.stopBgmTimer();
    if (!this.muted && track !== 'none') {
      this.scheduleBgm();
    }
  }

  public stopBgm(): void {
    this.currentTrack = 'none';
    this.stopBgmTimer();
  }

  private stopBgmTimer(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private scheduleBgm(): void {
    this.stopBgmTimer();
    const mapLead = [392, 440, 494, 587, 523, 494, 440, 392, 330, 392, 440, 523, 494, 440, 392, 0];
    const mapPad = [247, 0, 294, 0, 330, 0, 294, 0, 196, 0, 262, 0, 294, 0, 247, 0];
    const mapBass = [196, 0, 196, 220, 262, 0, 220, 0, 165, 0, 196, 220, 247, 0, 196, 0];

    const stageLead = [523, 0, 659, 587, 523, 392, 440, 0, 587, 659, 784, 659, 587, 523, 440, 494];
    const stagePad = [330, 392, 330, 392, 262, 330, 262, 330, 349, 440, 349, 440, 330, 392, 294, 392];
    const stageBass = [262, 196, 262, 196, 220, 165, 220, 165, 294, 220, 294, 220, 247, 196, 247, 196];

    const introLead = [330, 392, 440, 392, 330, 294, 330, 0];
    const introPad = [262, 0, 294, 0, 262, 0, 247, 0];
    const introBass = [165, 0, 196, 0, 165, 0, 147, 0];

    const tempoMs = this.currentTrack === 'stage' ? 190 : this.currentTrack === 'map' ? 240 : 275;

    this.bgmTimer = window.setInterval(() => {
      if (this.muted || this.currentTrack === 'none') return;
      const lead = this.currentTrack === 'stage' ? stageLead : this.currentTrack === 'map' ? mapLead : introLead;
      const pad = this.currentTrack === 'stage' ? stagePad : this.currentTrack === 'map' ? mapPad : introPad;
      const bass = this.currentTrack === 'stage' ? stageBass : this.currentTrack === 'map' ? mapBass : introBass;
      const idx = this.bgmStep % lead.length;
      const dur = (tempoMs / 1000) * 0.86;

      if (lead[idx] > 0) {
        this.playSynthNote(lead[idx], dur, 0.025, 0, 'sawtooth');
      }
      if (pad[idx] > 0) {
        this.playVoice(pad[idx], pad[idx], dur * 1.15, 'sine', 0.018);
      }
      if (bass[idx] > 0) {
        this.playVoice(bass[idx], bass[idx], dur, 'triangle', 0.036);
      }
      this.bgmStep++;
    }, tempoMs);
  }
}

export const audio = new Retro16BitAudioEngine();
