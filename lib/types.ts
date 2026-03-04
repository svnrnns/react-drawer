import type { ComponentType } from "react";

/**
 * Animation phase of a drawer.
 * - `entering`: drawer just opened, playing enter animation
 * - `entered`: drawer is fully visible
 * - `exiting`: drawer is closing, playing exit animation
 */
export type DrawerPhase = "entering" | "entered" | "exiting";

/**
 * Edge from which the drawer slides in.
 */
export type DrawerPosition = "top" | "bottom" | "left" | "right";

/**
 * Axis of the swipe gesture.
 */
export type DrawerSwipeAxis = "x" | "y";

/**
 * Event object passed to onSwipeStart.
 */
export interface DrawerSwipeStartEvent {
  /** Edge from which the drawer slides */
  position: DrawerPosition;
  /** Axis of the swipe gesture (x for left/right, y for top/bottom) */
  axis: DrawerSwipeAxis;
}

/**
 * Event object passed to onSwipe (during the gesture).
 */
export interface DrawerSwipeEvent extends DrawerSwipeStartEvent {
  /** Progress toward closed: 0 = fully open, 1 = fully closed */
  progress: number;
  /** Current drag offset in pixels (positive = toward close direction) */
  dragOffset: number;
  /** Current velocity in close direction (px/ms) */
  velocity: number;
}

/**
 * Event object passed to onSwipeEnd.
 */
export interface DrawerSwipeEndEvent extends DrawerSwipeEvent {
  /** True if the drawer will close; false if it will snap back */
  willClose: boolean;
}

/**
 * Props passed to the footer component. Includes all custom props plus the injected `closeDrawer` function.
 * @template T - Custom props type of the footer component
 */
export type DrawerFooterComponentProps<T = object> = T & { closeDrawer: () => void };

/**
 * Options for rendering a custom footer inside the drawer.
 * @template P - Props type of the footer component (excluding closeDrawer)
 */
export interface DrawerFooterOptions<P = object> {
  /** React component to render in the footer. Receives props plus `closeDrawer`. */
  component: ComponentType<DrawerFooterComponentProps<P>>;
  /** Props passed to the footer component. Type is inferred from the component. */
  props?: P;
  /** Optional class name for the footer wrapper */
  className?: string;
}

/**
 * Internal representation of the current drawer (single drawer only).
 * @template P - Props type of the drawer content component (excluding closeDrawer)
 */
export interface DrawerItem<P = unknown> {
  /** Unique id for this drawer instance */
  id: string;
  /** Component to render; receives props plus closeDrawer */
  component: ComponentType<P & { closeDrawer: () => void }>;
  /** Props for the component */
  props: P;
  /** Drawer width (for left/right only). Capped at 90vw. */
  width?: string | number;
  /** Drawer height (for top/bottom only). Ignored for left/right. */
  height?: string | number;
  /** Edge from which the drawer slides */
  position: DrawerPosition;
  /** Optional class name for the drawer wrapper */
  className?: string;
  /** Optional title shown in the header */
  title?: string;
  /** Optional footer configuration */
  footer?: DrawerFooterOptions<unknown>;
  /** Callback when the drawer is closed */
  onClose?: () => void;
  /** Callback when the swipe gesture starts */
  onSwipeStart?: (event: DrawerSwipeStartEvent) => void;
  /** Callback during the swipe gesture (called on each move) */
  onSwipe?: (event: DrawerSwipeEvent) => void;
  /** Callback when the swipe gesture ends */
  onSwipeEnd?: (event: DrawerSwipeEndEvent) => void;
  /** If true, clicking the overlay does not close the drawer */
  disableClickOutside?: boolean;
  /** If true, Escape key does not close the drawer */
  disableEsc?: boolean;
  /** If true, overlay is not rendered; clicking outside won't close, background is interactable */
  disableOverlay?: boolean;
  /** If true, drag gesture to close is disabled */
  disableGestureClose?: boolean;
  /** If true, shows the drag handler bar (default true for position bottom, false otherwise) */
  showHandler?: boolean;
  /** If true, swipe gestures only work on the handler and DrawerScrollable. If false/undefined, gestures work on the whole drawer (handler is decorative). */
  onlyHandlerGestures?: boolean;
  /** If true, fills the gap when rubber band dragging (default true). Use false to show transparent gap. */
  rubberBandFill?: boolean;
  /** Current animation phase */
  phase: DrawerPhase;
}

/**
 * Props passed to the drawer content component. Includes all custom props plus the injected `closeDrawer` function.
 * @template T - Custom props type of the drawer content component
 */
export type DrawerComponentProps<T = object> = T & { closeDrawer: () => void };

/**
 * Options for {@link openDrawer}. Props are inferred from the component when using generics.
 * @template T - Props type of the drawer content component (excluding closeDrawer)
 * @template F - Props type of the footer component (excluding closeDrawer)
 */
export interface OpenDrawerOptions<T = object, F = object> {
  /** React component to render as the drawer body. Receives props plus `closeDrawer`. */
  component: ComponentType<DrawerComponentProps<T>>;
  /** Props passed to the component. Type is inferred from the component. */
  props?: T;
  /** Optional drawer width (e.g. `"400px"` or 400). For left/right drawers only. Max 90vw. */
  width?: string | number;
  /** Optional drawer height (e.g. `"300px"` or 300). For top/bottom drawers only. Max 90vh. Ignored for left/right. */
  height?: string | number;
  /** Optional class name for the drawer wrapper */
  className?: string;
  /** Optional title shown in the header */
  title?: string;
  /** Optional footer configuration. Footer props are inferred from component/props. */
  footer?: DrawerFooterOptions<F>;
  /** Callback when the drawer is closed */
  onClose?: () => void;
  /** Callback when the swipe gesture starts */
  onSwipeStart?: (event: DrawerSwipeStartEvent) => void;
  /** Callback during the swipe gesture (called on each move) */
  onSwipe?: (event: DrawerSwipeEvent) => void;
  /** Callback when the swipe gesture ends */
  onSwipeEnd?: (event: DrawerSwipeEndEvent) => void;
  /** If true, clicking the overlay does not close the drawer */
  disableClickOutside?: boolean;
  /** If true, Escape key does not close the drawer */
  disableEsc?: boolean;
  /** If true, overlay is not rendered; clicking outside won't close, background is interactable */
  disableOverlay?: boolean;
  /** If true, drag gesture to close is disabled */
  disableGestureClose?: boolean;
  /** If true, shows the drag handler bar (default true for position bottom, false otherwise) */
  showHandler?: boolean;
  /** If true, swipe gestures only work on the handler and DrawerScrollable. If false/undefined, gestures work on the whole drawer (handler is decorative). */
  onlyHandlerGestures?: boolean;
  /** If true, fills the gap when rubber band dragging (default true). Use false to show transparent gap. */
  rubberBandFill?: boolean;
  /** Edge from which the drawer slides. Defaults to "right". */
  position?: DrawerPosition;
}

/** Callback subscribed to store changes (used internally by DrawerRoot) */
export type Listener = () => void;
