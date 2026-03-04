import { createContext } from "react";

export interface DrawerScrollableContextValue {
  registerScrollable: (el: HTMLElement | null) => void;
}

const noop = () => {};

export const DrawerScrollableContext = createContext<DrawerScrollableContextValue>({
  registerScrollable: noop,
});
