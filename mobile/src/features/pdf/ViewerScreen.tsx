import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import Pdf from "react-native-pdf";
import type { PdfRef } from "react-native-pdf";
import { demoSlides } from "../../fixtures/demo";
import { Action, Card, DemoNotice, Screen, colors, styles } from "../../ui/components";
import { SlidePreview } from "./SlidePreview";

export function ViewerScreen() {
  const { uri: routeUri, title: routeTitle } = useLocalSearchParams<{
    uri?: string;
    title?: string;
  }>();
  const uri = typeof routeUri === "string" ? routeUri : "";
  const title = typeof routeTitle === "string" ? routeTitle : "Presentation";
  const pdfRef = useRef<PdfRef>(null);
  const [index, setIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
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
            label="Preview rehearsal"
            onPress={() =>
              router.push({ pathname: "/rehearsal", params: { slide: index, audience } })
            }
          />
        </Card>
      </Screen>
    );
  }

  function changePage(next: number) {
    const target = Math.max(0, Math.min(next, pageCount - 1));
    if (target === index) return;
    setIndex(target);
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
            setPageCount(pages);
            setIndex(0);
            setError("");
          }}
          onPageChanged={(page, pages) => {
            setPageCount(pages);
            setIndex(page - 1);
          }}
          onError={() => setError("This PDF could not be opened. It may be damaged or password-protected.")}
          renderActivityIndicator={() => <ActivityIndicator color={colors.blue} />}
        />
      </View>
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.body}>{error}</Text>}
      <View style={styles.between}>
        <Action
          label="Previous slide"
          disabled={index <= 0 || pageCount === 0}
          secondary
          onPress={() => changePage(index - 1)}
        />
        <Action
          label="Next slide"
          disabled={pageCount === 0 || index >= pageCount - 1}
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
        label="Preview rehearsal"
        disabled={!pageCount || !!error}
        onPress={() =>
          router.push({
            pathname: "/rehearsal",
            params: { slide: index, audience, uri, title },
          })
        }
      />
    </Screen>
  );
}
