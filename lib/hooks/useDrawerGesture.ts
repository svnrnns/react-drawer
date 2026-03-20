import {
  useState,
  useRef,
  useReducer,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent,
  type CSSProperties,
} from "react";
import type { RefObject } from "react";
import type {
  DrawerPosition,
  DrawerSwipeStartEvent,
  DrawerSwipeEvent,
  DrawerSwipeEndEvent,
} from "../types.js";
import { setGestureClosingId } from "../store.js";

const VELOCITY_THRESHOLD = 0.4; /* px/ms - fast gesture closes (lower = less velocity needed) */
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
/** Min movement (px) before we decide scroll vs drawer when touch started on scrollable (BottomSheet-style threshold). */
const DRAG_THRESHOLD = 5;
/** Min movement before swipe callbacks / drag offset apply (touch early capture can happen before this). */
const MIN_MOVEMENT_TO_DECIDE_PX = 3;
const MIN_DT_MS = 8; /* min delta time for velocity to avoid division by zero */

/** Interactive elements that must receive tap/click; don't steal pointer capture on touch (same as BottomSheet). */
function isInteractiveElement(target: Node, stopAt: Node | null): boolean {
  let el: Node | null = target;
  while (el && el !== stopAt) {
    if (!(el instanceof HTMLElement)) {
      el = el.parentNode;
      continue;
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "button" || tag === "a" || tag === "input" || tag === "select" || tag === "textarea") return true;
    const role = el.getAttribute("role");
    if (role === "button" || role === "link" || role === "tab" || role === "menuitem" || role === "option") return true;
    if (el.hasAttribute("contenteditable")) return true;
    el = el.parentNode;
  }
  return false;
}

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

export interface DrawerGestureHandlers {
  onPointerDownCapture: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
}

export interface UseDrawerGestureBind {
  (): Record<string, never>;
}

function getAxis(position: DrawerPosition): "x" | "y" {
  return position === "top" || position === "bottom" ? "y" : "x";
}

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

function getRelevantValue(
  position: DrawerPosition,
  movement: [number, number],
  velocity: [number, number]
): { value: number; vel: number } {
  const axis = getAxis(position);
  const idx = axis === "y" ? 1 : 0;
  let value = movement[idx];
  let vel = velocity[idx];
  if (position === "top" || position === "left") {
    value = -value;
    vel = -vel;
  }
  return { value, vel };
}

function applyRubberBand(value: number, stiffness: number): number {
  if (value >= 0) return value;
  const abs = -value;
  return -abs / (1 + abs / stiffness);
}

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
      return scrollTop <= tol && deltaY > 0;
    case "top":
      return scrollTop + clientHeight >= scrollHeight - tol && deltaY < 0;
    case "right":
      return scrollLeft <= tol && deltaX > 0;
    case "left":
      return scrollLeft + clientWidth >= scrollWidth - tol && deltaX < 0;
    default:
      return false;
  }
}

/** True when scroll is away from the edge where the drawer could pull (same idea as BottomSheet shouldBlockGestures). */
function scrollBlocksDrawerPull(position: DrawerPosition, el: HTMLElement): boolean {
  const tol = SCROLL_EDGE_TOLERANCE;
  const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;
  switch (position) {
    case "bottom":
      return scrollTop > tol;
    case "top":
      return scrollTop + clientHeight < scrollHeight - tol;
    case "right":
      return scrollLeft > tol;
    case "left":
      return scrollLeft + clientWidth < scrollWidth - tol;
    default:
      return false;
  }
}

export function useDrawerGesture({
  containerRef,
  handlerRef: _handlerRef,
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
  gestureHandlers: DrawerGestureHandlers;
  transformStyle: CSSProperties;
  rubberBandOffset: number;
  isDragging: boolean;
  isSnapping: boolean;
  isGestureClosing: boolean;
  onTransitionEnd: (e: TransitionEvent<Element>) => void;
  closeFromCurrentPosition: () => void;
  swipeProgress: number | null;
  swipeTransitionMs: number | null;
} {
  const [dragOffset, setDragOffset] = useState(0);
  const [snapRubberBandSize, setSnapRubberBandSize] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [gestureClosing, setGestureClosing] = useState<{
    targetValue: number;
    duration: number;
  } | null>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastMoveRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasCapturedRef = useRef(false);
  const swipeStartFiredRef = useRef(false);
  const captureTargetRef = useRef<HTMLElement | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const lastMoveYRef = useRef(0);
  const lastMoveTimeRef = useRef(0);

  const lastPanelSizeRef = useRef(0);
  const hasUsedSwipeOpacityRef = useRef(false);

  const gestureEnabled = enabled && phase === "entered";
  const axis = getAxis(position);

  /* Prevent scroll on the scrollable when at boundary in close direction (unchanged). */
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

  const gestureClosingRef = useRef(gestureClosing);
  gestureClosingRef.current = gestureClosing;
  const isSnappingRef = useRef(isSnapping);
  isSnappingRef.current = isSnapping;

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
    (e: TransitionEvent<Element>) => {
      if (e.propertyName !== "transform") return;
      if (gestureClosing !== null) {
        onCloseRef.current({ skipExitAnimation: true });
      } else if (isSnapping) {
        setSnapRubberBandSize(0);
        setIsSnapping(false);
      }
    },
    [gestureClosing, isSnapping]
  );

  const tryReleaseCapture = useCallback((pointerId: number) => {
    const t = captureTargetRef.current;
    if (t) {
      try {
        t.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      captureTargetRef.current = null;
    }
  }, []);

  const cleanupDragState = useCallback(
    (pointerId?: number) => {
      if (hasCapturedRef.current && pointerId != null) {
        tryReleaseCapture(pointerId);
      }
      hasCapturedRef.current = false;
      swipeStartFiredRef.current = false;
      setIsDragging(false);
      dragStartRef.current = null;
      lastMoveRef.current = null;
    },
    [tryReleaseCapture]
  );

  const handlePointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!gestureEnabled || gestureClosingRef.current !== null) return;
      if (e.button !== 0) return;
      const frame = containerRef.current;
      if (!frame) return;
      const target = e.target as Node;
      if (!frame.contains(target)) return;

      const isTouch = e.pointerType === "touch";
      if (isTouch && scrollableEl != null && scrollableEl.contains(target)) {
        /* Defer capture until movement proves close-direction at scroll boundary (BottomSheet pattern). */
        return;
      }
      if (isTouch && isInteractiveElement(target, frame)) {
        return;
      }
      if (isTouch) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          captureTargetRef.current = e.currentTarget;
        } catch {
          captureTargetRef.current = null;
        }
        hasCapturedRef.current = true;
        setIsDragging(true);
      }
    },
    [gestureEnabled, containerRef, scrollableEl]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!gestureEnabled) return;
      if (gestureClosingRef.current !== null) return;
      if (e.button !== 0) return;

      const frame = containerRef.current;
      if (!frame) return;
      if (!frame.contains(e.target as Node)) return;

      if (isSnappingRef.current) {
        setSnapRubberBandSize(0);
        setIsSnapping(false);
      }

      const pid = e.pointerId;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      lastMoveXRef.current = e.clientX;
      lastMoveYRef.current = e.clientY;
      lastMoveTimeRef.current = e.timeStamp;

      const now = Date.now();
      dragStartRef.current = { x: e.clientX, y: e.clientY, time: now };
      lastMoveRef.current = { x: e.clientX, y: e.clientY, time: now };
      swipeStartFiredRef.current = false;

      const onPointerUpGlobal = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        window.removeEventListener("pointerup", onPointerUpGlobal);
        window.removeEventListener("pointercancel", onPointerUpGlobal);
        cleanupDragState(pid);
      };
      window.addEventListener("pointerup", onPointerUpGlobal);
      window.addEventListener("pointercancel", onPointerUpGlobal);
    },
    [gestureEnabled, containerRef, cleanupDragState]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!gestureEnabled || gestureClosingRef.current !== null) return;
      if (!dragStartRef.current) return;
      if (e.buttons === 0) {
        if (hasCapturedRef.current) {
          tryReleaseCapture(e.pointerId);
          setIsDragging(false);
        }
        dragStartRef.current = null;
        lastMoveRef.current = null;
        hasCapturedRef.current = false;
        swipeStartFiredRef.current = false;
        return;
      }

      lastMoveRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      const movement: [number, number] = [
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y,
      ];
      const movementSize = axis === "y" ? Math.abs(movement[1]) : Math.abs(movement[0]);
      const threshold = e.pointerType === "touch" ? 1 : DRAG_THRESHOLD;

      const dt = e.timeStamp - lastMoveTimeRef.current;
      const velX = dt >= MIN_DT_MS ? (e.clientX - lastMoveXRef.current) / dt : 0;
      const velY = dt >= MIN_DT_MS ? (e.clientY - lastMoveYRef.current) / dt : 0;
      const velocity: [number, number] = [velX, velY];

      if (!hasCapturedRef.current && movementSize > threshold) {
        const target = e.target as Node;
        if (scrollableEl != null && scrollableEl.contains(target)) {
          if (scrollBlocksDrawerPull(position, scrollableEl)) {
            return;
          }
          const atBoundary = isAtScrollBoundaryInCloseDirection(
            position,
            scrollableEl,
            movement[0],
            movement[1]
          );
          const inClose = isCloseDirection(position, movement, velocity);
          if (!atBoundary || !inClose) {
            return;
          }
          e.preventDefault();
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          captureTargetRef.current = e.currentTarget;
        } catch {
          captureTargetRef.current = null;
        }
        hasCapturedRef.current = true;
        setIsDragging(true);
        swipeStartFiredRef.current = true;
        const startEvent: DrawerSwipeStartEvent = { position, axis: getAxis(position) };
        onSwipeStartRef.current?.(startEvent);
      }

      if (!hasCapturedRef.current) return;

      if (!swipeStartFiredRef.current) {
        if (movementSize < MIN_MOVEMENT_TO_DECIDE_PX) return;
        swipeStartFiredRef.current = true;
        onSwipeStartRef.current?.({ position, axis: getAxis(position) });
      }

      e.preventDefault();

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

      lastMoveXRef.current = e.clientX;
      lastMoveYRef.current = e.clientY;
      lastMoveTimeRef.current = e.timeStamp;
    },
    [gestureEnabled, scrollableEl, position, axis, containerRef]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragStartRef.current) return;
      const didCapture = hasCapturedRef.current;
      if (didCapture) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        captureTargetRef.current = null;
        setIsDragging(false);
      }
      const dragStart = dragStartRef.current;
      const last = lastMoveRef.current;
      const movement: [number, number] = [
        e.clientX - dragStart.x,
        e.clientY - dragStart.y,
      ];
      const dtEnd = last && last.time !== dragStart.time ? Date.now() - last.time : 0;
      const velocityY = last && dtEnd > 0 ? (e.clientY - last.y) / dtEnd : 0;
      const velocityX = last && dtEnd > 0 ? (e.clientX - last.x) / dtEnd : 0;
      const useAxis = getAxis(position);
      const velocity: [number, number] = useAxis === "y" ? [0, velocityY] : [velocityX, 0];

      dragStartRef.current = null;
      lastMoveRef.current = null;
      hasCapturedRef.current = false;
      swipeStartFiredRef.current = false;

      if (!didCapture) return;

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
    },
    [position, axis, containerRef, drawerId, closeExtraOffset]
  );

  const handlePointerCancel = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (hasCapturedRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      captureTargetRef.current = null;
      setIsDragging(false);
    }
    setDragOffset(0);
    dragStartRef.current = null;
    lastMoveRef.current = null;
    hasCapturedRef.current = false;
    swipeStartFiredRef.current = false;
  }, []);

  const gestureHandlers: DrawerGestureHandlers = {
    onPointerDownCapture: handlePointerDownCapture,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  };

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

  const transformStyle: CSSProperties = hasTransform
    ? {
        transform:
          axis === "y"
            ? `translateY(${val}px)`
            : `translateX(${val}px)`,
        transition,
      }
    : {};

  const rubberBandOffset =
    dragOffset < 0 ? Math.abs(dragOffset) : snapRubberBandSize;

  const panelSize = lastPanelSizeRef.current || 1;
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
    gestureHandlers,
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
