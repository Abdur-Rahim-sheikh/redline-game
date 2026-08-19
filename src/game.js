import {
  clamp,
  createBranchGap,
  ellipseIntersectsRectangle,
  formatScore,
  safeStorage,
} from "./core.js";
import { AudioEngine } from "./audio.js";

const BEST_SCORE_KEY = "kak-uraan-best-v1";
const SOUND_KEY = "kak-uraan-muted";
const CROW_FRAME_SIZE = 320;
const CROW_FRAME_COUNT = 3;

export class CrowFlightGame {
  constructor(canvas, elements, callbacks = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.elements = elements;
    this.callbacks = callbacks;
    this.storage = safeStorage();
    this.muted = this.storage.get(SOUND_KEY, "false") === "true";
    this.audio = new AudioEngine({ muted: this.muted });
    this.reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    this.assets = {};
    this.ready = Promise.all([
      this.#loadImage("crow", new URL("../assets/crow-sprites-v3.webp", import.meta.url)),
      this.#loadImage("topBranch", new URL("../assets/koroi-top-game.webp", import.meta.url)),
      this.#loadImage("bottomBranch", new URL("../assets/koroi-bottom-game.webp", import.meta.url)),
    ]);

    this.state = "ready";
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.lastFrame = performance.now();
    this.idleTime = 0;
    this.elapsed = 0;
    this.score = 0;
    this.speed = 125;
    this.spawnTimer = 0;
    this.lastGapCenter = null;
    this.obstacles = [];
    this.particles = [];
    this.flash = 0;
    this.messageTimer = 0;
    this.crow = { x: 0, y: 0, velocityY: 0, size: 76, wingTimer: 0 };
    this.bestScore = Number.parseInt(this.storage.get(BEST_SCORE_KEY, "0"), 10) || 0;

    this.#bindEvents();
    this.resize();
    this.#syncSoundButton();
    this.#updateHud();
    requestAnimationFrame((time) => this.#frame(time));
  }

  #loadImage(key, url) {
    const image = new Image();
    this.assets[key] = image;
    image.decoding = "async";
    const ready = new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
    image.src = url.href;
    return ready;
  }

  #bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.state !== "playing" || event.button > 0) return;
      event.preventDefault();
      this.#flap();
    });

    globalThis.addEventListener("keydown", (event) => {
      if (this.state !== "playing") return;
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        this.#flap();
      }
    });

    globalThis.addEventListener("resize", () => this.resize(), { passive: true });
    globalThis.visualViewport?.addEventListener("resize", () => this.resize(), { passive: true });
    document.addEventListener("visibilitychange", () => {
      this.lastFrame = performance.now();
    });
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const oldWidth = this.width || bounds.width;
    const oldHeight = this.height || bounds.height;
    this.width = Math.max(280, bounds.width);
    this.height = Math.max(480, bounds.height);
    this.pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);

    const scaleX = this.width / oldWidth;
    const scaleY = this.height / oldHeight;
    this.crow.size = clamp(this.width * 0.2, 68, 88);
    this.crow.x = clamp(this.width * 0.28, 84, 155);
    this.crow.y = this.crow.y ? this.crow.y * scaleY : this.height * 0.43;
    for (const obstacle of this.obstacles) obstacle.x *= scaleX;
    this.#createGradients();
  }

  #createGradients() {
    this.skyGradient = this.context.createLinearGradient(0, 0, 0, this.height);
    this.skyGradient.addColorStop(0, "#73cfe2");
    this.skyGradient.addColorStop(0.55, "#bee8df");
    this.skyGradient.addColorStop(1, "#f4d58f");
  }

  start() {
    this.state = "playing";
    this.elapsed = 0;
    this.score = 0;
    this.speed = clamp(this.width * 0.34, 112, 155);
    this.obstacles.length = 0;
    this.particles.length = 0;
    this.lastGapCenter = null;
    this.spawnTimer = 1.72;
    this.flash = 0;
    this.crow.y = this.height * 0.43;
    this.crow.velocityY = 0;
    this.crow.wingTimer = 0;
    this.#addObstacle(this.width - 35);
    this.#flap();
    this.#updateHud();
    this.callbacks.onStart?.();
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

  #flap() {
    if (this.state !== "playing") return;
    this.crow.velocityY = -clamp(this.height * 0.515, 305, 440);
    this.crow.wingTimer = 0.24;
    this.audio.playFlap();

    if (!this.reduceMotion) {
      this.particles.push({
        x: this.crow.x - this.crow.size * 0.35,
        y: this.crow.y + this.crow.size * 0.15,
        vx: -32 - Math.random() * 28,
        vy: 25 + Math.random() * 28,
        rotation: Math.random() * Math.PI,
        life: 0.28,
        maxLife: 0.28,
        size: 2.5 + Math.random() * 2,
      });
    }
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
    this.flash = Math.max(0, this.flash - deltaSeconds * 2.8);

    if (this.state === "playing") this.#updatePlaying(deltaSeconds);
    if (this.state === "ready") {
      this.crow.y = this.height * 0.43 + Math.sin(this.idleTime * 2.7) * (this.reduceMotion ? 1.5 : 7);
    }
    this.#updateParticles(deltaSeconds);
  }

  #updatePlaying(deltaSeconds) {
    this.elapsed += deltaSeconds;
    const gravity = clamp(this.height * 1.72, 920, 1500);
    const terminalVelocity = clamp(this.height * 0.82, 460, 700);
    this.crow.velocityY = Math.min(terminalVelocity, this.crow.velocityY + gravity * deltaSeconds);
    this.crow.y += this.crow.velocityY * deltaSeconds;
    this.crow.wingTimer = Math.max(0, this.crow.wingTimer - deltaSeconds);

    this.speed = Math.min(205, clamp(this.width * 0.34, 112, 155) + this.score * 3.1);
    this.spawnTimer -= deltaSeconds;
    if (this.spawnTimer <= 0) {
      this.#addObstacle(this.width + 58);
      this.spawnTimer = clamp(1.72 - this.score * 0.018, 1.35, 1.72);
    }

    for (const obstacle of this.obstacles) {
      obstacle.x -= this.speed * deltaSeconds;
      if (!obstacle.scored && obstacle.x + obstacle.width < this.crow.x - this.crow.size * 0.28) {
        obstacle.scored = true;
        this.score += 1;
        this.audio.playPoint(this.score);
        this.flash = 0.12;
        this.showMessage("+1", 0.55);
        if (!this.reduceMotion && navigator.vibrate) navigator.vibrate(12);
        this.#updateHud();
      }
    }
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width * 2.1 > -20);

    if (this.#hasCollision()) this.#crash();
  }

  #addObstacle(x) {
    const difficulty = clamp(this.score / 22 + this.elapsed / 120, 0, 1);
    const pattern = createBranchGap(difficulty, this.lastGapCenter);
    this.lastGapCenter = pattern.center;
    this.obstacles.push({
      x,
      width: clamp(this.width * 0.235, 78, 108),
      gapCenter: pattern.center,
      gapSize: pattern.size,
      scored: false,
      seed: Math.random(),
    });
  }

  #obstacleGeometry(obstacle) {
    const groundY = this.height - 22;
    const gapHeight = clamp(obstacle.gapSize * this.height, 145, 205);
    const minimumCenter = gapHeight / 2 + 72;
    const maximumCenter = groundY - gapHeight / 2 - 48;
    const centerY = clamp(obstacle.gapCenter * this.height, minimumCenter, maximumCenter);
    return {
      groundY,
      gapHeight,
      gapTop: centerY - gapHeight / 2,
      gapBottom: centerY + gapHeight / 2,
    };
  }

  #crowHitbox() {
    return {
      x: this.crow.x,
      y: this.crow.y,
      radiusX: this.crow.size * 0.32,
      radiusY: this.crow.size * 0.22,
    };
  }

  #hasCollision() {
    const crow = this.#crowHitbox();
    if (crow.y - crow.radiusY <= 5 || crow.y + crow.radiusY >= this.height - 22) return true;

    for (const obstacle of this.obstacles) {
      const geometry = this.#obstacleGeometry(obstacle);
      const hitX = obstacle.x + obstacle.width * 0.15;
      const hitWidth = obstacle.width * 0.7;
      const topBranch = { x: hitX, y: 0, width: hitWidth, height: Math.max(0, geometry.gapTop - 5) };
      const bottomBranch = {
        x: hitX,
        y: geometry.gapBottom + 5,
        width: hitWidth,
        height: Math.max(0, geometry.groundY - geometry.gapBottom - 5),
      };
      if (ellipseIntersectsRectangle(crow, topBranch) || ellipseIntersectsRectangle(crow, bottomBranch)) return true;
    }
    return false;
  }

  #crash() {
    if (this.state !== "playing") return;
    this.state = "gameover";
    this.flash = 0.9;
    this.audio.playCrash();
    if (!this.reduceMotion && navigator.vibrate) navigator.vibrate([80, 40, 120]);
    this.#spawnFeathers();

    const isNewBest = this.score > this.bestScore;
    if (isNewBest) {
      this.bestScore = this.score;
      this.storage.set(BEST_SCORE_KEY, String(this.score));
    }

    globalThis.setTimeout(() => {
      this.callbacks.onGameOver?.({
        score: this.score,
        bestScore: this.bestScore,
        isNewBest,
        elapsed: this.elapsed,
      });
    }, this.reduceMotion ? 80 : 380);
  }

  #spawnFeathers() {
    const amount = this.reduceMotion ? 5 : 14;
    for (let index = 0; index < amount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 45 + Math.random() * 150;
      this.particles.push({
        x: this.crow.x,
        y: this.crow.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotation: angle,
        life: 0.45 + Math.random() * 0.55,
        maxLife: 1,
        size: 3 + Math.random() * 5,
      });
    }
  }

  #updateParticles(deltaSeconds) {
    for (const particle of this.particles) {
      particle.life -= deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vy += 85 * deltaSeconds;
      particle.rotation += deltaSeconds * 3;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0).slice(-40);
  }

  #updateHud() {
    this.elements.score.textContent = formatScore(this.score);
    this.elements.hudBest.textContent = formatScore(this.bestScore);
  }

  showMessage(text, duration = 0.6) {
    const element = this.elements.message;
    element.textContent = text;
    element.classList.add("is-visible");
    this.messageTimer = duration;
  }

  #render() {
    const context = this.context;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    this.#drawBackground(context);
    for (const obstacle of this.obstacles) this.#drawObstacle(context, obstacle);
    this.#drawParticles(context);
    this.#drawCrow(context);
    this.#drawForeground(context);

    if (this.flash > 0) {
      context.fillStyle = `rgba(255,255,255,${this.flash * 0.22})`;
      context.fillRect(0, 0, this.width, this.height);
    }
  }

  #drawBackground(context) {
    context.fillStyle = this.skyGradient;
    context.fillRect(0, 0, this.width, this.height);

    const sunX = this.width * 0.78;
    const sunY = this.height * 0.15;
    const sunRadius = clamp(this.width * 0.085, 24, 42);
    const sunGlow = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 2.2);
    sunGlow.addColorStop(0, "rgba(255,246,188,.95)");
    sunGlow.addColorStop(0.4, "rgba(255,214,123,.45)");
    sunGlow.addColorStop(1, "rgba(255,214,123,0)");
    context.fillStyle = sunGlow;
    context.beginPath();
    context.arc(sunX, sunY, sunRadius * 2.2, 0, Math.PI * 2);
    context.fill();

    this.#drawCloud(context, this.width * 0.16, this.height * 0.17, 0.72);
    this.#drawCloud(context, this.width * 0.73, this.height * 0.32, 0.48);
    this.#drawCloud(context, this.width * 0.35, this.height * 0.39, 0.38);

    const horizon = this.height * 0.79;
    context.fillStyle = "#7cab74";
    context.beginPath();
    context.moveTo(0, horizon);
    for (let x = 0; x <= this.width + 30; x += 26) {
      context.lineTo(x, horizon - 8 - Math.abs(Math.sin(x * 0.031)) * 26);
    }
    context.lineTo(this.width, this.height);
    context.lineTo(0, this.height);
    context.closePath();
    context.fill();

    context.fillStyle = "#a9c77b";
    context.fillRect(0, horizon + 10, this.width, this.height - horizon);
    context.fillStyle = "rgba(237,210,106,.7)";
    for (let row = 0; row < 4; row += 1) {
      const y = horizon + 20 + row * 18;
      context.fillRect(0, y, this.width, 4);
    }
    context.strokeStyle = "rgba(62,116,72,.3)";
    context.lineWidth = 1;
    for (let x = 12; x < this.width; x += 28) {
      context.beginPath();
      context.moveTo(x, horizon + 5);
      context.lineTo(x - 18, this.height);
      context.stroke();
    }
  }

  #drawCloud(context, x, y, scale) {
    context.fillStyle = "rgba(255,255,255,.46)";
    context.beginPath();
    context.ellipse(x, y, 42 * scale, 12 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x - 21 * scale, y + 2 * scale, 25 * scale, 10 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x + 20 * scale, y + 2 * scale, 28 * scale, 10 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x, y - 8 * scale, 24 * scale, 16 * scale, 0, 0, Math.PI * 2);
    context.fill();
  }

  #drawObstacle(context, obstacle) {
    const geometry = this.#obstacleGeometry(obstacle);
    const topHeight = geometry.gapTop + 12;
    const bottomHeight = geometry.groundY - geometry.gapBottom + 18;
    const topWidth = clamp(topHeight * (320 / 460), obstacle.width * 1.35, obstacle.width * 2.15);
    const bottomWidth = clamp(bottomHeight * (320 / 520), obstacle.width * 1.35, obstacle.width * 2.15);

    context.save();
    context.shadowColor = "rgba(24,58,32,.32)";
    context.shadowBlur = 8;
    if (this.assets.topBranch.complete && this.assets.topBranch.naturalWidth > 0) {
      context.drawImage(
        this.assets.topBranch,
        obstacle.x + obstacle.width / 2 - topWidth / 2,
        -8,
        topWidth,
        topHeight + 8,
      );
    } else {
      this.#drawFallbackBranch(context, obstacle.x, 0, obstacle.width, geometry.gapTop, true);
    }

    if (this.assets.bottomBranch.complete && this.assets.bottomBranch.naturalWidth > 0) {
      context.drawImage(
        this.assets.bottomBranch,
        obstacle.x + obstacle.width / 2 - bottomWidth / 2,
        geometry.gapBottom - 8,
        bottomWidth,
        bottomHeight + 8,
      );
    } else {
      this.#drawFallbackBranch(
        context,
        obstacle.x,
        geometry.gapBottom,
        obstacle.width,
        geometry.groundY - geometry.gapBottom,
        false,
      );
    }
    context.restore();
  }

  #drawFallbackBranch(context, x, y, width, height, fromTop) {
    const baseY = fromTop ? y : y + height;
    const tipY = fromTop ? y + height : y;
    context.strokeStyle = "#5b4630";
    context.lineWidth = width * 0.42;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x + width / 2, baseY);
    context.lineTo(x + width / 2, tipY);
    context.stroke();
    context.fillStyle = "#477b42";
    for (let index = 0; index < 7; index += 1) {
      const leafY = y + height * (0.16 + index * 0.11);
      context.beginPath();
      context.arc(x + width / 2 + Math.sin(index * 2.4) * width * 0.45, leafY, width * 0.22, 0, Math.PI * 2);
      context.fill();
    }
  }

  #drawCrow(context) {
    const drawSize = this.crow.size * 1.28;
    const angle = this.state === "ready" ? -0.06 : clamp(this.crow.velocityY / 860, -0.32, 0.72);
    let frame = 1;
    if (this.state === "playing") {
      const order = [2, 1, 0, 1];
      frame = order[Math.floor(this.elapsed * 10) % order.length];
      if (this.crow.velocityY > 330) frame = 2;
    }

    context.save();
    context.translate(this.crow.x, this.crow.y);
    context.rotate(angle);
    context.shadowColor = "rgba(16,28,48,.25)";
    context.shadowBlur = 5;
    context.shadowOffsetY = 3;

    if (this.assets.crow.complete && this.assets.crow.naturalWidth >= CROW_FRAME_SIZE * CROW_FRAME_COUNT) {
      context.drawImage(
        this.assets.crow,
        frame * CROW_FRAME_SIZE,
        0,
        CROW_FRAME_SIZE,
        CROW_FRAME_SIZE,
        -drawSize / 2,
        -drawSize / 2,
        drawSize,
        drawSize,
      );
    } else {
      context.fillStyle = "#111522";
      context.beginPath();
      context.ellipse(0, 0, this.crow.size * 0.42, this.crow.size * 0.22, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(this.crow.size * 0.36, -4);
      context.lineTo(this.crow.size * 0.65, 0);
      context.lineTo(this.crow.size * 0.35, 6);
      context.fill();
    }
    context.restore();
  }

  #drawParticles(context) {
    context.fillStyle = "#151a2b";
    for (const particle of this.particles) {
      context.save();
      context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.beginPath();
      context.ellipse(0, 0, particle.size * 1.7, particle.size * 0.55, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  #drawForeground(context) {
    const groundY = this.height - 22;
    context.fillStyle = "#416f38";
    context.fillRect(0, groundY, this.width, 22);
    context.fillStyle = "#72a64f";
    context.fillRect(0, groundY, this.width, 5);
    context.strokeStyle = "#305c31";
    context.lineWidth = 1.5;
    for (let x = 3; x < this.width; x += 9) {
      context.beginPath();
      context.moveTo(x, groundY + 2);
      context.lineTo(x + 3, groundY - 6 - (x % 5));
      context.stroke();
    }
  }
}
