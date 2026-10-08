import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import Pdf from "react-native-pdf";
import type { PdfRef } from "react-native-pdf";
import { demoSlides } from "../../fixtures/demo";
import { Action, Card, DemoNotice, Screen, colors, styles } from "../../ui/components";
import { SlidePreview } from "./SlidePreview";

export function ViewerScreen() {
  const { uri: routeUri, title: routeTitle, localDeckId: routeLocalDeckId } = useLocalSearchParams<{
    uri?: string;
    title?: string;
    localDeckId?: string;
  }>();
  const uri = typeof routeUri === "string" ? routeUri : "";
  const title = typeof routeTitle === "string" ? routeTitle : "Presentation";
  const localDeckId = typeof routeLocalDeckId === "string" ? routeLocalDeckId : undefined;
  const pdfRef = useRef<PdfRef>(null);
  const [index, setIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [visiblePageConfirmed, setVisiblePageConfirmed] = useState(false);
  const [changingPage, setChangingPage] = useState(false);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState("");

  if (!uri) {
    return (
      <Screen>
        <DemoNotice />
        <Text style={styles.title}>A clearer story</Text>
        <View style={styles.between}>
          <Text style={styles.label}>SAMPLE SLIDE PREVIEW</Text>
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
            onPress={() =>
              router.push({ pathname: "/rehearsal", params: { slide: index, audience, ...(localDeckId ? { localDeckId } : {}) } })
            }
          />
        </Card>
      </Screen>
    );
  }

  function changePage(next: number) {
    if (!loaded || !visiblePageConfirmed || changingPage || error) return;
    const target = Math.max(0, Math.min(next, pageCount - 1));
    if (target === index) return;
    // Keep the handoff on the confirmed visible page until native rendering
    // acknowledges this request. A button press is not a displayed page.
    setChangingPage(true);
    pdfRef.current?.setPage(target + 1);
  }

  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>Saved on this device. No PDF is sent to the server.</Text>
      <View style={styles.between}>
        <Text style={styles.label}>SLIDE PREVIEW</Text>
        <Text style={styles.body}>{pageCount ? `${index + 1} / ${pageCount}` : "Loading PDF…"}</Text>
      </View>
      <View style={{ height: 460, width: "100%", overflow: "hidden", borderRadius: 12, backgroundColor: colors.white }}>
        <Pdf
          ref={pdfRef}
          source={{ uri }}
          horizontal
          enablePaging
          fitPolicy={0}
          style={{ flex: 1, width: "100%", backgroundColor: colors.white }}
          onLoadComplete={(pages) => {
            if (!Number.isInteger(pages) || pages < 1) return;
            setPageCount(pages);
            setLoaded(true);
            setError("");
          }}
          onPageChanged={(page, pages) => {
            if (!Number.isInteger(pages) || !Number.isInteger(page) || page < 1 || page > pages) return;
            setPageCount(pages);
            setIndex(page - 1);
            setVisiblePageConfirmed(true);
            setChangingPage(false);
          }}
          onError={() => {
            setVisiblePageConfirmed(false);
            setChangingPage(false);
            setError("This PDF could not be opened. It may be damaged or password-protected.");
          }}
          renderActivityIndicator={() => <ActivityIndicator color={colors.blue} />}
        />
      </View>
      {pageCount > 10 && <Text style={styles.body}>Rehearsals support at most 10 slides. Import a shorter PDF to record.</Text>}
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.body}>{error}</Text>}
      <View style={styles.between}>
        <Action
          label="Previous slide"
          disabled={index <= 0 || !loaded || !visiblePageConfirmed || changingPage || !!error}
          secondary
          onPress={() => changePage(index - 1)}
        />
        <Action
          label="Next slide"
          disabled={!loaded || !visiblePageConfirmed || changingPage || !!error || index >= pageCount - 1}
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
      </Card>
      <Action
        label="Start rehearsal"
        disabled={!loaded || !visiblePageConfirmed || changingPage || !!error || pageCount > 10 || !localDeckId}
        onPress={() =>
          router.push({
            pathname: "/rehearsal",
            params: { slide: index, audience, uri, title, pageCount, ...(localDeckId ? { localDeckId } : {}) },
          })
        }
      />
    </Screen>
  );
}
