import {
  circleIntersectsGate,
  clamp,
  createGatePattern,
  formatScore,
  lerp,
  safeStorage,
  smoothTowards,
} from "./core.js";
import { AudioEngine } from "./audio.js";

const BEST_SCORE_KEY = "redline-v2-best-score";
const SOUND_KEY = "redline-muted";
const VORTEX_Y_RATIO = 0.11;
const GATE_COLORS = ["#ff3157", "#ff6038", "#c62cff"];

export class RedlineGame {
  constructor(canvas, elements, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.elements = elements;
    this.callbacks = callbacks;
    this.storage = safeStorage();
    this.muted = this.storage.get(SOUND_KEY, "false") === "true";
    this.audio = new AudioEngine({ muted: this.muted });
    this.reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    this.state = "ready";
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.lastFrame = performance.now();
    this.elapsed = 0;
    this.score = 0;
    this.speed = 280;
    this.speedRatio = 0;
    this.rushAmount = 0;
    this.multiplier = 1;
    this.gateChain = 0;
    this.gates = [];
    this.particles = [];
    this.stars = [];
    this.depthOffset = 0;
    this.spawnTimer = 0.15;
    this.lastGapCenter = null;
    this.pointerActive = false;
    this.boosting = false;
    this.shake = 0;
    this.flash = 0;
    this.idleTime = 0;
    this.messageTimer = 0;
    this.core = { x: 0, y: 0, radius: 17, targetX: 0, lean: 0 };
    this.bestScore = Number.parseInt(this.storage.get(BEST_SCORE_KEY, "0"), 10) || 0;

    this.#bindEvents();
    this.resize();
    this.#syncSoundButton();
    this.#updateHud(true);
    requestAnimationFrame((time) => this.#frame(time));
  }

  #bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.state !== "playing" || event.button > 0) return;
      event.preventDefault();
      this.pointerActive = true;
      this.boosting = true;
      this.canvas.setPointerCapture?.(event.pointerId);
      this.#setTargetFromClientX(event.clientX);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.state !== "playing" || !this.pointerActive) return;
      event.preventDefault();
      this.#setTargetFromClientX(event.clientX);
    });

    const releasePointer = (event) => {
      if (this.pointerActive) event.preventDefault();
      this.pointerActive = false;
      this.boosting = false;
    };
    this.canvas.addEventListener("pointerup", releasePointer);
    this.canvas.addEventListener("pointercancel", releasePointer);
    this.canvas.addEventListener("lostpointercapture", () => {
      this.pointerActive = false;
      this.boosting = false;
    });

    globalThis.addEventListener("keydown", (event) => {
      if (this.state !== "playing") return;
      if (event.code === "ArrowLeft") {
        this.core.targetX -= this.#fieldWidth() * 0.11;
        event.preventDefault();
      } else if (event.code === "ArrowRight") {
        this.core.targetX += this.#fieldWidth() * 0.11;
        event.preventDefault();
      } else if (event.code === "Space") {
        this.boosting = true;
        event.preventDefault();
      }
      this.#constrainCore();
    });

    globalThis.addEventListener("keyup", (event) => {
      if (event.code === "Space") this.boosting = false;
    });

    globalThis.addEventListener("resize", () => this.resize(), { passive: true });
    globalThis.visualViewport?.addEventListener("resize", () => this.resize(), { passive: true });
    document.addEventListener("visibilitychange", () => {
      this.lastFrame = performance.now();
      if (document.hidden) {
        this.pointerActive = false;
        this.boosting = false;
        this.audio.setRush({ active: false });
      }
    });
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const oldWidth = this.width || bounds.width;
    this.width = Math.max(280, bounds.width);
    this.height = Math.max(480, bounds.height);
    this.pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);

    const horizontalScale = this.width / oldWidth;
    this.core.radius = clamp(this.width * 0.043, 15, 22);
    this.core.y = this.height * 0.76;
    this.core.x = this.core.x ? this.core.x * horizontalScale : this.width / 2;
    this.core.targetX = this.core.targetX ? this.core.targetX * horizontalScale : this.width / 2;
    this.#constrainCore();
    this.#createGradients();
    if (this.stars.length === 0) this.#createStars();
  }

  #createGradients() {
    this.backgroundGradient = this.context.createLinearGradient(0, 0, 0, this.height);
    this.backgroundGradient.addColorStop(0, "#090619");
    this.backgroundGradient.addColorStop(0.48, "#070b19");
    this.backgroundGradient.addColorStop(1, "#02040a");
  }

  #createStars() {
    const count = this.reduceMotion ? 28 : 52;
    this.stars = Array.from({ length: count }, (_, index) => ({
      x: (Math.sin(index * 91.37) * 0.5 + 0.5),
      y: (Math.sin(index * 47.91 + 1.4) * 0.5 + 0.5),
      size: 0.6 + (index % 5) * 0.34,
      layer: 0.45 + (index % 7) / 7,
      twinkle: index * 1.71,
    }));
  }

  start() {
    this.state = "playing";
    this.elapsed = 0;
    this.score = 0;
    this.speed = 280;
    this.speedRatio = 0;
    this.rushAmount = 0;
    this.multiplier = 1;
    this.gateChain = 0;
    this.gates.length = 0;
    this.particles.length = 0;
    this.spawnTimer = 1.02;
    this.lastGapCenter = null;
    this.pointerActive = false;
    this.boosting = false;
    this.shake = 0;
    this.flash = 0;
    this.core.x = this.width / 2;
    this.core.targetX = this.width / 2;
    this.core.lean = 0;
    this.#addGate(0, this.height * 0.17);
    this.audio.playStart();
    this.#updateHud(true);
    this.callbacks.onStart?.();
    this.showMessage("HOLD + DRAG", false, 1.15);
  }

  toggleSound() {
    this.muted = !this.muted;
    this.storage.set(SOUND_KEY, String(this.muted));
    this.audio.setMuted(this.muted);
    if (!this.muted) this.audio.unlock();
    this.#syncSoundButton();
    return this.muted;
  }

  #syncSoundButton() {
    const button = this.elements.soundButton;
    button?.setAttribute("aria-pressed", String(this.muted));
    button?.setAttribute("aria-label", this.muted ? "Turn sound on" : "Mute sound");
  }

  #fieldWidth() {
    return Math.min(this.width * 0.94, 620);
  }

  #fieldBounds() {
    const fieldWidth = this.#fieldWidth();
    return {
      left: this.width / 2 - fieldWidth / 2,
      right: this.width / 2 + fieldWidth / 2,
      width: fieldWidth,
    };
  }

  #setTargetFromClientX(clientX) {
    const bounds = this.canvas.getBoundingClientRect();
    this.core.targetX = ((clientX - bounds.left) / bounds.width) * this.width;
    this.#constrainCore();
  }

  #constrainCore() {
    const field = this.#fieldBounds();
    const inset = this.core.radius * 1.25;
    this.core.targetX = clamp(this.core.targetX, field.left + inset, field.right - inset);
    this.core.x = clamp(this.core.x, field.left + inset, field.right - inset);
  }

  #frame(time) {
    const deltaSeconds = Math.min(0.034, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    this.#update(deltaSeconds);
    this.#render();
    requestAnimationFrame((nextTime) => this.#frame(nextTime));
  }

  #update(deltaSeconds) {
    this.idleTime += deltaSeconds;
    this.messageTimer = Math.max(0, this.messageTimer - deltaSeconds);
    if (this.messageTimer === 0) this.elements.message?.classList.remove("is-visible");

    if (this.state === "playing") {
      this.#updatePlaying(deltaSeconds);
    } else {
      const idleVelocity = this.state === "gameover" ? 0.08 : 0.12;
      this.depthOffset = (this.depthOffset + deltaSeconds * idleVelocity) % 1;
      this.speed = smoothTowards(this.speed, 100, 2.5, deltaSeconds);
      this.audio.setRush({ active: false });
      this.#updateStars(deltaSeconds, 0.18);
      this.#updateParticles(deltaSeconds);
    }

    this.shake = Math.max(0, this.shake - deltaSeconds * 30);
    this.flash = Math.max(0, this.flash - deltaSeconds * 2.8);
  }

  #updatePlaying(deltaSeconds) {
    this.elapsed += deltaSeconds;
    const difficulty = clamp(this.elapsed / 55, 0, 1);
    this.rushAmount = clamp(this.rushAmount + (this.boosting ? deltaSeconds * 0.74 : -deltaSeconds * 0.5), 0, 1);
    this.multiplier = 1 + this.rushAmount * 3;

    const cruiseSpeed = Math.min(305 + this.elapsed * 4.5, 535);
    const rushSpeed = Math.min(585 + this.elapsed * 8, 940);
    const targetSpeed = lerp(cruiseSpeed, rushSpeed, this.rushAmount);
    this.speed = smoothTowards(this.speed, targetSpeed, this.boosting ? 2.8 : 1.9, deltaSeconds);
    this.speedRatio = clamp((this.speed - 280) / 660, 0, 1);
    this.score += this.speed * deltaSeconds * 0.048 * this.multiplier;
    this.depthOffset = (this.depthOffset + this.speed * deltaSeconds / 720) % 1;

    const previousX = this.core.x;
    this.#constrainCore();
    this.core.x = smoothTowards(this.core.x, this.core.targetX, 14.5, deltaSeconds);
    const movement = this.core.x - previousX;
    this.core.lean = smoothTowards(this.core.lean, clamp(movement * 0.065, -0.22, 0.22), 10, deltaSeconds);

    const trailRate = this.reduceMotion ? 13 : 34;
    if (Math.random() < trailRate * deltaSeconds) this.#spawnTrail();
    this.#spawnGates(deltaSeconds, difficulty);
    this.#updateGates(deltaSeconds);
    if (this.state !== "playing") {
      this.#updateParticles(deltaSeconds);
      return;
    }
    this.#updateStars(deltaSeconds, 0.32 + this.speedRatio * 1.45);
    this.#updateParticles(deltaSeconds);
    this.#updateHud();
    this.audio.setRush({ active: true, speedRatio: this.speedRatio, boosting: this.boosting });
  }

  #spawnGates(deltaSeconds, difficulty) {
    this.spawnTimer -= deltaSeconds;
    if (this.spawnTimer > 0) return;

    this.#addGate(difficulty);
    this.spawnTimer = Math.max(0.68, 1.02 - difficulty * 0.2 + Math.random() * 0.16);
  }

  #addGate(difficulty, y = -28) {
    const pattern = createGatePattern(difficulty, this.lastGapCenter);
    this.lastGapCenter = pattern.center;
    this.gates.push({
      y,
      center: pattern.center,
      width: pattern.width,
      baseThickness: clamp(this.height * 0.019, 11, 18),
      color: GATE_COLORS[Math.floor(Math.random() * GATE_COLORS.length)],
      seed: Math.random(),
      passed: false,
    });
  }

  #gateGeometry(gate) {
    const field = this.#fieldBounds();
    const depth = clamp(gate.y / this.height, 0, 1);
    const gapWidth = gate.width * field.width;
    const gapCenter = field.left + gate.center * field.width;
    return {
      y: gate.y,
      gapCenter,
      gapWidth,
      gapLeft: gapCenter - gapWidth / 2,
      gapRight: gapCenter + gapWidth / 2,
      thickness: gate.baseThickness * lerp(0.72, 1.28, depth),
      field,
      depth,
    };
  }

  #updateGates(deltaSeconds) {
    for (const gate of this.gates) {
      const depth = clamp(gate.y / this.height, 0, 1);
      gate.y += this.speed * (0.76 + depth * 0.5) * deltaSeconds;
      const geometry = this.#gateGeometry(gate);

      if (circleIntersectsGate(this.core, geometry)) {
        this.#crash();
        return;
      }

      if (!gate.passed && geometry.y - geometry.thickness / 2 > this.core.y + this.core.radius) {
        gate.passed = true;
        this.#scoreGatePass(geometry);
      }
    }

    this.gates = this.gates.filter((gate) => gate.y < this.height + 90);
  }

  #scoreGatePass(geometry) {
    const coreEdgeRadius = this.core.radius * 0.7;
    const leftClearance = this.core.x - coreEdgeRadius - geometry.gapLeft;
    const rightClearance = geometry.gapRight - (this.core.x + coreEdgeRadius);
    const edgeClearance = Math.min(leftClearance, rightClearance);
    const centerDistance = Math.abs(this.core.x - geometry.gapCenter);

    if (centerDistance < geometry.gapWidth * 0.095) {
      this.gateChain = Math.min(9, this.gateChain + 1);
      const bonus = 110 * this.gateChain * Math.max(1, this.multiplier);
      this.score += bonus;
      this.flash = Math.max(this.flash, 0.18);
      this.audio.playNearMiss(this.gateChain);
      this.showMessage(`PERFECT  +${Math.floor(bonus)}`, false, 0.72);
      if (!this.reduceMotion && navigator.vibrate) navigator.vibrate(12);
      return;
    }

    if (edgeClearance < this.core.radius * 1.35) {
      this.gateChain = Math.min(9, this.gateChain + 1);
      const bonus = 75 * this.gateChain * Math.max(1, this.multiplier);
      this.score += bonus;
      this.flash = Math.max(this.flash, 0.24);
      this.audio.playNearMiss(this.gateChain);
      this.showMessage(`EDGE RUSH  +${Math.floor(bonus)}`, true, 0.72);
      if (!this.reduceMotion && navigator.vibrate) navigator.vibrate(18);
      return;
    }

    this.gateChain = 0;
  }

  #crash() {
    if (this.state !== "playing") return;
    this.state = "gameover";
    this.boosting = false;
    this.pointerActive = false;
    this.shake = this.reduceMotion ? 2 : 15;
    this.flash = 1;
    this.#spawnExplosion();
    this.audio.playCrash();
    this.audio.setRush({ active: false });
    if (!this.reduceMotion && navigator.vibrate) navigator.vibrate([90, 45, 140]);

    const finalScore = Math.floor(this.score);
    const isNewBest = finalScore > this.bestScore;
    if (isNewBest) {
      this.bestScore = finalScore;
      this.storage.set(BEST_SCORE_KEY, String(finalScore));
    }

    globalThis.setTimeout(() => {
      this.callbacks.onGameOver?.({
        score: finalScore,
        bestScore: this.bestScore,
        isNewBest,
        elapsed: this.elapsed,
      });
    }, this.reduceMotion ? 80 : 430);
  }

  #spawnTrail() {
    const amount = this.boosting && !this.reduceMotion ? 2 : 1;
    for (let index = 0; index < amount; index += 1) {
      this.particles.push({
        x: this.core.x + (Math.random() - 0.5) * this.core.radius * 0.8,
        y: this.core.y + this.core.radius * 0.7,
        vx: (Math.random() - 0.5) * 30,
        vy: 74 + this.speedRatio * 150 + Math.random() * 70,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.5,
        size: 1.5 + Math.random() * 4,
        color: Math.random() > 0.45 ? "#67f7ff" : "#ff3157",
      });
    }
  }

  #spawnExplosion() {
    const amount = this.reduceMotion ? 16 : 58;
    for (let index = 0; index < amount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 80 + Math.random() * 330;
      this.particles.push({
        x: this.core.x,
        y: this.core.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.35 + Math.random() * 0.75,
        maxLife: 1.1,
        size: 2 + Math.random() * 8,
        color: ["#ffffff", "#67f7ff", "#ff3157", "#b62cff"][Math.floor(Math.random() * 4)],
      });
    }
  }

  #updateStars(deltaSeconds, velocity) {
    for (const star of this.stars) {
      star.y += deltaSeconds * velocity * star.layer;
      if (star.y > 1.05) {
        star.y = -0.05;
        star.x = (star.x * 1.731 + 0.317) % 1;
      }
    }
  }

  #updateParticles(deltaSeconds) {
    for (const particle of this.particles) {
      particle.life -= deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= Math.pow(0.96, deltaSeconds * 60);
      particle.vy += 45 * deltaSeconds;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0).slice(-190);
  }

  #updateHud(force = false) {
    if (!force && this.state !== "playing") return;
    this.elements.score.textContent = formatScore(this.score);
    this.elements.speed.textContent = `${(1 + this.speedRatio * 2.2).toFixed(1)}×`;
    this.elements.multiplier.textContent = `×${this.multiplier.toFixed(1)}`;
    this.elements.multiplier.classList.toggle("is-hot", this.multiplier >= 2.4);
    this.elements.boostLabel.textContent = this.boosting ? "REDLINING" : "HOLD TO RUSH";
    this.elements.boostLabel.classList.toggle("is-active", this.boosting);
  }

  showMessage(text, danger = false, duration = 0.8) {
    const element = this.elements.message;
    element.textContent = text;
    element.classList.toggle("is-danger", danger);
    element.classList.add("is-visible");
    this.messageTimer = duration;
  }

  #render() {
    const context = this.context;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    context.save();

    if (this.shake > 0 && !this.reduceMotion) {
      context.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.#drawWorld(context);
    context.restore();

    if (this.flash > 0) {
      const green = this.state === "gameover" ? 35 : 170;
      context.fillStyle = `rgba(255, ${green}, 105, ${this.flash * 0.2})`;
      context.fillRect(0, 0, this.width, this.height);
    }
  }

  #drawWorld(context) {
    context.fillStyle = this.backgroundGradient;
    context.fillRect(0, 0, this.width, this.height);
    this.#drawVortex(context);
    this.#drawStars(context);

    const orderedGates = [...this.gates].sort((first, second) => first.y - second.y);
    for (const gate of orderedGates) this.#drawGate(context, gate);

    this.#drawParticles(context);
    this.#drawCore(context);
    this.#drawVignette(context);
  }

  #drawVortex(context) {
    const vortexY = this.height * VORTEX_Y_RATIO;
    const field = this.#fieldBounds();
    const glowRadius = clamp(this.width * 0.24, 80, 170);
    const glow = context.createRadialGradient(this.width / 2, vortexY, 0, this.width / 2, vortexY, glowRadius);
    glow.addColorStop(0, "rgba(104, 69, 255, .34)");
    glow.addColorStop(0.38, "rgba(255, 44, 105, .12)");
    glow.addColorStop(1, "rgba(20, 10, 60, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(this.width / 2, vortexY, glowRadius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(127, 111, 255, .12)";
    context.lineWidth = 1;
    for (let index = 0; index <= 6; index += 1) {
      const targetX = lerp(field.left, field.right, index / 6);
      context.beginPath();
      context.moveTo(this.width / 2, vortexY);
      context.lineTo(targetX, this.height);
      context.stroke();
    }

    for (let index = 0; index < 11; index += 1) {
      const progress = ((index / 11 + this.depthOffset) % 1 + 1) % 1;
      const eased = Math.pow(progress, 1.72);
      const y = vortexY + eased * (this.height - vortexY);
      const ringWidth = lerp(field.width * 0.08, field.width * 1.08, Math.pow(progress, 0.92));
      const ringHeight = ringWidth * 0.19;
      context.strokeStyle = `rgba(${progress > 0.62 ? "255,49,87" : "104,109,255"},${0.08 + progress * 0.17})`;
      context.lineWidth = 0.7 + progress * 2.1;
      context.beginPath();
      context.ellipse(this.width / 2, y, ringWidth / 2, ringHeight / 2, 0, 0, Math.PI * 2);
      context.stroke();
    }
  }

  #drawStars(context) {
    const vortexY = this.height * VORTEX_Y_RATIO;
    for (const star of this.stars) {
      const y = vortexY + star.y * (this.height - vortexY);
      const spread = Math.pow(clamp(star.y, 0, 1), 0.7);
      const rawX = star.x * this.width;
      const x = lerp(this.width / 2, rawX, 0.3 + spread * 0.7);
      const alpha = 0.22 + (Math.sin(this.idleTime * 2.2 + star.twinkle) * 0.5 + 0.5) * 0.48;
      const streak = this.reduceMotion ? 1 : 2 + this.speedRatio * 28 * star.layer;
      context.strokeStyle = `rgba(178, 229, 255, ${alpha})`;
      context.lineWidth = star.size;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + streak);
      context.stroke();
    }
  }

  #drawGate(context, gate) {
    const geometry = this.#gateGeometry(gate);
    const { field, y, gapLeft, gapRight, thickness, depth } = geometry;
    const alpha = clamp(0.55 + depth * 0.55, 0, 1);
    const pulse = Math.sin(this.idleTime * 7 + gate.seed * 19) * 0.5 + 0.5;

    context.save();
    context.globalAlpha = alpha;
    this.#drawGateSpan(context, field.left, gapLeft, y, thickness, gate, depth, 1);
    this.#drawGateSpan(context, gapRight, field.right, y, thickness, gate, depth, -1);
    this.#drawGateEmitter(context, gapLeft, y, thickness, gate, pulse, 1);
    this.#drawGateEmitter(context, gapRight, y, thickness, gate, pulse, -1);
    context.restore();
  }

  #drawGateSpan(context, startX, endX, y, thickness, gate, depth, direction) {
    const spanWidth = Math.max(0, endX - startX);
    if (spanWidth < 2) return;

    const glowHeight = thickness * (2.1 + depth * 0.7);
    context.fillStyle = `${gate.color}22`;
    context.fillRect(startX, y - glowHeight / 2, spanWidth, glowHeight);

    context.shadowColor = gate.color;
    context.shadowBlur = this.reduceMotion ? 3 : 7 + depth * 11;
    context.fillStyle = "rgba(16, 8, 28, .95)";
    context.fillRect(startX, y - thickness * 0.68, spanWidth, thickness * 1.36);
    context.shadowBlur = 0;

    const desiredCellWidth = 25 + depth * 15;
    const cellCount = Math.max(1, Math.ceil(spanWidth / desiredCellWidth));
    const cellWidth = spanWidth / cellCount;
    const cellGap = Math.min(3, cellWidth * 0.1);
    const scanPosition = ((this.idleTime * (72 + depth * 75) + gate.seed * spanWidth) % (spanWidth + cellWidth)) - cellWidth;

    for (let index = 0; index < cellCount; index += 1) {
      const cellX = startX + index * cellWidth + cellGap / 2;
      const width = Math.max(1, cellWidth - cellGap);
      const bevel = Math.min(thickness * 0.38, width * 0.18);
      const scanDistance = Math.abs(cellX + width / 2 - (startX + scanPosition));
      const scanned = scanDistance < cellWidth * 0.72;

      context.fillStyle = gate.color;
      context.globalAlpha *= index % 2 === 0 ? 0.94 : 0.72;
      context.beginPath();
      context.moveTo(cellX + bevel, y - thickness / 2);
      context.lineTo(cellX + width - bevel, y - thickness / 2);
      context.lineTo(cellX + width, y);
      context.lineTo(cellX + width - bevel, y + thickness / 2);
      context.lineTo(cellX + bevel, y + thickness / 2);
      context.lineTo(cellX, y);
      context.closePath();
      context.fill();
      context.globalAlpha /= index % 2 === 0 ? 0.94 : 0.72;

      context.fillStyle = scanned ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.3)";
      const markerWidth = Math.max(1.5, thickness * 0.13);
      context.fillRect(cellX + width / 2 - markerWidth / 2, y - thickness * 0.29, markerWidth, thickness * 0.58);

      context.strokeStyle = scanned ? "rgba(112,246,255,.95)" : "rgba(255,255,255,.14)";
      context.lineWidth = scanned ? 1.5 : 0.7;
      context.beginPath();
      context.moveTo(cellX + bevel, y - thickness * 0.34);
      context.lineTo(cellX + width - bevel, y - thickness * 0.34);
      context.stroke();
    }

    context.strokeStyle = "rgba(255,255,255,.78)";
    context.lineWidth = Math.max(1, thickness * 0.11);
    context.beginPath();
    context.moveTo(startX, y);
    context.lineTo(endX, y);
    context.stroke();

    const sparkPhase = (this.idleTime * 95 + gate.seed * 173) % Math.max(spanWidth, 1);
    const sparkX = direction > 0 ? startX + sparkPhase : endX - sparkPhase;
    if (sparkX > startX && sparkX < endX) {
      context.strokeStyle = "rgba(115,247,255,.82)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(sparkX - 7, y);
      context.lineTo(sparkX - 2, y - thickness * 0.5);
      context.lineTo(sparkX + 2, y + thickness * 0.45);
      context.lineTo(sparkX + 8, y);
      context.stroke();
    }
  }

  #drawGateEmitter(context, x, y, thickness, gate, pulse, direction) {
    const radius = thickness * (0.9 + pulse * 0.13);
    const rotation = this.reduceMotion ? gate.seed : this.idleTime * 1.8 * direction + gate.seed * 5;

    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.shadowColor = gate.color;
    context.shadowBlur = this.reduceMotion ? 4 : 10 + pulse * 7;
    context.strokeStyle = gate.color;
    context.lineWidth = Math.max(1.5, thickness * 0.16);
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 3;
      const nodeX = Math.cos(angle) * radius;
      const nodeY = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(nodeX, nodeY);
      else context.lineTo(nodeX, nodeY);
    }
    context.closePath();
    context.stroke();

    context.shadowBlur = 0;
    context.strokeStyle = "rgba(112,246,255,.7)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(0, 0, radius * 1.34, -0.65, 0.75);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, radius * 1.34, Math.PI - 0.65, Math.PI + 0.75);
    context.stroke();
    context.restore();

    context.fillStyle = "rgba(10,7,23,.96)";
    context.beginPath();
    context.arc(x, y, radius * 0.56, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = pulse > 0.55 ? "#ffffff" : "#8ff8ff";
    context.beginPath();
    context.arc(x, y, Math.max(1.5, thickness * 0.17), 0, Math.PI * 2);
    context.fill();

    if (!this.reduceMotion) {
      for (let index = 0; index < 2; index += 1) {
        const angle = this.idleTime * (2.6 + index) + gate.seed * 11 + index * Math.PI;
        const distance = radius * (1.45 + index * 0.3);
        context.fillStyle = index === 0 ? "#7cf7ff" : gate.color;
        context.beginPath();
        context.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 1.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  #drawCore(context) {
    const { x, y, radius, lean } = this.core;
    const pulse = 1 + Math.sin(this.idleTime * (this.boosting ? 14 : 6)) * 0.06;
    context.save();
    context.translate(x, y);
    context.rotate(lean);

    if (this.boosting && this.state === "playing") {
      const tailLength = radius * (2.4 + this.rushAmount * 2.3);
      const tail = context.createLinearGradient(0, radius * 0.3, 0, tailLength);
      tail.addColorStop(0, "rgba(104,247,255,.72)");
      tail.addColorStop(0.35, "rgba(255,49,87,.38)");
      tail.addColorStop(1, "rgba(255,49,87,0)");
      context.fillStyle = tail;
      context.beginPath();
      context.moveTo(-radius * 0.48, radius * 0.35);
      context.lineTo(0, tailLength);
      context.lineTo(radius * 0.48, radius * 0.35);
      context.closePath();
      context.fill();
    }

    context.strokeStyle = `rgba(101, 242, 255, ${0.3 + this.rushAmount * 0.35})`;
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(0, 0, radius * (1.55 + this.rushAmount * 0.35) * pulse, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "rgba(255,49,87,.38)";
    context.beginPath();
    context.arc(0, 0, radius * 1.95 * pulse, -0.45, Math.PI * 1.15);
    context.stroke();

    const glow = context.createRadialGradient(-radius * 0.25, -radius * 0.3, 0, 0, 0, radius * 1.4);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.22, "#a7fbff");
    glow.addColorStop(0.55, "#4e7dff");
    glow.addColorStop(0.78, "#d625ff");
    glow.addColorStop(1, "rgba(255,49,87,0)");
    context.fillStyle = glow;
    context.shadowColor = "#5defff";
    context.shadowBlur = this.reduceMotion ? 7 : 15 + this.rushAmount * 13;
    context.beginPath();
    context.ellipse(0, 0, radius * pulse, radius * (1 + this.speedRatio * 0.08) * pulse, 0, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const orbitAngle = this.idleTime * 2.8;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(Math.cos(orbitAngle) * radius * 1.55, Math.sin(orbitAngle) * radius * 0.75, 2.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawParticles(context) {
    for (const particle of this.particles) {
      context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * clamp(particle.life / particle.maxLife, 0.3, 1), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  #drawVignette(context) {
    const vignette = context.createRadialGradient(
      this.width / 2,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.16,
      this.width / 2,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.46)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, this.width, this.height);
  }
}
