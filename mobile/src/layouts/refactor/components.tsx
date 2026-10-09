import {
  useEffect,
  useRef,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
export const colors = {
  ink: "#141C2B",
  muted: "#5A6478",
  blue: "#172D57",
  pale: "#E7ECF6",
  paper: "#F4F6FA",
  line: "#E3E7F0",
  white: "#FFFFFF",
  coral: "#E2544A",
  danger: "#C0392E",
  coralTint: "#FDEDEB",
  green: "#1E7A54",
  greenTint: "#E6F3ED",
  amber: "#9A5B00",
  amberTint: "#FCF1DF",
  transcript: "#EEF1F7",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 16,
    gap: 18,
    paddingBottom: 28,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  between: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontFamily: "sans-serif",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: "sans-serif",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontFamily: "sans-serif",
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  caption: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  label: {
    fontFamily: "sans-serif",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.muted,
  },
  numeric: {
    fontFamily: "sans-serif",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700",
    color: colors.blue,
    fontVariant: ["tabular-nums"],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  banner: {
    backgroundColor: colors.pale,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  bannerText: { color: colors.blue, fontSize: 13, lineHeight: 20 },
  input: {
    backgroundColor: colors.white,
    borderColor: "#CFD6E4",
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 15,
    minHeight: 52,
  },
});
export type IconName = ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 20,
  color = colors.blue,
}: {
  name: IconName;
  size?: number;
  color?: ComponentProps<typeof Feather>["color"];
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
export function Screen({
  children,
  footer,
  header,
  tab = false,
  scrollKey,
}: PropsWithChildren<{
  footer?: ReactNode;
  header?: ReactNode;
  tab?: boolean;
  scrollKey?: string;
}>) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);
  return (
    <SafeAreaView
      edges={tab ? ["left", "right"] : ["left", "right", "bottom"]}
      style={styles.page}
    >
      {header && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            width: "100%",
            maxWidth: 700,
            alignSelf: "center",
          }}
        >
          {header}
        </View>
      )}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            backgroundColor: colors.paper,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            padding: 16,
            gap: 10,
            width: "100%",
            maxWidth: 700,
            alignSelf: "center",
          }}
        >
          {footer}
        </View>
      )}
    </SafeAreaView>
  );
}
export function DemoNotice() {
  return (
    <Notice
      title="Sample preview"
      text="Example slides only. Import a PDF for a saved rehearsal. Sample recordings and transcripts are separate from your presentations."
    />
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
  expanded,
  icon,
  compact = false,
  displayLabel,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  icon?: IconName;
  compact?: boolean;
  displayLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        ...(expanded !== undefined ? { expanded } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: compact ? 12 : 18,
        paddingVertical: 12,
        borderRadius: compact ? 24 : 16,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        maxWidth: "100%",
        backgroundColor: disabled
          ? colors.line
          : secondary
            ? colors.white
            : pressed
              ? "#0F1F3D"
              : colors.blue,
        borderWidth: secondary ? 1 : 0,
        borderColor: "#CFD6E4",
        opacity: pressed && secondary ? 0.65 : 1,
      })}
    >
      {icon && (
        <Icon
          name={icon}
          color={
            disabled ? colors.muted : secondary ? colors.blue : colors.white
          }
          size={18}
        />
      )}
      <Text
        style={{
          flexShrink: 1,
          textAlign: "center",
          fontFamily: "sans-serif",
          fontSize: 15,
          fontWeight: "600",
          color: disabled
            ? colors.muted
            : secondary
              ? colors.blue
              : colors.white,
        }}
      >
        {displayLabel ?? label}
      </Text>
    </Pressable>
  );
}
export function TextAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
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
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: 4,
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.blue }}>
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
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
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          backgroundColor: colors.blue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: colors.coral,
          }}
        />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700", color: colors.blue }}>
        OutLoud
      </Text>
    </View>
  );
}
export function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const palette =
    tone === "success"
      ? [colors.greenTint, colors.green]
      : tone === "warning"
        ? [colors.amberTint, colors.amber]
        : tone === "danger"
          ? [colors.coralTint, colors.danger]
          : [colors.pale, colors.blue];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 4,
        backgroundColor: palette[0],
      }}
    >
      <Text
        style={{
          fontSize: 11,
          lineHeight: 16,
          fontWeight: "600",
          color: palette[1],
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function Notice({
  title,
  text,
  tone = "info",
  busy = false,
}: {
  title?: string;
  text: string;
  tone?: "info" | "warning" | "error";
  busy?: boolean;
}) {
  const foreground =
    tone === "error"
      ? colors.danger
      : tone === "warning"
        ? colors.amber
        : colors.blue;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 14,
        borderRadius: 12,
        backgroundColor:
          tone === "error"
            ? colors.coralTint
            : tone === "warning"
              ? colors.amberTint
              : colors.pale,
      }}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Icon
          name={tone === "info" ? "info" : "alert-circle"}
          color={foreground}
          size={18}
        />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        {title && (
          <Text style={{ fontSize: 13, fontWeight: "700", color: foreground }}>
            {title}
          </Text>
        )}
        <Text style={{ fontSize: 13, lineHeight: 20, color: foreground }}>
          {text}
        </Text>
      </View>
    </View>
  );
}
export function TabBar<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onChange(item.value)}
          style={{
            flexGrow: 1,
            flexShrink: 0,
            minHeight: 48,
            paddingHorizontal: 12,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            borderBottomWidth: 3,
            borderBottomColor:
              value === item.value ? colors.blue : "transparent",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: value === item.value ? "700" : "500",
              color: value === item.value ? colors.blue : colors.muted,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Panel({
  visible,
  children,
}: PropsWithChildren<{ visible: boolean }>) {
  return (
    <View
      style={{ display: visible ? "flex" : "none", gap: 16 }}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      {children}
    </View>
  );
}
export function SlideProgress({
  count,
  index,
}: {
  count: number;
  index: number;
}) {
  if (count < 1 || count > 10) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Slide ${index + 1} of ${count}`}
      style={{ flexDirection: "row", gap: 3 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i === index ? colors.coral : colors.line,
          }}
        />
      ))}
    </View>
  );
}
export function RecordControl({
  label,
  onPress,
  disabled = false,
  recording = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  recording?: boolean;
  busy?: boolean;
}) {
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 86,
          height: 86,
          borderRadius: 43,
          borderWidth: 5,
          borderColor: colors.coralTint,
          backgroundColor: disabled ? colors.line : colors.coral,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator color={colors.blue} />
        ) : recording ? (
          <View
            style={{
              width: 25,
              height: 25,
              borderRadius: 6,
              backgroundColor: colors.white,
            }}
          />
        ) : (
          <Icon name="mic" color={colors.white} size={28} />
        )}
      </Pressable>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}
