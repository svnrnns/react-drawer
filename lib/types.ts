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
  /** Drawer width (for left/right) or height (for top/bottom). Capped at 90% viewport. */
  width?: string | number;
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
  /** If true, clicking the overlay does not close the drawer */
  disableClickOutside?: boolean;
  /** If true, Escape key does not close the drawer */
  disableEsc?: boolean;
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
  /** Optional drawer width (e.g. `"400px"` or 400). For left/right drawers. Max 90vw. */
  width?: string | number;
  /** Optional class name for the drawer wrapper */
  className?: string;
  /** Optional title shown in the header */
  title?: string;
  /** Optional footer configuration. Footer props are inferred from component/props. */
  footer?: DrawerFooterOptions<F>;
  /** Callback when the drawer is closed */
  onClose?: () => void;
  /** If true, clicking the overlay does not close the drawer */
  disableClickOutside?: boolean;
  /** If true, Escape key does not close the drawer */
  disableEsc?: boolean;
  /** Edge from which the drawer slides. Defaults to "right". */
  position?: DrawerPosition;
}

/** Callback subscribed to store changes (used internally by DrawerRoot) */
export type Listener = () => void;
