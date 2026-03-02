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
- **width** – Optional width for left/right drawers (e.g. `"400px"`, `400`). Omit for content-based width.
- **position** – Edge from which the drawer slides: `"top"`, `"bottom"`, `"left"`, `"right"`. Defaults to `"right"`.
- **className** – Optional class for the drawer wrapper.
- **footer** – Optional `{ component, props?, className? }` for a footer component. The footer receives its props plus **closeDrawer** (same as the content).
- **onClose** – Callback when the drawer is closed.
- **disableClickOutside** – If `true`, clicking the overlay does not close.
- **disableEsc** – If `true`, Escape does not close.

### API

- **openDrawer(options)** – Opens a drawer. Returns the drawer **id** (string). Use with `closeDrawer(id)` to close that drawer.
- **closeDrawer(id?)** – Closes the drawer. If no `id` is passed, closes the current drawer.

Each drawer content component receives **closeDrawer** (no arguments): call it to close the drawer.

### Focus trap

When a drawer is open, focus is trapped inside it: Tab / Shift+Tab wrap within the drawer, and when the drawer closes, focus returns to the previously focused element.

## CSS variables

Override these in your app to style the drawer:

| Variable                       | Default                               | Description                             |
| ------------------------------ | ------------------------------------- | --------------------------------------- |
| `--drawer-bg`                  | `#fff`                                | Drawer panel background                 |
| `--drawer-border`              | `1px solid transparent`               | Drawer panel border                     |
| `--drawer-padding`             | `1rem`                                | Padding for header and content          |
| `--drawer-footer-padding`      | `var(--drawer-padding)`               | Padding for the footer                  |
| `--drawer-gap`                 | `1rem`                                | Gap between header, content, footer     |
| `--drawer-title-color`         | `#0f172a`                             | Title text color                        |
| `--drawer-title-font-size`     | `1rem`                                | Title font size                         |
| `--drawer-title-line-height`   | `1`                                   | Title line height                       |
| `--drawer-border-radius`       | `0`                                   | Drawer corners (shadcn style: straight) |
| `--drawer-shadow`              | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Box shadow                              |
| `--drawer-overlay-bg`          | `rgba(0, 0, 0, 0.3)`                  | Backdrop color                          |
| `--drawer-overlay-blur-filter` | `blur(8px)`                           | Backdrop blur (full filter value)       |
| `--drawer-duration`            | `200ms`                               | Animation duration                      |
| `--drawer-max-height`          | `min(95vh, 95dvh)`                    | Maximum height for top/bottom drawers   |
| `--drawer-close-size`          | `1.75rem`                             | Close button width and height           |
| `--drawer-close-padding`       | `0.25rem`                             | Close button padding                    |
| `--drawer-close-border-radius` | `0.5rem`                              | Close button border radius              |
| `--drawer-close-bg`            | `transparent`                         | Close button background                 |
| `--drawer-close-hover-bg`      | `rgba(0, 0, 0, 0.05)`                 | Close button hover background           |
| `--drawer-close-color`         | `#3e4658`                             | Close icon color                        |
| `--drawer-close-hover-color`   | `#0f172a`                             | Close icon hover color                  |

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
