import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const CLOSE_BUTTON_CLASS = "drawers-close";

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function getFocusableExcludingClose(container: HTMLElement): HTMLElement[] {
  return getFocusableElements(container).filter(
    (el) => !el.classList.contains(CLOSE_BUTTON_CLASS)
  );
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  disableAutoFocus = false
): void {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (!disableAutoFocus) {
      const focusableExcludingClose = getFocusableExcludingClose(container);
      const focusable = getFocusableElements(container);
      const first = focusableExcludingClose[0] ?? focusable[0];

      if (first) {
        first.focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusableNow = getFocusableElements(container);
      const firstNow = focusableNow[0];
      const lastNow = focusableNow[focusableNow.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstNow && lastNow) {
          e.preventDefault();
          lastNow.focus();
        }
      } else {
        if (document.activeElement === lastNow && firstNow) {
          e.preventDefault();
          firstNow.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [enabled, containerRef, disableAutoFocus]);
}
