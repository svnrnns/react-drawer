import { useState, useEffect, createElement, useCallback } from "react";
import { createPortal } from "react-dom";
import { getDrawer, subscribe } from "../store.js";
import { createCloseDrawer } from "../api.js";
import { DrawerOverlay } from "./DrawerOverlay.js";
import { DrawerFrame } from "./DrawerFrame.js";
import "../styles/drawer.css";

/**
 * Renders the drawer and overlay. Must be mounted once in your app (e.g. root layout)
 * for {@link openDrawer} and {@link closeDrawer} to work.
 * Renders via a portal into `document.body`.
 */
export function DrawerRoot() {
  const [drawer, setDrawer] = useState(getDrawer);

  useEffect(() => {
    return subscribe(() => setDrawer(getDrawer()));
  }, []);

  const closeDrawer = useCallback(() => {
    if (drawer?.id) createCloseDrawer(drawer.id)();
  }, [drawer?.id]);

  if (!drawer) return null;

  const exiting = drawer.phase === "exiting";
  const onBackdropClick =
    !drawer.disableClickOutside && !exiting ? closeDrawer : undefined;

  return createPortal(
    [
      createElement(DrawerOverlay, {
        key: "overlay",
        exiting,
        onBackdropClick,
      }),
      createElement(DrawerFrame, { key: drawer.id, item: drawer }),
    ],
    document.body
  );
}
