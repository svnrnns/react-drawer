import { useState, useEffect, createElement, useCallback } from "react";
import { createPortal } from "react-dom";
import { getDrawer, subscribe } from "../store.js";
import { createCloseDrawer } from "../api.js";
import { DrawerOverlay } from "./DrawerOverlay.js";
import { DrawerFrame } from "./DrawerFrame.js";
import "../styles/drawer.css";

interface DrawerRootProps {
  /** If true, all drawers render without overlay; clicking outside won't close, background is interactable */
  disableOverlay?: boolean;
}

/**
 * Renders the drawer and overlay. Must be mounted once in your app (e.g. root layout)
 * for {@link openDrawer} and {@link closeDrawer} to work.
 * Renders via a portal into `document.body`.
 */
export function DrawerRoot(props?: DrawerRootProps) {
  const disableOverlayRoot = props?.disableOverlay === true;
  const [drawer, setDrawer] = useState(getDrawer);

  useEffect(() => {
    return subscribe(() => setDrawer(getDrawer()));
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
      ? closeDrawer
      : undefined;

  const portalChildren = [
    !hideOverlay &&
      createElement(DrawerOverlay, {
        key: "overlay",
        exiting,
        onBackdropClick,
      }),
    createElement(DrawerFrame, { key: drawer.id, item: drawer }),
  ].filter(Boolean);

  return createPortal(portalChildren, document.body);
}
