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

const ANIMATION_DURATION = 500; /* .5s - matches --drawer-duration */

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

  const position = item.position;
  const widthStyle =
    item.width != null && (position === "left" || position === "right")
      ? {
          width:
            typeof item.width === "number" ? `${item.width}px` : item.width,
        }
      : undefined;
  const heightStyle =
    item.height != null && (position === "top" || position === "bottom")
      ? {
          height:
            typeof item.height === "number"
              ? `${item.height}px`
              : item.height,
        }
      : undefined;
  const frameStyle =
    widthStyle ?? heightStyle
      ? { ...widthStyle, ...heightStyle }
      : undefined;

  return createElement(
    "div",
    {
      className: "drawer-layer",
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
        className: `drawer-frame ${
          item.phase === "exiting" ? "drawer-frame-exit" : ""
        } ${item.title != null ? "drawer-frame-has-title" : ""} ${
          item.footer ? "drawer-frame-has-footer" : ""
        } ${item.className ?? ""}`.trim(),
        style: frameStyle,
        onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(),
      },
      createElement(
        "div",
        { className: "drawer-body" },
        createElement(
          "button",
          {
            type: "button",
            "aria-label": "Close",
            className: "drawer-close",
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
            { className: "drawer-header" },
            createElement(
              "h2",
              { className: "drawer-title", id: `drawer-title-${item.id}` },
              item.title
            )
          ),
        createElement(
          "div",
          { className: "drawer-content" },
          createElement(Content, mergedProps)
        )
      ),
      item.footer &&
        createElement(
          "div",
          {
            className: `drawer-footer ${item.footer.className ?? ""}`.trim(),
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
