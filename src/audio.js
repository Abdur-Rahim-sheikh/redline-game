export class AudioEngine {
  constructor({ muted = false } = {}) {
    this.muted = muted;
    this.context = null;
    this.master = null;
    this.humGain = null;
    this.humOscillator = null;
    this.humFilter = null;
    this.started = false;
  }

  unlock() {
    if (this.muted) return;

    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!this.context) {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0.72;
        this.master.connect(this.context.destination);
        this.#createHum();
      }

      if (this.context.state === "suspended") {
        void this.context.resume();
      }
    } catch {
      this.context = null;
    }
  }

  #createHum() {
    this.humOscillator = this.context.createOscillator();
    this.humOscillator.type = "sawtooth";
    this.humOscillator.frequency.value = 48;

    this.humFilter = this.context.createBiquadFilter();
    this.humFilter.type = "lowpass";
    this.humFilter.frequency.value = 180;
    this.humFilter.Q.value = 2.2;

    this.humGain = this.context.createGain();
    this.humGain.gain.value = 0.0001;

    this.humOscillator.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.master);
    this.humOscillator.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.context || !this.master) return;

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0.0001 : 0.72, now, 0.025);

    if (!muted && this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  setRush({ active, speedRatio = 0, boosting = false }) {
    if (!this.context || !this.humGain || this.muted) return;

    const now = this.context.currentTime;
    const frequency = 45 + speedRatio * 72 + (boosting ? 12 : 0);
    const volume = active ? 0.025 + speedRatio * 0.038 : 0.0001;
    this.humOscillator.frequency.setTargetAtTime(frequency, now, 0.045);
    this.humFilter.frequency.setTargetAtTime(150 + speedRatio * 310, now, 0.06);
    this.humGain.gain.setTargetAtTime(volume, now, 0.07);
  }

  playStart() {
    this.unlock();
    this.#tone({ frequency: 280, endFrequency: 660, duration: 0.18, volume: 0.14, type: "square" });
  }

  playNearMiss(chain = 1) {
    this.#tone({
      frequency: 600 + Math.min(chain, 5) * 60,
      endFrequency: 980 + Math.min(chain, 5) * 70,
      duration: 0.11,
      volume: 0.1,
      type: "triangle",
    });
  }

  playCrash() {
    if (!this.context || !this.master || this.muted) return;

    const duration = 0.42;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const fade = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * fade * fade;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, this.context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(110, this.context.currentTime + duration);
    const gain = this.context.createGain();
    gain.gain.value = 0.34;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();

    this.#tone({ frequency: 90, endFrequency: 38, duration: 0.46, volume: 0.2, type: "sawtooth" });
  }

  #tone({ frequency, endFrequency = frequency, duration, volume, type = "sine" }) {
    if (!this.context || !this.master || this.muted) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
