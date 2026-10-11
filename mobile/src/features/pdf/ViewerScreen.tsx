import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { demoSlides } from "../../fixtures/demo";
import { Action, Card, DemoNotice, Screen, styles } from "../../ui/components";
import { SlidePreview } from "./SlidePreview";

export function ViewerScreen() {
  // TODO(pdf): after real PDF import is wired, require the persisted backend
  // deck ID here instead of accepting an optional route value. The sample deck
  // intentionally has no deck ID and therefore cannot create an upload attempt.
  const params = useLocalSearchParams<{ deckId?: string }>();
  const [index, setIndex] = useState(0);
  const [audience, setAudience] = useState("");
  return (
    <Screen>
      <DemoNotice />
      <Text style={styles.title}>A clearer story</Text>
      <View style={styles.between}>
        <Text style={styles.label}>SLIDE PREVIEW</Text>
        <Text style={styles.body}>
          {index + 1} / {demoSlides.length}
        </Text>
      </View>
      <SlidePreview index={index} />
      <View style={styles.between}>
        <Action
          label="Previous slide"
          disabled={index === 0}
          secondary
          onPress={() => setIndex(index - 1)}
        />
        <Action
          label="Next slide"
          disabled={index === demoSlides.length - 1}
          secondary
          onPress={() => setIndex(index + 1)}
        />
      </View>
      <Card>
        <Text style={styles.heading}>Who are you speaking to?</Text>
        <Text style={styles.body}>
          Optional audience context for your feedback.
        </Text>
        <TextInput
          accessibilityLabel="Audience description"
          placeholder="e.g. students new to this topic"
          value={audience}
          onChangeText={setAudience}
          maxLength={500}
          style={styles.input}
        />
      </Card>
      <Action
        label="Preview rehearsal"
        onPress={() =>
          router.push({
            pathname: "/rehearsal",
            params: {
              slide: index,
              audience,
              ...(typeof params.deckId === "string" ? { deckId: params.deckId } : {}),
            },
          })
        }
      />
    </Screen>
  );
}
