// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import { StyleSheet, Text, View } from "react-native";
import { demoSlides } from "../../fixtures/demo";
import { colors } from "../../ui/components";

// PDF owner: replace the demo surface with the rendered image for this deck/slide ID.
export function SlidePreview({ index }: { index: number }) {
  const slide = demoSlides[index] ?? demoSlides[0];
  return (
    <View
      accessibilityLabel={`Sample slide ${index + 1}: ${slide.title}`}
      style={s.slide}
    >
      <Text style={s.eyebrow}>{slide.eyebrow}</Text>
      <Text style={s.title}>{slide.title}</Text>
      <Text style={s.body}>{slide.body}</Text>
      <View style={s.footer}>
        <View style={s.rule} />
        <Text style={s.number}>{String(index + 1).padStart(2, "0")}</Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  slide: {
    backgroundColor: "#16344D",
    borderRadius: 18,
    padding: 24,
    minHeight: 260,
    gap: 18,
  },
  eyebrow: {
    color: "#B9D4EC",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  body: { color: "#DBE8F1", fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  rule: { height: 2, backgroundColor: "#678DAD", flex: 1 },
  number: { fontSize: 11, color: "#B9D4EC" },
});
