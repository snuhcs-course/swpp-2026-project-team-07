import { Text, TextInput, View, useWindowDimensions } from "react-native";
import { Action, Card, Chip, DemoNotice, IconButton, Notice, Screen, SlideProgress, colors, styles } from "./components";
import type { SetupModel } from "../contracts";
export function SetupView({ model }: { model: SetupModel }) {
  const { height } = useWindowDimensions();
  const { uri, title, localDeckId, index, pageCount, loaded, visiblePageConfirmed, changingPage, error, audience, setAudience, stage, sampleCount, changePage, start } = model;
  if (!uri) {
    return (
      <Screen>
        <DemoNotice />
        <Text style={styles.title}>A clearer story</Text>
        <View style={styles.between}>
          <Text style={styles.label}>SAMPLE SLIDE PREVIEW</Text>
          <Text style={styles.body}>
            {index + 1} / {sampleCount}
          </Text>
        </View>
        {stage}
        <View style={styles.between}>
          <Action
            label="Previous slide"
            disabled={index === 0}
            secondary
            onPress={() => changePage(index - 1)}
          />
          <Action
            label="Next slide"
            disabled={index === sampleCount - 1}
            secondary
            onPress={() => changePage(index + 1)}
          />
        </View>
        <Card>
          <Text style={styles.heading}>Who are you speaking to?</Text>
          <Text style={styles.body}>Optional audience context for your feedback.</Text>
          <TextInput
            accessibilityLabel="Audience description"
            placeholder="e.g. students new to this topic"
            value={audience}
            onChangeText={setAudience}
            maxLength={500}
            style={styles.input}
          />
          <Action
            label="Start rehearsal"
            onPress={start}
          />
        </Card>
      </Screen>
    );
  }
  return (
    <Screen footer={<Action
      label="Start rehearsal" icon="mic"
      disabled={!loaded || !visiblePageConfirmed || changingPage || !!error || pageCount > 10 || !localDeckId}
      onPress={start}
    />}>
      <Card>
        <Text style={styles.label}>YOUR PRESENTATION</Text>
        <Text style={styles.heading}>{title}</Text>
        <View style={styles.row}><Chip label={pageCount ? `${pageCount} slides` : 'Opening PDF…'} /><Text style={styles.caption}>Saved on this device</Text></View>
      </Card>
      <View style={styles.between}><Text style={styles.heading}>Slide preview</Text><Text style={styles.caption}>{pageCount ? `${index + 1} / ${pageCount}` : "Loading PDF…"}</Text></View>
      <View style={{ height: Math.max(190, Math.min(320, height * 0.35)), width: "100%", overflow: "hidden", borderRadius: 12, backgroundColor: colors.white }}>
        {stage}
      </View>
      {pageCount > 10 && <Notice tone="warning" text="Rehearsals support at most 10 slides. Import a shorter PDF to record." />}
      {!!error && <Notice tone="error" text={error} />}
      <SlideProgress count={pageCount} index={index} />
      <View style={styles.between}>
        <IconButton icon="chevron-left"
          label="Previous slide"
          disabled={index <= 0 || !loaded || !visiblePageConfirmed || changingPage || !!error}
          onPress={() => changePage(index - 1)}
        />
        <Text style={styles.caption}>Swipe or use the arrows</Text>
        <IconButton icon="chevron-right"
          label="Next slide"
          disabled={!loaded || !visiblePageConfirmed || changingPage || !!error || index >= pageCount - 1}
          onPress={() => changePage(index + 1)}
        />
      </View>
      <Card>
        <Text style={styles.heading}>Who are you speaking to?</Text>
        <Text style={styles.body}>Optional audience context for your feedback.</Text>
        <TextInput
          accessibilityLabel="Audience description"
          placeholder="e.g. students new to this topic"
          value={audience}
          onChangeText={setAudience}
          maxLength={500}
          style={styles.input}
        />
      </Card>
      <Text style={styles.caption}>PDF only · up to 20 MiB · at most 10 slides. Stopping a recording automatically uploads the PDF and audio, then transcribes after the first-use OpenAI disclosure.</Text>
    </Screen>
  );
}
