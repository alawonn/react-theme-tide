import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { reverseTouched } from "./engine.js";

export interface ThemeTideReverseProps {
  children?: ReactNode;
  /** Stops this control from draining the water, for example while it's selected. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrap the control that switches back to the theme you're leaving. Pressing
 * it during a tide drains the water, then its own onPress changes the theme
 * while the old screen still covers the app.
 */
export function ThemeTideReverse({ children, disabled, style }: ThemeTideReverseProps) {
  return (
    <View style={style} onTouchStart={disabled ? undefined : reverseTouched}>
      {children}
    </View>
  );
}
