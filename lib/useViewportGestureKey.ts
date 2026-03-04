import { useState, useEffect } from "react";

/**
 * Breakpoint (px) used to distinguish viewport "modes".
 * When crossing this width (e.g. toggling device toolbar in devtools),
 * the returned key changes so gesture consumers can remount and re-init listeners.
 */
const VIEWPORT_GESTURE_BREAKPOINT = 768;

/**
 * Returns a stable key that changes only when the viewport width crosses
 * VIEWPORT_GESTURE_BREAKPOINT. Use as part of a component key so that when
 * the user switches device mode (e.g. in browser inspector), the component
 * remounts and gesture handlers re-initialize for the new input type.
 */
export function useViewportGestureKey(): "narrow" | "wide" {
  const [key, setKey] = useState<"narrow" | "wide">(() =>
    typeof window === "undefined"
      ? "wide"
      : window.innerWidth < VIEWPORT_GESTURE_BREAKPOINT
        ? "narrow"
        : "wide"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const next =
        window.innerWidth < VIEWPORT_GESTURE_BREAKPOINT ? "narrow" : "wide";
      setKey((prev) => (prev === next ? prev : next));
    };

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return key;
}
