// A covered chrome control is inert until the real lens has finished moving.
// Keep one bounded return-focus request instead of focusing through that lock.
export function restoreFocusAfterLens(
  target,
  { window: win = window, document: doc = document, maxWaitMs = 2000 } = {},
) {
  if (!target?.focus) return () => {};
  const prior = doc.activeElement;
  let stopped = false;
  let timer;
  const clearTimer = win.clearTimeout?.bind(win) ?? clearTimeout;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    clearTimer(timer);
    win.removeEventListener?.('portfolio-tick', attempt);
    doc.removeEventListener?.('focusin', focused, true);
    doc.removeEventListener?.('pointerdown', pointed, true);
    doc.removeEventListener?.('keydown', keyed, true);
    doc.removeEventListener?.('visibilitychange', visibility);
  };
  const meaningful = (element) =>
    element &&
    element !== doc.body &&
    element !== doc.documentElement &&
    element !== prior &&
    element !== target;
  const attempt = () => {
    if (stopped) return;
    if (target.isConnected === false || doc.hidden || meaningful(doc.activeElement)) {
      cancel();
      return;
    }
    const style = win.getComputedStyle?.(target);
    if (
      target.inert ||
      target.disabled ||
      target.closest?.('[inert], [hidden]') ||
      style?.visibility === 'hidden' ||
      style?.display === 'none' ||
      (target.getClientRects && target.getClientRects().length === 0)
    )
      return;
    target.focus({ preventScroll: true });
    if (doc.activeElement == null || doc.activeElement === target) cancel();
  };
  const focused = (event) => {
    if (event.target === target || meaningful(event.target)) cancel();
  };
  const pointed = (event) => {
    const control = event.target?.closest?.(
      'a[href], button, input, select, textarea, [contenteditable], [tabindex]',
    );
    if (control && control !== target && !target.contains?.(control)) cancel();
  };
  const keyed = (event) => {
    if (event.key === 'Tab') cancel();
  };
  const visibility = () => {
    if (doc.hidden) cancel();
  };
  attempt();
  if (!stopped) {
    win.addEventListener?.('portfolio-tick', attempt);
    doc.addEventListener?.('focusin', focused, true);
    doc.addEventListener?.('pointerdown', pointed, true);
    doc.addEventListener?.('keydown', keyed, true);
    doc.addEventListener?.('visibilitychange', visibility);
    timer = (win.setTimeout?.bind(win) ?? setTimeout)(cancel, maxWaitMs);
  }
  return cancel;
}
