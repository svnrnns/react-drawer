import type { OpenDrawerOptions, DrawerItem } from "./types.js";
import { getDrawer, setDrawer, clearDrawer, updatePhase } from "./store.js";

const ANIMATION_DURATION = 500; /* .5s - matches --drawer-duration */
const ANIMATION_BUFFER = 50;

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `drawer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Opens a drawer. Only one drawer can be open at a time.
 * @param options - Configuration for the drawer (component, props, title, position, etc.)
 * @returns The generated drawer id. Use with {@link closeDrawer} to close this drawer.
 * @example
 * const id = openDrawer({ component: MyForm, props: { name: "Edit" }, title: "Edit profile" });
 * // later: closeDrawer(id);
 */
export function openDrawer<T = object, F = object>(
  options: OpenDrawerOptions<T, F>
): string {
  const id = generateId();
  const item: DrawerItem = {
    id,
    component: options.component as DrawerItem["component"],
    props: (options.props ?? {}) as object,
    width: options.width,
    height: options.height,
    position: options.position ?? "right",
    className: options.className,
    title: options.title,
    footer: options.footer as DrawerItem["footer"],
    onClose: options.onClose,
    disableClickOutside: options.disableClickOutside ?? false,
    disableEsc: options.disableEsc ?? false,
    phase: "entering",
  };
  setDrawer(item);
  return id;
}

/**
 * Closes the drawer. If no id is passed, closes the current drawer.
 * @param id - Drawer id (returned by {@link openDrawer}). Optional when only one drawer exists.
 */
export function closeDrawer(id?: string): void {
  const drawer = getDrawer();
  if (!drawer) return;
  if (id != null && drawer.id !== id) return;

  const onCloseCallback = drawer.onClose;
  updatePhase(drawer.id, "exiting");
  setTimeout(() => {
    const currentNow = getDrawer();
    if (currentNow?.id === drawer.id) {
      clearDrawer();
      onCloseCallback?.();
    }
  }, ANIMATION_DURATION + ANIMATION_BUFFER);
}

/** Create a closeDrawer callback bound to a drawer id (used internally by DrawerFrame) */
export function createCloseDrawer(id: string): () => void {
  return () => closeDrawer(id);
}
