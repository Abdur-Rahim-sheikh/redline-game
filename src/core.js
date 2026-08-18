export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function smoothTowards(current, target, responsiveness, deltaSeconds) {
  return lerp(current, target, 1 - Math.exp(-responsiveness * deltaSeconds));
}

export function rectangleOverlap(first, second, inset = 0) {
  return (
    first.x + inset < second.x + second.width - inset &&
    first.x + first.width - inset > second.x + inset &&
    first.y + inset < second.y + second.height - inset &&
    first.y + first.height - inset > second.y + inset
  );
}

export function formatScore(score) {
  return Math.max(0, Math.floor(score)).toLocaleString("en-US");
}

export function createGatePattern(difficulty, previousCenter = null, random = Math.random) {
  const safeDifficulty = clamp(difficulty, 0, 1);
  const gapWidth = clamp(lerp(0.44, 0.285, safeDifficulty) + (random() - 0.5) * 0.025, 0.27, 0.46);
  const edgeInset = gapWidth / 2 + 0.045;
  const sampledCenter = lerp(edgeInset, 1 - edgeInset, random());

  if (previousCenter === null || !Number.isFinite(previousCenter)) {
    return { center: sampledCenter, width: gapWidth };
  }

  const maximumShift = lerp(0.34, 0.46, safeDifficulty);
  const reachableCenter = clamp(sampledCenter, previousCenter - maximumShift, previousCenter + maximumShift);
  return {
    center: clamp(reachableCenter, edgeInset, 1 - edgeInset),
    width: gapWidth,
  };
}

export function circleIntersectsGate(circle, gate) {
  const verticalDistance = Math.abs(circle.y - gate.y);
  if (verticalDistance >= circle.radius * 0.78 + gate.thickness / 2) return false;

  const collisionRadius = circle.radius * 0.7;
  return circle.x - collisionRadius < gate.gapLeft || circle.x + collisionRadius > gate.gapRight;
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
