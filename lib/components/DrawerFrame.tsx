import {
  createElement,
  useRef,
  useState,
  useEffect,
  useCallback,
  type MouseEvent,
} from "react";
import type { DrawerItem } from "../types.js";
import { createCloseDrawer } from "../api.js";
import { getGestureClosingId, setOverlaySwipe } from "../store.js";
import { useFocusTrap } from "../hooks/useFocusTrap.js";
import { useDrawerGesture } from "../hooks/useDrawerGesture.js";
import { useViewportGestureKey } from "../hooks/useViewportGestureKey.js";
import { updatePhase } from "../store.js";
import { DrawerScrollableContext } from "../contexts/drawerScrollableContext.js";

const ANIMATION_DURATION = 500; /* .5s - matches --drawer-duration */

interface DrawerFrameProps {
  item: DrawerItem;
  /** Override from DrawerRoot: disables rubber band fill for all drawers */
  disableRubberBandFill?: boolean;
}

export function DrawerFrame({ item, disableRubberBandFill }: DrawerFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const handlerRef = useRef<HTMLDivElement>(null);
  const [scrollableEl, setScrollableEl] = useState<HTMLElement | null>(null);
  const viewportGestureKey = useViewportGestureKey();
  const closeDrawer = useCallback(createCloseDrawer(item.id), [item.id]);

  const registerScrollable = useCallback((el: HTMLElement | null) => {
    setScrollableEl(el);
  }, []);

  const {
    transformStyle,
    rubberBandOffset,
    isDragging,
    isSnapping,
    isGestureClosing,
    onTransitionEnd,
    closeFromCurrentPosition,
    swipeProgress,
    swipeTransitionMs,
  } = useDrawerGesture({
    containerRef: frameRef,
    handlerRef: item.showHandler && item.onlyHandlerGestures ? handlerRef : undefined,
    scrollableEl,
    drawerId: item.id,
    position: item.position,
    onClose: closeDrawer,
    onSwipeStart: item.onSwipeStart,
    onSwipe: item.onSwipe,
    onSwipeEnd: item.onSwipeEnd,
    enabled: !item.disableGestureClose,
    phase: item.phase,
  });

  useFocusTrap(frameRef, true, false);

  useEffect(() => {
    setOverlaySwipe(swipeProgress, swipeTransitionMs);
  }, [swipeProgress, swipeTransitionMs]);

  useEffect(() => {
    if (!isDragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [isDragging]);

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
      if (e.key !== "Escape" || getGestureClosingId() === item.id) return;
      if (isDragging) {
        closeFromCurrentPosition();
      } else {
        closeDrawer();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item.disableEsc, item.id, isDragging, closeDrawer, closeFromCurrentPosition]);

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (getGestureClosingId() === item.id) return;
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
  const rubberBandFillEnabled =
    (item.rubberBandFill ?? true) && !disableRubberBandFill;
  const frameStyle: React.CSSProperties = {
    ...(widthStyle ?? heightStyle ? { ...widthStyle, ...heightStyle } : {}),
    ...(rubberBandFillEnabled
      ? { ["--drawer-rubberband-size" as string]: `${rubberBandOffset}px` }
      : {}),
  };
  const showHandler = item.showHandler ?? false;
  const isVerticalHandler = showHandler && (position === "left" || position === "right");

  const handlerElement =
    showHandler &&
    createElement(
      "div",
      {
        ref: handlerRef,
        className: "drawer-handler-area",
        "data-position": position,
        role: "button",
        "aria-label": "Drag to close",
      },
      createElement("div", { className: "drawer-handler" })
    );

  const bodyContent = createElement(
    "div",
    { className: "drawer-body" },
    !showHandler &&
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
  );

  const footerElement =
    item.footer &&
    createElement(
      "div",
      {
        className: `drawer-footer ${item.footer.className ?? ""}`.trim(),
      },
      createElement(item.footer.component, {
        ...(typeof item.footer.props === "object" && item.footer.props !== null
          ? item.footer.props
          : {}),
        closeDrawer,
      })
    );

  const contentWrapper =
    isVerticalHandler
      ? createElement(
          "div",
          { className: "drawer-body-wrapper" },
          bodyContent,
          footerElement
        )
      : null;

  const frameChildren =
    !showHandler || !isVerticalHandler
      ? (() => {
          if (position === "top") {
            return [bodyContent, footerElement, handlerElement].filter(Boolean);
          }
          return [handlerElement, bodyContent, footerElement].filter(Boolean);
        })()
      : position === "left"
        ? [contentWrapper, handlerElement]
        : [handlerElement, contentWrapper];

  const wrapperStyle: React.CSSProperties = { ...transformStyle };

  const layerElement = createElement(
    "div",
    {
      className: "drawer-layer",
      "data-position": position,
      onClick: handleBackdropClick,
      role: "presentation",
    },
    createElement(
      "div",
      {
        className: "drawer-transform-wrapper",
        "data-position": position,
        style: Object.keys(wrapperStyle).length > 0 ? wrapperStyle : undefined,
        onTransitionEnd,
      },
      createElement(
        "div",
        {
          ...(scrollableEl != null ? { key: viewportGestureKey } : {}),
          ref: frameRef,
          tabIndex: -1,
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby":
            item.title != null ? `drawer-title-${item.id}` : undefined,
          "data-position": position,
          ...(showHandler ? {} : { "data-no-handler": true }),
          className: `drawer-frame ${rubberBandFillEnabled ? "drawer-frame-rubberband-fill" : ""} ${
            item.phase === "entered" ? "drawer-frame-entered" : ""
          } ${item.phase === "exiting" ? "drawer-frame-exit" : ""} ${
            isDragging ? "drawer-frame-dragging" : ""
          } ${
            isDragging || isSnapping || isGestureClosing
              ? "drawer-frame-gesture-active"
              : ""
          } ${
            item.title != null ? "drawer-frame-has-title" : ""
          } ${item.footer ? "drawer-frame-has-footer" : ""} ${
            isVerticalHandler ? "drawer-frame-handler-vertical" : ""
          } ${item.className ?? ""}`.trim(),
          style: frameStyle,
          onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(),
        },
        ...frameChildren
      )
    )
  );

  return createElement(
    DrawerScrollableContext.Provider,
    { value: { registerScrollable } },
    layerElement
  );
}
