import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "../pdf/SlidePreview";
import { Action, Card, DemoNotice, Screen, styles } from "../../ui/components";

export function RehearsalScreen() {
  const params = useLocalSearchParams<{ slide?: string; audience?: string }>();
  const initial = Number(params.slide ?? 0);
  const [index, setIndex] = useState(
    Number.isInteger(initial) && initial >= 0 && initial < demoSlides.length
      ? initial
      : 0,
  );
  return (
    <Screen>
      <DemoNotice />
      <View style={styles.between}>
        <Text style={styles.heading}>Rehearsal</Text>
        <Text style={styles.label}>MICROPHONE OFF</Text>
      </View>
      <SlidePreview index={index} />
      <View style={styles.between}>
        <Action
          label="Previous slide"
          secondary
          disabled={index === 0}
          onPress={() => setIndex(index - 1)}
        />
        <Text style={styles.body}>{index + 1} / 3</Text>
        <Action
          label="Next slide"
          secondary
          disabled={index === 2}
          onPress={() => setIndex(index + 1)}
        />
      </View>
      <Card>
        <Text
          style={[
            styles.title,
            { textAlign: "center", fontVariant: ["tabular-nums"] },
          ]}
        >
          00:00
        </Text>
        <Text style={[styles.body, { textAlign: "center" }]}>
          Ready for your next rehearsal
        </Text>
        <Action
          label="Start recording · coming next"
          disabled
          onPress={() => {}}
        />
        <Text style={styles.body}>
          The recording controls will be connected here. No audio is captured in
          this preview.
        </Text>
      </Card>
      {!!params.audience && (
        <Text style={styles.body}>Audience: {params.audience}</Text>
      )}
      <Action
        label="Preview transcript and feedback"
        secondary
        onPress={() => router.push("/results")}
      />
    </Screen>
  );
}
