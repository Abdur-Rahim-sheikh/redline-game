import { formatScore } from "./core.js";
import { RedlineGame } from "./game.js";

const byId = (id) => document.getElementById(id);

const elements = {
  canvas: byId("game"),
  hud: byId("hud"),
  score: byId("score"),
  speed: byId("speed"),
  multiplier: byId("multiplier"),
  boostLabel: byId("boost-label"),
  soundButton: byId("sound-button"),
  message: byId("message"),
  startScreen: byId("start-screen"),
  gameOverScreen: byId("game-over-screen"),
  startButton: byId("start-button"),
  restartButton: byId("restart-button"),
  shareButton: byId("share-button"),
  startBest: byId("start-best"),
  finalScore: byId("final-score"),
  resultBest: byId("result-best"),
  newBest: byId("new-best"),
  runTime: byId("run-time"),
  resultKicker: byId("result-kicker"),
  toast: byId("install-toast"),
};

let latestResult = { score: 0, bestScore: 0, elapsed: 0 };
let latestScoreCard = null;
let toastTimer = 0;

const game = new RedlineGame(elements.canvas, elements, {
  onStart() {
    elements.startScreen.classList.add("is-hidden");
    elements.gameOverScreen.classList.add("is-hidden");
    elements.hud.classList.remove("is-hidden");
    elements.canvas.focus?.({ preventScroll: true });
  },
  onGameOver(result) {
    latestResult = result;
    latestScoreCard = null;
    void createScoreCard(result).then((blob) => {
      latestScoreCard = blob;
    });
    elements.finalScore.textContent = formatScore(result.score);
    elements.resultBest.textContent = formatScore(result.bestScore);
    elements.runTime.textContent = `${result.elapsed.toFixed(1)}s`;
    elements.newBest.classList.toggle("is-hidden", !result.isNewBest);
    elements.resultKicker.textContent = result.isNewBest ? "You moved the redline" : "Core destabilized";
    elements.hud.classList.add("is-hidden");
    elements.gameOverScreen.classList.remove("is-hidden");
    elements.restartButton.focus?.({ preventScroll: true });
  },
});

elements.startBest.textContent = formatScore(game.bestScore);

elements.startButton.addEventListener("click", () => game.start());
elements.restartButton.addEventListener("click", () => game.start());
elements.soundButton.addEventListener("click", () => {
  const muted = game.toggleSound();
  showToast(muted ? "Sound off" : "Sound on");
});
elements.shareButton.addEventListener("click", () => shareScore(latestResult));

function showToast(message) {
  globalThis.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = globalThis.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

async function shareScore(result) {
  const gameUrl = new URL(globalThis.location.href);
  gameUrl.hash = "";
  const shareText = `I scored ${formatScore(result.score)} in REDLINE and survived ${result.elapsed.toFixed(1)} seconds. Can you beat me?`;
  const shareData = {
    title: "REDLINE — Can you beat my score?",
    text: shareText,
    url: gameUrl.href,
  };

  try {
    if (latestScoreCard && globalThis.File && navigator.canShare) {
      const scoreFile = new File([latestScoreCard], "redline-score.png", { type: "image/png" });
      const fileShareData = { ...shareData, files: [scoreFile] };
      if (navigator.canShare(fileShareData)) {
        await navigator.share(fileShareData);
        return;
      }
    }

    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(`${shareText} ${gameUrl.href}`);
    showToast("Score and link copied");
  } catch (error) {
    if (error?.name !== "AbortError") {
      try {
        await navigator.clipboard.writeText(`${shareText} ${gameUrl.href}`);
        showToast("Score and link copied");
      } catch {
        showToast("Copy the page link to share your score");
      }
    }
  }
}

function createScoreCard(result) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");

    const background = context.createLinearGradient(0, 0, 1200, 630);
    background.addColorStop(0, "#050813");
    background.addColorStop(0.62, "#11182b");
    background.addColorStop(1, "#300713");
    context.fillStyle = background;
    context.fillRect(0, 0, 1200, 630);

    const vortexX = 965;
    const vortexY = 305;
    context.fillStyle = "rgba(255,49,101,.11)";
    context.beginPath();
    context.arc(vortexX, vortexY, 350, 0, Math.PI * 2);
    context.fill();

    for (let index = 0; index < 7; index += 1) {
      context.strokeStyle = `rgba(${index % 2 ? "255,49,101" : "90,235,255"},${0.1 + index * 0.025})`;
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(vortexX, vortexY, 80 + index * 48, 32 + index * 24, -0.15, 0, Math.PI * 2);
      context.stroke();
    }

    const coreGlow = context.createRadialGradient(vortexX, vortexY, 0, vortexX, vortexY, 92);
    coreGlow.addColorStop(0, "#ffffff");
    coreGlow.addColorStop(0.24, "#93f9ff");
    coreGlow.addColorStop(0.58, "#5d74ff");
    coreGlow.addColorStop(1, "rgba(255,49,101,0)");
    context.fillStyle = coreGlow;
    context.beginPath();
    context.arc(vortexX, vortexY, 92, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ff3157";
    context.fillRect(740, 176, 150, 14);
    context.fillRect(1040, 176, 150, 14);
    context.fillRect(770, 439, 118, 12);
    context.fillRect(1042, 439, 126, 12);

    context.font = "italic 900 112px Impact, Arial Narrow, sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText("RED", 72, 142);
    const redWidth = context.measureText("RED").width;
    context.fillStyle = "#ff3147";
    context.fillText("LINE", 72 + redWidth, 142);

    context.fillStyle = "rgba(255,255,255,.58)";
    context.font = "800 24px system-ui, sans-serif";
    context.fillText("MY SCORE", 78, 222);
    context.fillStyle = "#ffffff";
    context.font = "900 138px system-ui, sans-serif";
    context.fillText(formatScore(result.score), 70, 360);
    context.fillStyle = "#ff9a55";
    context.font = "800 31px system-ui, sans-serif";
    context.fillText(`SURVIVED ${result.elapsed.toFixed(1)} SECONDS`, 78, 415);

    context.fillStyle = "#ffffff";
    context.font = "850 35px system-ui, sans-serif";
    context.fillText("CAN YOU BEAT ME?", 78, 505);
    context.fillStyle = "rgba(255,255,255,.5)";
    context.font = "600 20px system-ui, sans-serif";
    context.fillText("Hold to rush • Drag through the gaps", 80, 544);

    context.fillStyle = "rgba(255,255,255,.58)";
    context.font = "600 18px system-ui, sans-serif";
    context.fillText("Driving lessons • Naria, Shariatpur • 01577602941", 78, 594);

    canvas.toBlob(resolve, "image/png", 0.92);
  });
}

if ("serviceWorker" in navigator && globalThis.location.protocol.startsWith("http")) {
  globalThis.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch(() => {
      // The game remains fully usable when private browsing or a host blocks service workers.
    });
  });
}
