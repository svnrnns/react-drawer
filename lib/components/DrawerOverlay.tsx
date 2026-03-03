import { createElement } from "react";

interface DrawerOverlayProps {
  exiting: boolean;
  onBackdropClick?: () => void;
}

export function DrawerOverlay({
  exiting,
  onBackdropClick,
}: DrawerOverlayProps) {
  return createElement("div", {
    "aria-hidden": true,
    className: `drawer-overlay ${exiting ? "drawer-overlay-exit" : ""}`.trim(),
    onClick: onBackdropClick,
  });
}
