import type { DrawerItem, Listener } from "./types.js";

let current: DrawerItem | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
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
  notify();
}

/** Updates the drawer phase (for exit animation). Creates new object so React re-renders. */
export function updatePhase(id: string, phase: DrawerItem["phase"]): void {
  if (current?.id === id) {
    current = { ...current, phase };
    notify();
  }
}
