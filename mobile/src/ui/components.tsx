import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  ink: "#14283B",
  muted: "#596B7C",
  blue: "#2859C5",
  pale: "#EAF0FF",
  paper: "#F5F7FA",
  line: "#DAE2EB",
  white: "#FFFFFF",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 22,
    gap: 20,
    paddingBottom: 40,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -1,
  },
  heading: { fontSize: 20, fontWeight: "700", color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.blue,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  banner: { backgroundColor: colors.pale, padding: 12, borderRadius: 12 },
  bannerText: { color: "#314B7F", fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 15,
  },
});

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function DemoNotice() {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        SCREEN PREVIEW · Sample data only. PDF import, microphone recording and
        AI processing are not connected.
      </Text>
    </View>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? colors.white : colors.blue,
        borderWidth: 1,
        borderColor: secondary ? colors.line : colors.blue,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: secondary ? colors.ink : colors.white,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
