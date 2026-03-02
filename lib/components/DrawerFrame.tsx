import {
  createElement,
  useRef,
  useEffect,
  useCallback,
  type MouseEvent,
} from "react";
import type { DrawerItem } from "../types.js";
import { createCloseDrawer } from "../api.js";
import { useFocusTrap } from "../useFocusTrap.js";
import { updatePhase } from "../store.js";

const ANIMATION_DURATION = 200;

interface DrawerFrameProps {
  item: DrawerItem;
}

export function DrawerFrame({ item }: DrawerFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(createCloseDrawer(item.id), [item.id]);

  useFocusTrap(frameRef, true, false);

  useEffect(() => {
    if (item.phase === "entering") {
      const id = setTimeout(() => {
        updatePhase(item.id, "entered");
      }, ANIMATION_DURATION);
      return () => clearTimeout(id);
    }
  }, [item.id, item.phase]);

  useEffect(() => {
    if (item.disableEsc) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item.disableEsc, closeDrawer]);

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!item.disableClickOutside) {
      closeDrawer();
    }
  };

  const Content = item.component;
  const mergedProps = {
    ...(typeof item.props === "object" && item.props !== null ? item.props : {}),
    closeDrawer,
  } as typeof item.props & { closeDrawer: () => void };

  const widthStyle =
    item.width != null && (item.position === "left" || item.position === "right")
      ? {
          width:
            typeof item.width === "number"
              ? `${item.width}px`
              : item.width,
        }
      : undefined;

  return createElement(
    "div",
    {
      className: "drawers-layer",
      "data-position": item.position,
      onClick: handleBackdropClick,
      role: "presentation",
    },
    createElement(
      "div",
      {
        ref: frameRef,
        tabIndex: -1,
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby":
          item.title != null ? `drawer-title-${item.id}` : undefined,
        "data-position": item.position,
        className: `drawers-frame ${
          item.phase === "exiting" ? "drawers-frame-exit" : ""
        } ${item.title != null ? "drawers-frame-has-title" : ""} ${
          item.footer ? "drawers-frame-has-footer" : ""
        } ${item.className ?? ""}`.trim(),
        style: widthStyle,
        onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(),
      },
      createElement(
        "div",
        { className: "drawers-body" },
        createElement(
          "button",
          {
            type: "button",
            "aria-label": "Close",
            className: "drawers-close",
            onClick: closeDrawer,
          },
          createElement(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              width: 20,
              height: 20,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              "aria-hidden": true,
            },
            createElement("path", { d: "M18 6 6 18" }),
            createElement("path", { d: "m6 6 12 12" })
          )
        ),
        item.title != null &&
          createElement(
            "div",
            { className: "drawers-header" },
            createElement(
              "h2",
              { className: "drawers-title", id: `drawer-title-${item.id}` },
              item.title
            )
          ),
        createElement(
          "div",
          { className: "drawers-content" },
          createElement(Content, mergedProps)
        )
      ),
      item.footer &&
        createElement(
          "div",
          {
            className: `drawers-footer ${item.footer.className ?? ""}`.trim(),
          },
          createElement(item.footer.component, {
            ...(typeof item.footer.props === "object" &&
            item.footer.props !== null
              ? item.footer.props
              : {}),
            closeDrawer,
          })
        )
    )
  );
}
