import {
  createElement,
  useCallback,
  useContext,
  type ComponentPropsWithoutRef,
} from "react";
import { DrawerScrollableContext } from "../drawerScrollableContext.js";

const DEFAULT_CLASS = "drawer-scrollable";

export type DrawerScrollableProps = ComponentPropsWithoutRef<"div">;

/**
 * Scrollable container that integrates with the Drawer gesture: when used inside
 * drawer content, the drawer can be closed by dragging from this area when the
 * scroll is at the edge in the close direction (e.g. at top for a bottom drawer).
 * Accepts standard div props; passed className overrides the default.
 */
type DrawerScrollablePropsWithRef = DrawerScrollableProps & { ref?: React.Ref<HTMLDivElement> };

export function DrawerScrollable(props: DrawerScrollablePropsWithRef) {
  const { registerScrollable } = useContext(DrawerScrollableContext);

  const { className: propsClassName, ref: refFromProps, ...rest } = props as DrawerScrollablePropsWithRef;

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerScrollable(el);
      if (typeof refFromProps === "function") {
        refFromProps(el);
      } else if (refFromProps != null) {
        (refFromProps as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [registerScrollable, refFromProps]
  );

  const className = [DEFAULT_CLASS, propsClassName].filter(Boolean).join(" ");

  return createElement("div", {
    ref: setRef,
    className,
    ...rest,
  });
}
