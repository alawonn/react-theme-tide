import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

// Web versions of the components the React Native entry needs, so code shared
// between web and native imports the same names. On the web the View
// Transition covers the whole page, so neither component adds an element.

export interface ThemeTideRootProps {
  children?: ReactNode;
  /** Used by the React Native version only. */
  style?: unknown;
}

/** On the web this renders its children unchanged. */
export function ThemeTideRoot({ children }: ThemeTideRootProps): ReactNode {
  return children;
}

export interface ThemeTideReverseProps {
  /** One element. It gets the data-theme-tide-reverse attribute. */
  children?: ReactNode;
  /** Leaves the attribute off, for example while the control is selected. */
  disabled?: boolean;
  /** Used by the React Native version only. */
  style?: unknown;
}

/** On the web this adds data-theme-tide-reverse to its one child element. */
export function ThemeTideReverse({ children, disabled }: ThemeTideReverseProps): ReactNode {
  if (disabled || !isValidElement(children)) return children;
  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    "data-theme-tide-reverse": "",
  });
}
