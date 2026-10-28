// Keep source effects intact while bounding fill rate in mobile WebViews.
export function renderBudget({ width, height, devicePixelRatio = 1, coarsePointer = false }) {
  const mobile = width <= 767 || coarsePointer;
  const native = Math.max(0.1, Number(devicePixelRatio) || 1);
  return {
    mobile,
    dpr: mobile
      ? Math.min(native, 1.5, Math.sqrt(1_000_000 / Math.max(1, width * height)))
      : Math.min(native, 2),
    fps: mobile ? 60 : 0,
    antialias: !mobile,
  };
}

// Anchor to a running deadline, not the previous callback. Small 60 Hz jitter
// must not turn the target into 30 Hz; skipped 120 Hz callbacks retain elapsed time.
export function frameDue(clock, time, fps) {
  if (!fps) return true;
  const interval = 1000 / fps;
  if (clock.next == null) {
    clock.next = time + interval;
    return true;
  }
  if (time + 1 < clock.next) return false;
  clock.next += Math.max(1, Math.floor((time + 1 - clock.next) / interval) + 1) * interval;
  return true;
}
