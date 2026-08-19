import { formatScore } from "./core.js?v=1.1.0";
import { CrowFlightGame } from "./game.js?v=1.1.0";

const byId = (id) => document.getElementById(id);

const elements = {
  canvas: byId("game"),
  hud: byId("hud"),
  score: byId("score"),
  hudBest: byId("hud-best"),
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
  scoreUnit: byId("score-unit"),
  toast: byId("install-toast"),
};

let latestResult = { score: 0, bestScore: 0, elapsed: 0 };
let latestScoreCard = null;
let toastTimer = 0;

const game = new CrowFlightGame(elements.canvas, elements, {
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
    elements.scoreUnit.textContent = result.score === 1 ? "branch cleared" : "branches cleared";
    elements.resultBest.textContent = formatScore(result.bestScore);
    elements.runTime.textContent = `${result.elapsed.toFixed(1)}s`;
    elements.newBest.classList.toggle("is-hidden", !result.isNewBest);
    elements.resultKicker.textContent = result.isNewBest ? "That crow can fly" : "Branch clipped";
    elements.startBest.textContent = formatScore(result.bestScore);
    elements.hud.classList.add("is-hidden");
    elements.gameOverScreen.classList.remove("is-hidden");
    elements.restartButton.focus?.({ preventScroll: true });
  },
});

elements.startBest.textContent = formatScore(game.bestScore);
elements.startButton.disabled = true;
elements.startButton.textContent = "Loading flight…";
void game.ready.then(() => {
  elements.startButton.disabled = false;
  elements.startButton.textContent = "Start flying";
});
elements.startButton.addEventListener("click", async () => {
  await game.ready;
  game.start();
});
elements.restartButton.addEventListener("click", async () => {
  await game.ready;
  game.start();
});
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
  const unit = result.score === 1 ? "branch" : "branches";
  const shareText = `My crow cleared ${formatScore(result.score)} koroi ${unit} in KAK URAAN. Can you fly farther?`;
  const shareData = {
    title: "KAK URAAN — Can you beat my flight?",
    text: shareText,
    url: gameUrl.href,
  };

  try {
    if (latestScoreCard && globalThis.File && navigator.canShare) {
      const scoreFile = new File([latestScoreCard], "kak-uraan-score.png", { type: "image/png" });
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
        showToast("Copy the page link to share your flight");
      }
    }
  }
}

async function createScoreCard(result) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  const background = context.createLinearGradient(0, 0, 0, 630);
  background.addColorStop(0, "#73cfe2");
  background.addColorStop(0.68, "#c9ebd9");
  background.addColorStop(1, "#e9d48d");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);

  context.fillStyle = "rgba(255,247,196,.9)";
  context.beginPath();
  context.arc(1020, 112, 74, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#7eae68";
  context.fillRect(0, 530, 1200, 100);
  context.fillStyle = "#98c77b";
  context.beginPath();
  context.moveTo(0, 540);
  for (let x = 0; x <= 1200; x += 55) context.lineTo(x, 510 - Math.abs(Math.sin(x * 0.018)) * 34);
  context.lineTo(1200, 630);
  context.lineTo(0, 630);
  context.fill();

  const [crow, topBranch, bottomBranch] = await Promise.all([
    loadImage(new URL("../assets/crow-sprites-v3.webp", import.meta.url)),
    loadImage(new URL("../assets/koroi-top-game.webp", import.meta.url)),
    loadImage(new URL("../assets/koroi-bottom-game.webp", import.meta.url)),
  ]);
  context.drawImage(topBranch, 900, -55, 230, 345);
  context.drawImage(bottomBranch, 940, 340, 220, 350);
  context.drawImage(crow, 320, 0, 320, 320, 770, 230, 170, 170);

  context.fillStyle = "#172333";
  context.font = "900 98px system-ui, sans-serif";
  context.fillText("KAK", 65, 125);
  const kakWidth = context.measureText("KAK").width;
  context.fillStyle = "#2e7148";
  context.fillText("URAAN", 65 + kakWidth + 22, 125);
  context.fillStyle = "rgba(23,35,51,.62)";
  context.font = "700 25px system-ui, sans-serif";
  context.fillText("MY BEST FLIGHT", 72, 205);
  context.fillStyle = "#172333";
  context.font = "900 144px system-ui, sans-serif";
  context.fillText(formatScore(result.score), 65, 352);
  context.fillStyle = "#2e7148";
  context.font = "850 31px system-ui, sans-serif";
  context.fillText(result.score === 1 ? "KOROI BRANCH CLEARED" : "KOROI BRANCHES CLEARED", 75, 404);
  context.fillStyle = "#172333";
  context.font = "850 35px system-ui, sans-serif";
  context.fillText("CAN YOUR CROW FLY FARTHER?", 72, 480);
  context.fillStyle = "rgba(23,35,51,.58)";
  context.font = "600 19px system-ui, sans-serif";
  context.fillText("Tap to flap • No app • No login", 74, 518);
  context.font = "600 18px system-ui, sans-serif";
  context.fillText("Driving lessons • Naria, Shariatpur • 01577602941", 72, 596);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url.href;
  });
}

if ("serviceWorker" in navigator && globalThis.location.protocol.startsWith("http")) {
  globalThis.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch(() => {
      // The game remains usable if private browsing or a host blocks service workers.
    });
  });
}
