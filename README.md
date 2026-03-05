# @svnrnns/react-drawer

Imperative drawer for React. Open drawers with `openDrawer()`; one drawer at a time, slides in from any edge with overlay blur and animations.

## Install

```bash
npm install @svnrnns/react-drawer
```

## Setup

1. Mount `DrawerRoot` once in your app (e.g. in your root layout).

```tsx
import { DrawerRoot } from "@svnrnns/react-drawer";
import "@svnrnns/react-drawer/styles.css";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <DrawerRoot />
        {children}
      </body>
    </html>
  );
}
```

**DrawerRoot props** (optional):
- **disableOverlay** – If `true`, all drawers render without overlay; background stays interactable.
- **disableRubberBandFill** – If `true`, disables the rubber band gap fill for all drawers.
- **closeExtraOffset** – Extra distance in pixels that all drawers travel when closing (100% + this value). Default `0`. Individual drawers can override this via `openDrawer({ closeExtraOffset: … })`.
- **disableBodyScroll** – If `true`, all drawers disable body scroll (no scrollbar on `document.body`) while open. Individual drawers can override via `openDrawer({ disableBodyScroll: … })`.

2. Import and use `openDrawer` and `closeDrawer` anywhere (no context needed).

## Usage

### Basic drawer

```tsx
import { openDrawer } from "@svnrnns/react-drawer";

function MyContent({
  name,
  closeDrawer,
}: {
  name: string;
  closeDrawer: () => void;
}) {
  return (
    <div>
      <p>Hello, {name}</p>
      <button onClick={closeDrawer}>Close</button>
    </div>
  );
}

function App() {
  return (
    <button
      onClick={() =>
        openDrawer({
          component: MyContent,
          props: { name: "World" },
          title: "Greeting",
        })
      }
    >
      Open drawer
    </button>
  );
}
```

TypeScript infers `props` from your component, so `props: { name: "World" }` is type-checked.

### Options

- **component** – React component to render (receives `props` + `closeDrawer`).
- **props** – Props for the component (inferred from `component`).
- **title** – Optional title in the drawer header.
- **width** – Optional width for left/right drawers (e.g. `"400px"`, `400`). Omit for content-based width. Ignored for top/bottom.
- **height** – Optional height for top/bottom drawers (e.g. `"300px"`, `300`). Ignored for left/right (they use full viewport height).
- **position** – Edge from which the drawer slides: `"top"`, `"bottom"`, `"left"`, `"right"`. Defaults to `"right"`.
- **className** – Optional class for the drawer wrapper.
- **footer** – Optional `{ component, props?, className? }` for a footer component. The footer receives its props plus **closeDrawer** (same as the content).
- **onClose** – Callback when the drawer is closed.
- **onSwipeStart** – Callback when the swipe gesture starts. Receives `{ position, axis }`.
- **onSwipe** – Callback during the swipe (called on each move). Receives `{ position, axis, progress, dragOffset, velocity }`.
- **onSwipeEnd** – Callback when the swipe ends. Receives `{ position, axis, progress, dragOffset, velocity, willClose }`.
- **disableClickOutside** – If `true`, clicking the overlay does not close.
- **disableEsc** – If `true`, Escape does not close.
- **disableOverlay** – If `true`, overlay is not rendered; clicking outside won't close, background is interactable.
- **disableGestureClose** – If `true`, drag-to-close gesture is disabled.
- **showHandler** – If `true`, shows the drag handler bar. Default: `true` for `position: "bottom"`, `false` otherwise.
- **onlyHandlerGestures** – If `true`, swipe gestures only work on the handler and `DrawerScrollable`; the rest of the drawer is non-draggable.
- **rubberBandFill** – If `true`, fills the gap when rubber band dragging (default). Use `false` to show transparent gap.
- **closeExtraOffset** – Extra distance in pixels the drawer travels when closing (100% + this value). Default `0`. When not set, uses the value from `DrawerRoot` if any.
- **disableBodyScroll** – If `true`, disables body scroll (hides scrollbar on `document.body`) while this drawer is open. When not set, uses the value from `DrawerRoot` if any.

### Gesture handling

Drawers support drag-to-close gestures (mouse and touch). Drag in the direction the drawer was opened from to close it. A **fast swipe** closes the drawer; a **slow drag** closes only if released near the edge. Bottom drawers include a gray handler bar at the top by default.

You can listen to swipe events with **onSwipeStart**, **onSwipe**, and **onSwipeEnd**:

| Callback      | When called                         | Event shape                                                                 |
| ------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| **onSwipeStart** | When the user starts dragging       | `{ position, axis }`                                                        |
| **onSwipe**      | On each move during the gesture     | `{ position, axis, progress, dragOffset, velocity }`                        |
| **onSwipeEnd**   | When the user releases              | `{ position, axis, progress, dragOffset, velocity, willClose }`             |

- **position** – `"top"` | `"bottom"` | `"left"` | `"right"` (edge the drawer slides from).
- **axis** – `"x"` | `"y"` (swipe axis).
- **progress** – 0–1 (0 = fully open, 1 = fully closed).
- **dragOffset** – Current drag in pixels (positive = toward close).
- **velocity** – Velocity in close direction (px/ms).
- **willClose** – (onSwipeEnd only) `true` if the drawer will close, `false` if it will snap back.

### Scrollable content and `DrawerScrollable`

When the drawer content has a scrollable area (e.g. a long list), touch gestures can conflict: the inner scroll often wins and the drawer stops reacting. Use the **DrawerScrollable** component for the scrollable container so the drawer can claim the gesture when the user is at the scroll edge in the close direction (e.g. at the top for a bottom drawer, then dragging down closes the drawer).

Import it from the same package and wrap your scrollable content. It accepts standard `div` props; any `className` you pass is merged and takes precedence over the default. The component registers itself with the drawer so that at the scroll boundary, the close gesture works instead of overscroll.

```tsx
import { openDrawer, DrawerScrollable } from "@svnrnns/react-drawer";

function MyContent({ closeDrawer }: { closeDrawer: () => void }) {
  return (
    <div>
      <p>Header</p>
      <DrawerScrollable className="my-scroll-area">
        {/* Long content: when scrolled to top, dragging down closes the drawer */}
        {items.map((item) => <div key={item.id}>{item.name}</div>)}
      </DrawerScrollable>
    </div>
  );
}
```

### API

- **openDrawer(options)** – Opens a drawer. Returns the drawer **id** (string). Use with `closeDrawer(id)` to close that drawer.
- **closeDrawer(id?, options?)** – Closes the drawer. If no `id` is passed, closes the current drawer. Options: `{ skipExitAnimation?: boolean }` – if `true`, skips the exit animation and clears immediately (used internally when gesture close has already animated).

Each drawer content component receives **closeDrawer** (no arguments): call it to close the drawer.

### Focus trap

When a drawer is open, focus is trapped inside it: Tab / Shift+Tab wrap within the drawer, and when the drawer closes, focus returns to the previously focused element.

## CSS variables

Override these in your app to style the drawer:

| Variable                         | Default                               | Description                             |
| -------------------------------- | ------------------------------------- | --------------------------------------- |
| `--drawer-bg`                    | `#fff`                                | Drawer panel background                 |
| `--drawer-border`                | `none`                                | Drawer panel border                     |
| `--drawer-padding`               | `1rem`                                | Padding for header and content          |
| `--drawer-footer-padding`        | `var(--drawer-padding)`               | Padding for the footer                  |
| `--drawer-gap`                   | `1rem`                                | Gap between header, content, footer     |
| `--drawer-title-color`           | `#0f172a`                             | Title text color                        |
| `--drawer-title-font-size`       | `1rem`                                | Title font size                         |
| `--drawer-title-line-height`     | `1`                                   | Title line height                       |
| `--drawer-border-radius`         | `0`                                   | Drawer corners (shadcn style: straight) |
| `--drawer-shadow`                | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Box shadow                              |
| `--drawer-overlay-bg`            | `rgba(0, 0, 0, 0.3)`                  | Backdrop color                          |
| `--drawer-overlay-blur-filter`   | `blur(8px)`                           | Backdrop blur (full filter value)       |
| `--drawer-duration`              | `.5s`                                 | Animation duration                      |
| `--drawer-easing`                | `cubic-bezier(.32, .72, 0, 1)`        | Animation easing                        |
| `--drawer-max-height`            | `min(95vh, 95dvh)`                    | Maximum height for top/bottom drawers   |
| `--drawer-close-size`            | `1.75rem`                             | Close button width and height           |
| `--drawer-close-padding`         | `0.25rem`                             | Close button padding                    |
| `--drawer-close-border-radius`   | `0.5rem`                              | Close button border radius              |
| `--drawer-close-bg`              | `transparent`                         | Close button background                 |
| `--drawer-close-hover-bg`        | `rgba(0, 0, 0, 0.05)`                 | Close button hover background           |
| `--drawer-close-color`           | `#3e4658`                             | Close icon color                        |
| `--drawer-close-hover-color`     | `#0f172a`                             | Close icon hover color                  |
| `--drawer-handler-bg`            | `#cbd5e1`                             | Drag handler bar color                  |
| `--drawer-handler-width`         | `40px`                                | Handler bar width                       |
| `--drawer-handler-height`        | `4px`                                 | Handler bar height                      |
| `--drawer-handler-border-radius` | `2px`                                 | Handler bar border radius               |
| `--drawer-handler-touch-area`    | `16px`                                | Touch padding above handler             |
| `--drawer-close-extra-offset`    | `0`                                   | Extra px added to close travel (100% + this) |

Example:

```css
:root {
  --drawer-border: 1px solid #e2e8f0;
  --drawer-overlay-blur-filter: blur(8px);
}
```

## Requirements

- React 18 or 19

### React Frameworks

Drawers are rendered with `createPortal` into `document.body`, so they work with Next.js App Router and SSR. This also applies to other React frameworks.
