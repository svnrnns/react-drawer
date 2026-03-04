import type { DrawerItem, Listener } from "./types.js";

let current: DrawerItem | null = null;
let gestureClosingId: string | null = null;
/** Overlay opacity during swipe: { progress 0-1 (1=fully closed), transitionMs or null } */
let overlaySwipe: { progress: number; transitionMs: number | null } | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Set overlay swipe progress during gesture (progress 0-1; transitionMs for animated close, or null) */
export function setOverlaySwipe(progress: number | null, transitionMs?: number | null): void {
  if (progress == null) {
    overlaySwipe = null;
  } else {
    overlaySwipe = { progress, transitionMs: transitionMs ?? null };
  }
  notify();
}

export function getOverlaySwipe(): { progress: number; transitionMs: number | null } | null {
  return overlaySwipe;
}

/** ID of drawer currently closing via gesture - backdrop/click close should be ignored */
export function setGestureClosingId(id: string | null): void {
  gestureClosingId = id;
  notify();
}

export function getGestureClosingId(): string | null {
  return gestureClosingId;
}

/** Returns the current drawer or null. */
export function getDrawer(): DrawerItem | null {
  return current;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the drawer (replaces any existing). */
export function setDrawer(item: DrawerItem): void {
  current = item;
  notify();
}

/** Removes the current drawer after exit animation. Triggers unmount. */
export function clearDrawer(): void {
  current = null;
  gestureClosingId = null;
  overlaySwipe = null;
  notify();
}

/** Updates the drawer phase (for exit animation). Creates new object so React re-renders. */
export function updatePhase(id: string, phase: DrawerItem["phase"]): void {
  if (current?.id === id) {
    current = { ...current, phase };
    notify();
  }
}
