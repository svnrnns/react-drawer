import { createElement } from "react";

const EXIT_DURATION_MS = 500; /* matches --drawer-duration .5s */

interface DrawerOverlayProps {
  exiting: boolean;
  onBackdropClick?: () => void;
  /** During swipe: progress 0-1 (1=fully closed). null = use normal animation. */
  overlaySwipe?: { progress: number; transitionMs: number | null } | null;
}

export function DrawerOverlay({
  exiting,
  onBackdropClick,
  overlaySwipe,
}: DrawerOverlayProps) {
  const hasSwipeOpacity = overlaySwipe != null;
  /* When exiting after a previous drag, overlaySwipe is still set: animate from current opacity to 0 via inline transition so the overlay fades out instead of staying stuck. */
  const exitingWithSwipe = exiting && hasSwipeOpacity;
  const opacity: number | undefined = exitingWithSwipe
    ? 0
    : hasSwipeOpacity
      ? 1 - overlaySwipe.progress
      : undefined;
  const transition: string | undefined = exitingWithSwipe
    ? `opacity ${EXIT_DURATION_MS}ms var(--drawer-easing, cubic-bezier(.32, .72, 0, 1))`
    : hasSwipeOpacity && overlaySwipe.transitionMs != null
      ? `opacity ${overlaySwipe.transitionMs}ms var(--drawer-easing, cubic-bezier(.32, .72, 0, 1))`
      : hasSwipeOpacity
        ? "none"
        : undefined;
  const style: React.CSSProperties =
    opacity !== undefined
      ? { opacity, transition: transition ?? "none" }
      : {};

  /* When exiting after a drag, keep drawer-overlay-swipe so the base fade-in animation stays disabled and our inline transition (opacity → 0) does the fade-out. */
  const useSwipeClass = (hasSwipeOpacity && !exiting) || exitingWithSwipe;
  const useExitClass = !hasSwipeOpacity && exiting;

  return createElement("div", {
    "aria-hidden": true,
    className: `drawer-overlay ${useSwipeClass ? "drawer-overlay-swipe" : ""} ${useExitClass ? "drawer-overlay-exit" : ""}`.trim(),
    style: Object.keys(style).length > 0 ? style : undefined,
    onClick: onBackdropClick,
  });
}
