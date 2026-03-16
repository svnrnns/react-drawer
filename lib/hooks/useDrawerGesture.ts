import { useState, useRef, useReducer, useCallback, useEffect } from "react";
import type { RefObject } from "react";
import type {
  DrawerPosition,
  DrawerSwipeStartEvent,
  DrawerSwipeEvent,
  DrawerSwipeEndEvent,
} from "../types.js";
import { setGestureClosingId } from "../store.js";

const VELOCITY_THRESHOLD = 0.25; /* px/ms - fast gesture closes (lower = less velocity needed) */
const THRESHOLD_RATIO = 0.6; /* fraction of panel size - slow gesture must cross to close */
const SNAP_BACK_DURATION = 300;
/** Rubber band: resistance when dragging opposite to close. Stiffness = max stretch (px); higher = more stretch. */
const RUBBERBAND_STIFFNESS_RATIO = 0.075; /* fraction of panel size - max opposite-direction offset */
const ESC_DURING_DRAG_CLOSE_DURATION = 250;
const MAX_CLOSE_DURATION = 500; /* ms - matches --drawer-duration */
const MIN_CLOSE_DURATION = 100; /* ms */
/** On touch: minimum movement in close direction to allow close (avoids small flick closing the drawer). */
const MIN_MOVEMENT_TO_CLOSE_PX = 24;
/** Tolerance in px for "at scroll boundary" (handles subpixel). */
const SCROLL_EDGE_TOLERANCE = 2;
/** Min movement (px) before we decide scroll vs drawer when touch started on scrollable. */
const MIN_MOVEMENT_TO_DECIDE_PX = 3;
const MIN_DT_MS = 8; /* min delta time for velocity to avoid division by zero */

interface UseDrawerGestureOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** Ref for the drag handle (handler bar). When provided, gesture is limited to this element. */
  handlerRef?: RefObject<HTMLElement | null>;
  /** Scrollable element (e.g. from DrawerScrollable). When set, touch at scroll boundary in close direction is claimed for the drawer gesture. */
  scrollableEl?: HTMLElement | null;
  drawerId: string;
  position: DrawerPosition;
  /** Called when drawer should close. Pass { skipExitAnimation: true } when gesture has already animated. */
  onClose: (options?: { skipExitAnimation?: boolean }) => void;
  /** Called when the swipe gesture starts */
  onSwipeStart?: (event: DrawerSwipeStartEvent) => void;
  /** Called during the swipe gesture (on each move) */
  onSwipe?: (event: DrawerSwipeEvent) => void;
  /** Called when the swipe gesture ends */
  onSwipeEnd?: (event: DrawerSwipeEndEvent) => void;
  enabled: boolean;
  phase: "entering" | "entered" | "exiting";
  /** Extra distance (px) to add to close animation target (100% + this). Default 0. */
  closeExtraOffset?: number;
}

export interface UseDrawerGestureBind {
  (): Record<string, never>;
}

function getAxis(position: DrawerPosition): "x" | "y" {
  return position === "top" || position === "bottom" ? "y" : "x";
}

/**
 * Close direction is opposite to open direction:
 * - right: opens sliding left from right edge → close by dragging right (movement[0] > 0)
 * - left: opens sliding right from left edge → close by dragging left (movement[0] < 0)
 * - bottom: opens sliding up from bottom → close by dragging down (movement[1] > 0)
 * - top: opens sliding down from top → close by dragging up (movement[1] < 0)
 */
function isCloseDirection(
  position: DrawerPosition,
  movement: [number, number],
  velocity: [number, number]
): boolean {
  switch (position) {
    case "bottom":
      return movement[1] > 0 || velocity[1] > 0;
    case "top":
      return movement[1] < 0 || velocity[1] < 0;
    case "left":
      return movement[0] < 0 || velocity[0] < 0;
    case "right":
      return movement[0] > 0 || velocity[0] > 0;
    default:
      return false;
  }
}

/**
 * Returns movement/velocity normalized so positive = close direction.
 * Fast close only when velocity is in close direction; slow close only when movement is.
 */
function getRelevantValue(
  position: DrawerPosition,
  movement: [number, number],
  velocity: [number, number]
): { value: number; vel: number } {
  const axis = getAxis(position);
  const idx = axis === "y" ? 1 : 0;
  let value = movement[idx];
  let vel = velocity[idx];
  /* For top and left, close direction is negative */
  if (position === "top" || position === "left") {
    value = -value;
    vel = -vel;
  }
  return { value, vel };
}

/**
 * Applies rubber band resistance when dragging opposite to close direction.
 * Resistance increases progressively: more drag = less visual movement per px,
 * but movement is never fully blocked (derivative > 0 always).
 * Formula: value / (1 + |value|/stiffness) for negative value.
 */
function applyRubberBand(value: number, stiffness: number): number {
  if (value >= 0) return value;
  const abs = -value;
  return -abs / (1 + abs / stiffness);
}

/**
 * Returns true when the scrollable is at the edge in the close direction,
 * so the drawer gesture can claim the touch instead of scroll.
 */
function isAtScrollBoundaryInCloseDirection(
  position: DrawerPosition,
  el: HTMLElement,
  deltaX: number,
  deltaY: number
): boolean {
  const tol = SCROLL_EDGE_TOLERANCE;
  const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;
  switch (position) {
    case "bottom":
      /* Close = drag down (deltaY > 0). At top edge. */
      return scrollTop <= tol && deltaY > 0;
    case "top":
      /* Close = drag up (deltaY < 0). At bottom edge. */
      return scrollTop + clientHeight >= scrollHeight - tol && deltaY < 0;
    case "right":
      /* Close = drag right (deltaX > 0). At left edge. */
      return scrollLeft <= tol && deltaX > 0;
    case "left":
      /* Close = drag left (deltaX < 0). At right edge. */
      return scrollLeft + clientWidth >= scrollWidth - tol && deltaX < 0;
    default:
      return false;
  }
}

export function useDrawerGesture({
  containerRef,
  handlerRef,
  scrollableEl,
  drawerId,
  position,
  onClose,
  onSwipeStart,
  onSwipe,
  onSwipeEnd,
  enabled,
  phase,
  closeExtraOffset = 0,
}: UseDrawerGestureOptions): {
  bind: UseDrawerGestureBind;
  transformStyle: React.CSSProperties;
  /** Rubber band offset in px when dragging opposite to close. 0 when not rubber banding. */
  rubberBandOffset: number;
  isDragging: boolean;
  isSnapping: boolean;
  isGestureClosing: boolean;
  onTransitionEnd: (e: React.TransitionEvent) => void;
  /** Close from current drag position (e.g. when Escape pressed during drag) */
  closeFromCurrentPosition: () => void;
  /** 0-1 progress toward close during swipe (for overlay opacity). null when not swiping. */
  swipeProgress: number | null;
  /** Transition ms when animating overlay during gesture close. null when instant. */
  swipeTransitionMs: number | null;
} {
  const [dragOffset, setDragOffset] = useState(0);
  const [snapRubberBandSize, setSnapRubberBandSize] = useState(0); /* Preserved during snap-back */
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [gestureClosing, setGestureClosing] = useState<{
    targetValue: number;
    duration: number;
  } | null>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  /* When touch starts on scrollable: only commit to drawer drag if movement is in close direction; otherwise yield to scroll immediately so scroll and drawer never both activate. */
  const sessionRef = useRef({
    startedOnScrollable: false,
    yieldToScroll: false,
    committedToDrawer: false,
  });
  const lastPanelSizeRef = useRef(0);
  const hasUsedSwipeOpacityRef = useRef(false);

  /* When scrollableEl is set, use container so both handler and scrollable-at-boundary can drive the gesture (scroll is prevented at boundary by touch listeners). */
  const gestureTarget = scrollableEl != null ? containerRef : (handlerRef ?? containerRef);
  /* Enable gesture only when drawer is fully entered - never toggle during snap/close to avoid cooldown */
  const gestureEnabled = enabled && phase === "entered";
  const axis = getAxis(position);

  /* Prevent scroll on the scrollable when at boundary in close direction so the drawer gesture can claim the touch. */
  useEffect(() => {
    const el = scrollableEl ?? undefined;
    if (!el || !gestureEnabled) return;

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;
      if (isAtScrollBoundaryInCloseDirection(position, el, deltaX, deltaY)) {
        e.preventDefault();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    el.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart, { capture: true });
      el.removeEventListener("touchmove", onTouchMove, { capture: true });
    };
  }, [scrollableEl, position, gestureEnabled]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSwipeStartRef = useRef(onSwipeStart);
  onSwipeStartRef.current = onSwipeStart;
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const onSwipeEndRef = useRef(onSwipeEnd);
  onSwipeEndRef.current = onSwipeEnd;

  const gestureEnabledRef = useRef(gestureEnabled);
  gestureEnabledRef.current = gestureEnabled;
  const gestureClosingRef = useRef(gestureClosing);
  gestureClosingRef.current = gestureClosing;
  const isSnappingRef = useRef(isSnapping);
  isSnappingRef.current = isSnapping;

  /* Track pointer for velocity: start and last move */
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const lastMoveYRef = useRef(0);
  const lastMoveTimeRef = useRef(0);

  const closeFromCurrentPosition = useCallback(() => {
    if (isSnapping || gestureClosing !== null) return;
    const el = containerRef.current;
    const panelSize =
      axis === "y"
        ? el?.offsetHeight ?? 300
        : el?.offsetWidth ?? 300;
    setGestureClosingId(drawerId);
    setIsDragging(false);
    setGestureClosing({
      targetValue: panelSize + closeExtraOffset,
      duration: ESC_DURING_DRAG_CLOSE_DURATION,
    });
  }, [axis, containerRef, drawerId, closeExtraOffset, isSnapping, gestureClosing]);

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      if (gestureClosing !== null) {
        /* Call onClose only - avoid setGestureClosing to prevent flash back to release position */
        onCloseRef.current({ skipExitAnimation: true });
      } else if (isSnapping) {
        setSnapRubberBandSize(0);
        setIsSnapping(false);
      }
    },
    [gestureClosing, isSnapping]
  );

  /* Attach pointer listeners: use document for pointerdown so we don't depend on
   * ref being set when effect runs. On pointerdown we check if target is inside
   * gestureTarget.current; then we add move/up to document. */
  useEffect(() => {
    if (!gestureEnabled) return;

    let pointerId: number | null = null;
    let onPointerMove: (e: PointerEvent) => void = () => {};
    let onPointerUp: (e: PointerEvent) => void = () => {};

    const cleanupMoveUp = () => {
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      document.removeEventListener("pointerleave", onPointerUp, { capture: true });
      document.removeEventListener("pointercancel", onPointerUp, { capture: true });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (gestureClosingRef.current !== null) return;
      if (pointerId !== null) return;

      const el = gestureTarget?.current;
      if (!el || !el.contains(e.target as Node)) return;

      /* Same as bottom-sheets: allow new gesture during snap by clearing snap state (no cooldown) */
      if (isSnappingRef.current) {
        setSnapRubberBandSize(0);
        setIsSnapping(false);
      }

      pointerId = e.pointerId;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      lastMoveXRef.current = e.clientX;
      lastMoveYRef.current = e.clientY;
      lastMoveTimeRef.current = e.timeStamp;

      sessionRef.current.startedOnScrollable =
        scrollableEl != null && scrollableEl.contains(e.target as Node);
      sessionRef.current.yieldToScroll = false;
      sessionRef.current.committedToDrawer = false;

      /* Vertical drawer with scrollable: don't preventDefault so the scrollable can receive touch and scroll natively */
      const allowScrollNative = scrollableEl != null && axis === "y";
      if (!allowScrollNative) {
        e.preventDefault();
      }

      onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        if (gestureClosingRef.current !== null) return;

        const session = sessionRef.current;
        const movement: [number, number] = [
          moveEvent.clientX - startXRef.current,
          moveEvent.clientY - startYRef.current,
        ];

        if (session.yieldToScroll) return;

        const dt = moveEvent.timeStamp - lastMoveTimeRef.current;
        const velX = dt >= MIN_DT_MS ? (moveEvent.clientX - lastMoveXRef.current) / dt : 0;
        const velY = dt >= MIN_DT_MS ? (moveEvent.clientY - lastMoveYRef.current) / dt : 0;
        const velocity: [number, number] = [velX, velY];

        if (!session.committedToDrawer) {
          const movementSize =
            axis === "y" ? Math.abs(movement[1]) : Math.abs(movement[0]);
          const hasMeaningfulMovement = movementSize >= MIN_MOVEMENT_TO_DECIDE_PX;
          if (!hasMeaningfulMovement) return;

          const inCloseDirection = isCloseDirection(position, movement, velocity);
          const atBoundaryForClose =
            scrollableEl != null &&
            isAtScrollBoundaryInCloseDirection(
              position,
              scrollableEl,
              movement[0],
              movement[1]
            );
          if (
            session.startedOnScrollable &&
            (!inCloseDirection || !atBoundaryForClose)
          ) {
            session.yieldToScroll = true;
            return;
          }
          session.committedToDrawer = true;
          setIsDragging(true);
          const startEvent: DrawerSwipeStartEvent = { position, axis };
          onSwipeStartRef.current?.(startEvent);
        }

        if (!sessionRef.current.committedToDrawer) return;

        moveEvent.preventDefault();

        const { value, vel } = getRelevantValue(position, movement, velocity);

        const containerEl = containerRef.current;
        const panelSize =
          axis === "y"
            ? containerEl?.offsetHeight ?? 300
            : containerEl?.offsetWidth ?? 300;
        lastPanelSizeRef.current = panelSize;
        const stiffness = Math.max(30, panelSize * RUBBERBAND_STIFFNESS_RATIO);

        const displayValue = applyRubberBand(value, stiffness);

        setDragOffset(displayValue);
        const progress = Math.min(1, Math.max(0, value / panelSize));
        const swipeEvent: DrawerSwipeEvent = {
          position,
          axis,
          progress,
          dragOffset: displayValue,
          velocity: vel,
        };
        onSwipeRef.current?.(swipeEvent);
        forceUpdate();

        lastMoveXRef.current = moveEvent.clientX;
        lastMoveYRef.current = moveEvent.clientY;
        lastMoveTimeRef.current = moveEvent.timeStamp;
      };

      onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        cleanupMoveUp();
        pointerId = null;
        setIsDragging(false);

        const session = sessionRef.current;
        const movement: [number, number] = [
          upEvent.clientX - startXRef.current,
          upEvent.clientY - startYRef.current,
        ];
        const dt = upEvent.timeStamp - lastMoveTimeRef.current;
        const velX = dt >= MIN_DT_MS ? (upEvent.clientX - lastMoveXRef.current) / dt : 0;
        const velY = dt >= MIN_DT_MS ? (upEvent.clientY - lastMoveYRef.current) / dt : 0;
        const velocity: [number, number] = [velX, velY];

        const eventType = upEvent.type;
        const isCancelEvent =
          eventType === "pointercancel" || eventType === "pointerout";
        if (isCancelEvent) {
          setDragOffset(0);
          sessionRef.current.startedOnScrollable = false;
          sessionRef.current.yieldToScroll = false;
          sessionRef.current.committedToDrawer = false;
          return;
        }

        if (!session.committedToDrawer) {
          sessionRef.current.startedOnScrollable = false;
          sessionRef.current.yieldToScroll = false;
          sessionRef.current.committedToDrawer = false;
          return;
        }

        const { value, vel } = getRelevantValue(position, movement, velocity);
        const containerEl = containerRef.current;
        const panelSize =
          axis === "y"
            ? containerEl?.offsetHeight ?? 300
            : containerEl?.offsetWidth ?? 300;
        const stiffness = Math.max(30, panelSize * RUBBERBAND_STIFFNESS_RATIO);
        const displayValue = applyRubberBand(value, stiffness);
        const clampedValue = Math.max(0, value);

        const progress = Math.min(1, Math.max(0, value / panelSize));
        const swipeEndEventBase: DrawerSwipeEvent = {
          position,
          axis,
          progress,
          dragOffset: displayValue,
          velocity: vel,
        };
        const inCloseDir = isCloseDirection(position, movement, velocity);
        const threshold = panelSize * THRESHOLD_RATIO;
        const velocityOk = vel > 0 && vel >= VELOCITY_THRESHOLD;
        const distanceOk = clampedValue >= threshold;
        const isTouch =
          typeof window !== "undefined" &&
          (window.matchMedia?.("(pointer: coarse)")?.matches ?? false);
        const minMovementOk = !isTouch || clampedValue >= MIN_MOVEMENT_TO_CLOSE_PX;
        const willClose =
          inCloseDir && (velocityOk || distanceOk) && minMovementOk;
        const swipeEndEvent: DrawerSwipeEndEvent = {
          ...swipeEndEventBase,
          willClose,
        };
        onSwipeEndRef.current?.(swipeEndEvent);

        sessionRef.current.startedOnScrollable = false;
        sessionRef.current.yieldToScroll = false;
        sessionRef.current.committedToDrawer = false;

        if (!inCloseDir) {
          setSnapRubberBandSize(Math.abs(displayValue));
          setIsSnapping(true);
          setDragOffset(0);
          return;
        }

        if ((velocityOk || distanceOk) && minMovementOk) {
          setGestureClosingId(drawerId);
          const remainingDist = Math.max(0, panelSize + closeExtraOffset - clampedValue);
          const rawDuration = vel > 0 ? remainingDist / vel : MAX_CLOSE_DURATION;
          const duration = Math.min(
            MAX_CLOSE_DURATION,
            Math.max(MIN_CLOSE_DURATION, rawDuration)
          );
          setGestureClosing({ targetValue: panelSize + closeExtraOffset, duration });
        } else {
          setIsSnapping(true);
          setDragOffset(0);
        }
      };

      document.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
      document.addEventListener("pointerup", onPointerUp, { capture: true, passive: false });
      document.addEventListener("pointerleave", onPointerUp, { capture: true, passive: false });
      document.addEventListener("pointercancel", onPointerUp, { capture: true, passive: false });
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: false });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      cleanupMoveUp();
    };
  }, [
    gestureTarget,
    gestureEnabled,
    scrollableEl,
    position,
    axis,
    containerRef,
    closeExtraOffset,
    drawerId,
  ]);

  const bind: UseDrawerGestureBind = useCallback(() => ({}), []);

  const isGestureClosing = gestureClosing !== null;
  const hasTransform =
    dragOffset !== 0 || isSnapping || isGestureClosing;

  let val: number;
  let transition: string;
  if (isGestureClosing) {
    const { targetValue, duration } = gestureClosing;
    val = position === "top" || position === "left" ? -targetValue : targetValue;
    transition = `transform ${duration}ms var(--drawer-easing, cubic-bezier(.32, .72, 0, 1))`;
  } else {
    val = position === "top" || position === "left" ? -dragOffset : dragOffset;
    transition = isDragging
      ? "none"
      : `transform ${SNAP_BACK_DURATION}ms var(--drawer-easing, cubic-bezier(.32, .72, 0, 1))`;
  }

  const transformStyle: React.CSSProperties = hasTransform
    ? {
        transform:
          axis === "y"
            ? `translateY(${val}px)`
            : `translateX(${val}px)`,
        transition,
      }
    : {};

  /** Rubber band offset in px when dragging opposite to close (gap to fill). 0 when not rubber banding. */
  const rubberBandOffset =
    dragOffset < 0 ? Math.abs(dragOffset) : snapRubberBandSize;

  const panelSize = lastPanelSizeRef.current || 1;
  /* Rubber band (dragOffset < 0): keep opacity at 1 (progress 0). Snap back: animate from current to 1 (progress 0). */
  const rawProgress: number | null =
    isGestureClosing ? 1 : isSnapping ? 0 : isDragging
      ? Math.min(1, Math.max(0, dragOffset / panelSize))
      : null;
  const swipeProgress: number | null =
    rawProgress ?? (hasUsedSwipeOpacityRef.current ? 0 : null);
  if (swipeProgress !== null) hasUsedSwipeOpacityRef.current = true;
  const swipeTransitionMs: number | null =
    isGestureClosing && gestureClosing !== null
      ? gestureClosing.duration
      : isSnapping
        ? SNAP_BACK_DURATION
        : null;

  return {
    bind,
    transformStyle,
    rubberBandOffset,
    isDragging,
    isSnapping,
    isGestureClosing,
    onTransitionEnd,
    closeFromCurrentPosition,
    swipeProgress,
    swipeTransitionMs,
  };
}
