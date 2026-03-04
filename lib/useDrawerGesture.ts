import { useState, useRef, useReducer, useCallback } from "react";
import { useDrag } from "@use-gesture/react";
import type { RefObject } from "react";
import type { DrawerPosition } from "./types.js";
import { setGestureClosingId } from "./store.js";

const VELOCITY_THRESHOLD = 0.4; /* px/ms - fast gesture closes */
const THRESHOLD_RATIO = 0.6; /* fraction of panel size - slow gesture must cross to close */
const SNAP_BACK_DURATION = 300;
/** Rubber band: resistance when dragging opposite to close. Stiffness = max stretch (px); higher = more stretch. */
const RUBBERBAND_STIFFNESS_RATIO = 0.075; /* fraction of panel size - max opposite-direction offset */
const ESC_DURING_DRAG_CLOSE_DURATION = 250;
const MAX_CLOSE_DURATION = 500; /* ms - matches --drawer-duration */
const MIN_CLOSE_DURATION = 100; /* ms */
/** On touch: minimum movement in close direction to allow close (avoids small flick closing the drawer). */
const MIN_MOVEMENT_TO_CLOSE_PX = 24;

interface UseDrawerGestureOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** Ref for the drag handle (handler bar). When provided, gesture is limited to this element. */
  handlerRef?: RefObject<HTMLElement | null>;
  drawerId: string;
  position: DrawerPosition;
  /** Called when drawer should close. Pass { skipExitAnimation: true } when gesture has already animated. */
  onClose: (options?: { skipExitAnimation?: boolean }) => void;
  enabled: boolean;
  phase: "entering" | "entered" | "exiting";
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

export function useDrawerGesture({
  containerRef,
  handlerRef,
  drawerId,
  position,
  onClose,
  enabled,
  phase,
}: UseDrawerGestureOptions): {
  bind: ReturnType<typeof useDrag>;
  transformStyle: React.CSSProperties;
  /** Rubber band offset in px when dragging opposite to close. 0 when not rubber banding. */
  rubberBandOffset: number;
  isDragging: boolean;
  isSnapping: boolean;
  isGestureClosing: boolean;
  onTransitionEnd: (e: React.TransitionEvent) => void;
  /** Close from current drag position (e.g. when Escape pressed during drag) */
  closeFromCurrentPosition: () => void;
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

  const gestureTarget = handlerRef ?? containerRef;
  /* Enable gesture only when drawer is fully entered - never toggle during snap/close to avoid cooldown */
  const gestureEnabled = enabled && phase === "entered";
  const axis = getAxis(position);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
      targetValue: panelSize,
      duration: ESC_DURING_DRAG_CLOSE_DURATION,
    });
  }, [axis, containerRef, drawerId, isSnapping, gestureClosing]);

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

  const bind = useDrag(
    ({ movement, velocity, last, first, event }) => {
      if (!gestureEnabled) return;
      /* Block drag while any animation is running */
      if (isSnapping || gestureClosing !== null) return;

      if (first) {
        setIsDragging(true);
      }

      const { value, vel } = getRelevantValue(position, movement, velocity);

      const el = containerRef.current;
      const panelSize =
        axis === "y"
          ? el?.offsetHeight ?? 300
          : el?.offsetWidth ?? 300;
      const stiffness = Math.max(30, panelSize * RUBBERBAND_STIFFNESS_RATIO);

      /* Close direction (positive): direct mapping. Opposite direction (negative): rubber band. */
      const displayValue = applyRubberBand(value, stiffness);
      const clampedValue = Math.max(0, value); /* used only for close-threshold logic */

      setDragOffset(displayValue);
      /* Force re-render on every move for real-time visual feedback (follows finger/mouse) */
      if (!last) {
        forceUpdate();
      }

      if (last) {
        setIsDragging(false);

        /* Release in opposite direction: snap back with animation - keep filler visible during snap */
        if (!isCloseDirection(position, movement, velocity)) {
          setSnapRubberBandSize(Math.abs(displayValue));
          setIsSnapping(true);
          setDragOffset(0);
          return;
        }

        const threshold = panelSize * THRESHOLD_RATIO;
        /* Fast close: velocity must be in close direction (vel > 0) and above threshold */
        const velocityOk = vel > 0 && vel >= VELOCITY_THRESHOLD;
        /* Slow close: movement must be in close direction and past threshold */
        const distanceOk = clampedValue >= threshold;
        /* On touch only: require minimum movement so a small flick doesn't close (touch velocity is noisy). */
        const isTouch = (event as PointerEvent)?.pointerType === "touch";
        const minMovementOk = !isTouch || clampedValue >= MIN_MOVEMENT_TO_CLOSE_PX;

        if ((velocityOk || distanceOk) && minMovementOk) {
          /* Block backdrop/click close during gesture close to prevent teleport flash */
          setGestureClosingId(drawerId);
          /* Animate from current position to closed; duration proportional to velocity */
          const remainingDist = Math.max(0, panelSize - clampedValue);
          const rawDuration = vel > 0 ? remainingDist / vel : MAX_CLOSE_DURATION;
          const duration = Math.min(
            MAX_CLOSE_DURATION,
            Math.max(MIN_CLOSE_DURATION, rawDuration)
          );
          setGestureClosing({ targetValue: panelSize, duration });
        } else {
          /* Snap back from current position - isSnapping cleared by onTransitionEnd */
          setIsSnapping(true);
          setDragOffset(0);
        }
      }
    },
    {
      axis,
      pointer: { touch: true },
      target: gestureTarget,
      enabled: gestureEnabled,
      from: () => [0, 0],
      /* Prevent scroll immediately on vertical drawers so the gesture gets touch from the start (smooth follow on mobile). */
      preventScroll: axis === "y" ? 0 : undefined,
    }
  );

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

  return {
    bind,
    transformStyle,
    rubberBandOffset,
    isDragging,
    isSnapping,
    isGestureClosing,
    onTransitionEnd,
    closeFromCurrentPosition,
  };
}
