import { createElement } from "react";

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
  const opacity = hasSwipeOpacity ? 1 - overlaySwipe.progress : undefined;
  const transition =
    hasSwipeOpacity && overlaySwipe.transitionMs != null
      ? `opacity ${overlaySwipe.transitionMs}ms var(--drawer-easing, cubic-bezier(.32, .72, 0, 1))`
      : undefined;
  const style: React.CSSProperties =
    hasSwipeOpacity ? { opacity, transition: transition ?? "none" } : {};

  return createElement("div", {
    "aria-hidden": true,
    className: `drawer-overlay ${hasSwipeOpacity ? "drawer-overlay-swipe" : ""} ${!hasSwipeOpacity && exiting ? "drawer-overlay-exit" : ""}`.trim(),
    style: Object.keys(style).length > 0 ? style : undefined,
    onClick: onBackdropClick,
  });
}
