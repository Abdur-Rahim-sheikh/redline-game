export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function smoothTowards(current, target, responsiveness, deltaSeconds) {
  return lerp(current, target, 1 - Math.exp(-responsiveness * deltaSeconds));
}

export function formatScore(score) {
  return Math.max(0, Math.floor(score)).toLocaleString("en-US");
}

export function createBranchGap(difficulty, previousCenter = null, random = Math.random) {
  const safeDifficulty = clamp(difficulty, 0, 1);
  const size = clamp(lerp(0.27, 0.205, safeDifficulty) + (random() - 0.5) * 0.012, 0.2, 0.28);
  const edgeInset = size / 2 + 0.105;
  const sampledCenter = lerp(edgeInset, 1 - edgeInset, random());

  if (previousCenter === null || !Number.isFinite(previousCenter)) {
    return { center: sampledCenter, size };
  }

  const maximumShift = lerp(0.17, 0.225, safeDifficulty);
  return {
    center: clamp(sampledCenter, previousCenter - maximumShift, previousCenter + maximumShift),
    size,
  };
}

export function ellipseIntersectsRectangle(ellipse, rectangle) {
  const nearestX = clamp(ellipse.x, rectangle.x, rectangle.x + rectangle.width);
  const nearestY = clamp(ellipse.y, rectangle.y, rectangle.y + rectangle.height);
  const normalizedX = (ellipse.x - nearestX) / ellipse.radiusX;
  const normalizedY = (ellipse.y - nearestY) / ellipse.radiusY;
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

export function safeStorage(storage = globalThis.localStorage) {
  return {
    get(key, fallback = null) {
      try {
        const value = storage?.getItem(key);
        return value === null || value === undefined ? fallback : value;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        storage?.setItem(key, String(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}
