import { useState } from "react";
import { Text, View } from "react-native";
import { demoSlides, demoTranscript } from "../../fixtures/demo";
import { Action, Card, DemoNotice, Screen, styles } from "../../ui/components";

type Preview = "sample" | "processing" | "failed";
export function ResultsScreen() {
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState<Preview>("sample");
  return (
    <Screen>
      <DemoNotice />
      <Text style={styles.title}>Review your practice</Text>
      <Text style={styles.body}>
        Your words and suggestions, one slide at a time.
      </Text>
      <Text style={styles.label}>PREVIEW RESULT STATES</Text>
      <View style={{ gap: 8 }}>
        <Action
          label="Sample result"
          secondary
          onPress={() => setPreview("sample")}
        />
        <Action
          label="Processing state"
          secondary
          onPress={() => setPreview("processing")}
        />
        <Action
          label="Failure state"
          secondary
          onPress={() => setPreview("failed")}
        />
      </View>
      {preview === "processing" && (
        <Card>
          <Text style={styles.heading}>Preparing your review</Text>
          <Text style={styles.body}>
            Transcription and slide matching will run in the background. This is
            a preview of the waiting state.
          </Text>
        </Card>
      )}
      {preview === "failed" && (
        <Card>
          <Text style={styles.heading}>Processing could not finish</Text>
          <Text style={styles.body}>
            A real failed attempt should retain its recording for retry. No
            recording exists in this preview.
          </Text>
          <Action
            label="Retry processing · coming next"
            disabled
            onPress={() => {}}
          />
        </Card>
      )}
      {preview === "sample" && (
        <>
          <View style={styles.between}>
            <Action
              label="Previous"
              secondary
              disabled={index === 0}
              onPress={() => setIndex(index - 1)}
            />
            <Text style={styles.body}>
              Slide {index + 1} / {demoSlides.length}
            </Text>
            <Action
              label="Next"
              secondary
              disabled={index === 2}
              onPress={() => setIndex(index + 1)}
            />
          </View>
          <Card>
            <Text style={styles.label}>SAMPLE TRANSCRIPT</Text>
            <Text style={styles.heading}>What you said</Text>
            <Text style={styles.body}>{demoTranscript[index]}</Text>
            <Action
              label="Play this slide · coming next"
              disabled
              onPress={() => {}}
            />
          </Card>
          <Card>
            <Text style={styles.label}>SAMPLE FEEDBACK · HAND-WRITTEN</Text>
            <Text style={styles.heading}>Make the next step concrete</Text>
            <Text style={styles.body}>{demoSlides[index].notes}</Text>
            <Text style={styles.body}>
              Slide and audio evidence will appear here after analysis is
              connected.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
