import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  ThemeTideReverse,
  ThemeTideRoot,
  useThemeTide,
  type ThemeTideResult,
} from "react-theme-tide";

type ThemeName = "shore" | "deep";

const themes = {
  shore: {
    bg: "#F5F1E8",
    surface: "#FFFDF8",
    text: "#1C2733",
    muted: "#4F5D6B",
    border: "#D8CFBE",
    accent: "#0B6E69",
    accentText: "#FFFFFF",
  },
  deep: {
    bg: "#0A1622",
    surface: "#11212F",
    text: "#E7EEF3",
    muted: "#A3B3C1",
    border: "#2A4053",
    accent: "#5FD4C4",
    accentText: "#04201D",
  },
};

const labels: Record<ThemeName, string> = { shore: "Shore", deep: "Deep" };

const notes = [
  "The new theme rises from the bottom of the screen.",
  "It pauses with the waves still moving, then fills the screen.",
  "Touch the screen during a tide and the water rushes to the top.",
  "Press the other theme while the water's moving and it drains back down.",
  "Reduce Motion makes the change instant.",
  "Scroll down for more cards to test the rush.",
  "Your app keeps its own theme state. The tide only animates the change.",
  "Shore is the light theme. Deep is the dark one.",
];

function describe(result: ThemeTideResult): string {
  if (result.animated) return "Done.";
  switch (result.reason) {
    case "reversed":
      return "Went back to the theme you were on.";
    case "interrupted":
      return "Finished early.";
    case "reduced-motion":
      return "Changed instantly because Reduce Motion is on.";
    default:
      return `Changed instantly (${result.reason}).`;
  }
}

function Demo() {
  const [name, setName] = useState<ThemeName>("shore");
  const [status, setStatus] = useState("Pick a theme.");
  const tide = useThemeTide();
  const theme = themes[name];

  const choose = (next: ThemeName) => {
    if (next === name) return;
    void tide.run(() => setName(next)).then(
      (result) => setStatus(describe(result)),
      (error: unknown) => setStatus(String(error)),
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style={name === "deep" ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Theme Tide</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Theme changes that rise like water.
        </Text>
        <View style={[styles.segmented, { borderColor: theme.border }]}>
          {(Object.keys(themes) as ThemeName[]).map((value) => (
            <ThemeTideReverse key={value} disabled={value === name} style={styles.segment}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: value === name }}
                onPress={() => choose(value)}
                style={[
                  styles.segmentButton,
                  value === name && { backgroundColor: theme.accent },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: value === name ? theme.accentText : theme.text },
                  ]}
                >
                  {labels[value]}
                </Text>
              </Pressable>
            </ThemeTideReverse>
          ))}
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: theme.muted }]}>
          {status}
        </Text>
        {notes.map((note, index) => (
          <View
            key={note}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.cardTitle, { color: theme.accent }]}>{index + 1}</Text>
            <Text style={[styles.cardText, { color: theme.text }]}>{note}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeTideRoot>
        <Demo />
      </ThemeTideRoot>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 24 },
  subtitle: { fontSize: 17 },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    marginTop: 8,
  },
  segment: { flex: 1 },
  segmentButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: { fontSize: 16, fontWeight: "600" },
  status: { fontSize: 15, minHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardText: { fontSize: 17, lineHeight: 24 },
});
