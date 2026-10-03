import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import Pdf from "react-native-pdf";
import type { PdfRef } from "react-native-pdf";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "../pdf/SlidePreview";
import {
  Action,
  Card,
  DemoNotice,
  Screen,
  colors,
  styles,
} from "../../ui/components";

export function RehearsalScreen() {
  const params = useLocalSearchParams<{
    slide?: string;
    audience?: string;
    uri?: string;
    title?: string;
  }>();
  const pdfUri = typeof params.uri === "string" ? params.uri : "";
  const title = typeof params.title === "string" ? params.title : "Presentation";
  const pdfRef = useRef<PdfRef>(null);
  const initialSlide = Number(params.slide ?? 0);
  const [index, setIndex] = useState(
    Number.isInteger(initialSlide) && initialSlide >= 0 && initialSlide < demoSlides.length
      ? initialSlide
      : 0,
  );
  const [pageCount, setPageCount] = useState(pdfUri ? 0 : demoSlides.length);
  const [error, setError] = useState("");

  function changeSlide(next: number) {
    const lastPage = pdfUri ? pageCount - 1 : demoSlides.length - 1;
    const target = Math.max(0, Math.min(next, lastPage));
    if (target === index || (pdfUri && pageCount === 0)) return;
    setIndex(target);
    if (pdfUri) pdfRef.current?.setPage(target + 1);
  }

  return (
    <Screen>
      {pdfUri ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            ON-DEVICE PDF · This presentation stays on this device. Recording and AI feedback are not connected yet.
          </Text>
        </View>
      ) : (
        <DemoNotice />
      )}
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Rehearsal</Text>
          {pdfUri && <Text style={styles.body}>{title}</Text>}
        </View>
        <Text style={styles.label}>MICROPHONE OFF</Text>
      </View>
      {pdfUri ? (
        <View
          style={{
            height: 460,
            width: "100%",
            overflow: "hidden",
            borderRadius: 12,
            backgroundColor: colors.white,
          }}
        >
          <Pdf
            ref={pdfRef}
            source={{ uri: pdfUri }}
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
            onError={() => setError("This PDF could not be opened in rehearsal.")}
            renderActivityIndicator={() => <ActivityIndicator color={colors.blue} />}
          />
        </View>
      ) : (
        <SlidePreview index={index} />
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {error}
        </Text>
      )}
      <View style={styles.between}>
        <Action
          label="Previous slide"
          secondary
          disabled={index === 0 || (!!pdfUri && pageCount === 0)}
          onPress={() => changeSlide(index - 1)}
        />
        <Text style={styles.body}>
          {pdfUri && pageCount === 0 ? "Loading PDF…" : `${index + 1} / ${pageCount}`}
        </Text>
        <Action
          label="Next slide"
          secondary
          disabled={index >= pageCount - 1 || (!!pdfUri && pageCount === 0)}
          onPress={() => changeSlide(index + 1)}
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
