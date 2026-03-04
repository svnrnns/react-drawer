import { useState, useEffect, useReducer, createElement, useCallback } from "react";
import { createPortal } from "react-dom";
import { getDrawer, subscribe, getGestureClosingId, getOverlaySwipe } from "../store.js";
import { createCloseDrawer } from "../api.js";
import { useViewportGestureKey } from "../useViewportGestureKey.js";
import { DrawerOverlay } from "./DrawerOverlay.js";
import { DrawerFrame } from "./DrawerFrame.js";
import "../styles/drawer.css";

interface DrawerRootProps {
  /** If true, all drawers render without overlay; clicking outside won't close, background is interactable */
  disableOverlay?: boolean;
  /** If true, disables rubber band fill for all drawers (no gap filler when rubber band dragging) */
  disableRubberBandFill?: boolean;
}

/**
 * Renders the drawer and overlay. Must be mounted once in your app (e.g. root layout)
 * for {@link openDrawer} and {@link closeDrawer} to work.
 * Renders via a portal into `document.body`.
 */
export function DrawerRoot(props?: DrawerRootProps) {
  const disableOverlayRoot = props?.disableOverlay === true;
  const disableRubberBandFillRoot = props?.disableRubberBandFill === true;
  const [drawer, setDrawer] = useState(getDrawer);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const overlaySwipe = getOverlaySwipe();
  const viewportGestureKey = useViewportGestureKey();

  useEffect(() => {
    return subscribe(() => {
      setDrawer(getDrawer());
      forceUpdate();
    });
  }, []);

  const closeDrawer = useCallback(() => {
    if (drawer?.id) createCloseDrawer(drawer.id)();
  }, [drawer?.id]);

  if (!drawer) return null;

  const exiting = drawer.phase === "exiting";
  const hideOverlay =
    drawer.disableOverlay === true || disableOverlayRoot;
  const onBackdropClick =
    !hideOverlay && !drawer.disableClickOutside && !exiting
      ? () => {
          /* Check at click time - avoids race when gesture close starts before re-render */
          if (getGestureClosingId() === drawer.id) return;
          closeDrawer();
        }
      : undefined;

  const portalChildren = [
    !hideOverlay &&
      createElement(DrawerOverlay, {
        key: "overlay",
        exiting,
        onBackdropClick,
        overlaySwipe,
      }),
    createElement(DrawerFrame, {
      key: `${drawer.id}-${viewportGestureKey}`,
      item: drawer,
      disableRubberBandFill: disableRubberBandFillRoot,
    }),
  ].filter(Boolean);

  return createPortal(portalChildren, document.body);
}
