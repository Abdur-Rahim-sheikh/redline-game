export class AudioEngine {
  constructor({ muted = false } = {}) {
    this.muted = muted;
    this.context = null;
    this.master = null;
  }

  unlock() {
    if (this.muted) return;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!this.context) {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0.68;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") void this.context.resume();
    } catch {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0.0001 : 0.68, now, 0.025);
    if (!muted && this.context.state === "suspended") void this.context.resume();
  }

  playFlap() {
    this.unlock();
    this.#tone({ frequency: 310, endFrequency: 520, duration: 0.075, volume: 0.075, type: "triangle" });
  }

  playPoint(streak = 1) {
    const lift = Math.min(streak, 6) * 35;
    this.#tone({ frequency: 620 + lift, endFrequency: 900 + lift, duration: 0.12, volume: 0.1, type: "sine" });
  }

  playCrash() {
    if (!this.context || !this.master || this.muted) return;
    const duration = 0.32;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const fade = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * fade * fade;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(780, this.context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(130, this.context.currentTime + duration);
    gain.gain.value = 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    this.#tone({ frequency: 150, endFrequency: 55, duration: 0.3, volume: 0.14, type: "sawtooth" });
  }

  #tone({ frequency, endFrequency, duration, volume, type }) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
