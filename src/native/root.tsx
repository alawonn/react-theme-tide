import {
  Canvas,
  Group,
  Image,
  Skia,
  makeImageFromView,
  type SkImage,
} from "@shopify/react-native-skia";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  attachSurface,
  rootReleased,
  rootResized,
  rootTouched,
  type TidePlan,
  type TideSurface,
} from "./engine.js";

export interface ThemeTideRootProps {
  children?: ReactNode;
  /** Style for the wrapping view. It fills its parent by default. */
  style?: StyleProp<ViewStyle>;
}

interface Picture {
  image: SkImage;
  width: number;
  height: number;
}

interface Wave {
  width: number;
  amplitude: number;
  length: number;
  speed: number;
}

/** Points between samples along the wave edge. */
const step = 4;
const easing = Easing.inOut(Easing.sin);

function frames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const next = (left: number) => {
      if (left === 0) resolve();
      else requestAnimationFrame(() => next(left - 1));
    };
    next(count);
  });
}

/**
 * Wrap your app in this once, near the top. It's the part of the screen the
 * tide covers. It holds no theme state.
 */
export function ThemeTideRoot({ children, style }: ThemeTideRootProps) {
  const viewRef = useRef<View>(null);
  const size = useRef({ width: 0, height: 0 });
  const reducedMotion = useRef(false);
  const [picture, setPicture] = useState<Picture | null>(null);
  const shown = useRef<(() => void) | null>(null);

  const line = useSharedValue(0);
  const clock = useSharedValue(0);
  const wave = useSharedValue<Wave>({ width: 0, amplitude: 0, length: 240, speed: 0 });
  const ticking = useFrameCallback((frame: { timeSinceFirstFrame: number }) => {
    "worklet";
    clock.value = frame.timeSinceFirstFrame;
  }, false);

  // The part of the old picture still above the water.
  const clip = useDerivedValue(() => {
    "worklet";
    const { width, amplitude, length, speed } = wave.value;
    const level = line.value;
    const phase = (speed * length * clock.value) / 1000;
    // Skia 2 added PathBuilder and deprecated drawing on SkPath directly.
    const factory = (Skia as { PathBuilder?: typeof Skia.PathBuilder }).PathBuilder;
    const path = factory ? factory.Make() : Skia.Path.Make();
    path.moveTo(-1, -1);
    path.lineTo(width + 1, -1);
    for (let x = width + 1; x > -1 - step; x -= step) {
      const at = Math.max(x, -1);
      path.lineTo(at, level - amplitude * Math.sin((2 * Math.PI * (at - phase)) / length));
    }
    path.close();
    return "build" in path ? path.build() : path;
  });

  useEffect(() => {
    if (picture) {
      const resolve = shown.current;
      shown.current = null;
      // Gives the canvas two frames to draw before the theme changes under it.
      if (resolve) void frames(2).then(resolve);
    }
  }, [picture]);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (alive) reducedMotion.current = value;
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value: boolean) => (reducedMotion.current = value),
    );
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") rootResized();
    });
    return () => {
      alive = false;
      subscription.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    const stop = () => {
      cancelAnimation(line);
      ticking.setActive(false);
    };
    const surface: TideSurface = {
      async cover(plan: TidePlan) {
        const { width, height } = size.current;
        if (width === 0 || height === 0) return false;
        const image = await makeImageFromView(viewRef);
        if (!image) return false;
        wave.value = {
          width,
          amplitude: plan.waveAmplitude,
          length: plan.waveLength,
          speed: plan.waveSpeed,
        };
        line.value = plan.start;
        clock.value = 0;
        await new Promise<void>((resolve) => {
          shown.current = resolve;
          setPicture({ image, width, height });
        });
        return true;
      },
      size: () => ({ ...size.current }),
      settle: () => frames(2),
      rise(plan, done) {
        ticking.setActive(true);
        line.value = withSequence(
          withTiming(plan.hold, { duration: plan.riseDuration, easing }),
          withDelay(
            plan.holdDuration,
            withTiming(plan.end, { duration: plan.finishDuration, easing }, (finished?: boolean) => {
              "worklet";
              if (finished) runOnJS(done)();
            }),
          ),
        );
      },
      travel(to, duration, done) {
        ticking.setActive(true);
        line.value = withTiming(to, { duration, easing }, (finished?: boolean) => {
          "worklet";
          if (finished) runOnJS(done)();
        });
      },
      uncover() {
        stop();
        shown.current?.();
        shown.current = null;
        setPicture(null);
      },
      reducedMotion: () => reducedMotion.current,
      hidden: () => AppState.currentState !== "active",
    };
    const detach = attachSurface(surface);
    return () => {
      detach();
      stop();
      // A tide waiting for the picture must still get to run its commit.
      shown.current?.();
      shown.current = null;
    };
  }, [clock, line, ticking, wave]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const changed = width !== size.current.width || height !== size.current.height;
    size.current = { width, height };
    if (changed) rootResized();
  };

  const onTouchEnd = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length === 0) rootReleased();
  };

  return (
    <View
      style={[styles.fill, style]}
      onLayout={onLayout}
      onTouchStart={rootTouched}
      onTouchEnd={onTouchEnd}
      onTouchCancel={rootReleased}
    >
      <View ref={viewRef} style={styles.fill} collapsable={false}>
        {children}
      </View>
      {picture ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group clip={clip}>
            <Image
              image={picture.image}
              x={0}
              y={0}
              width={picture.width}
              height={picture.height}
              fit="fill"
            />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
