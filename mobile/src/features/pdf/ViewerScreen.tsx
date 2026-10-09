import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator } from "react-native";
import Pdf, { type PdfRef } from "react-native-pdf";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "./SlidePreview";
import { activeLayout } from "../../layouts/registry";
export function ViewerScreen() { return <activeLayout.Setup model={useSetupController()} />; }
export function useSetupController() {
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

  function changePage(next: number) {
    if (!Number.isInteger(next)) return;
    if (!uri) { setIndex(Math.max(0, Math.min(next, demoSlides.length - 1))); return; }
    if (!loaded || !visiblePageConfirmed || changingPage || error) return;
    const target = Math.max(0, Math.min(next, pageCount - 1));
    if (target === index) return;
    // Keep the handoff on the confirmed visible page until native rendering
    // acknowledges this request. A button press is not a displayed page.
    setChangingPage(true);
    pdfRef.current?.setPage(target + 1);
  }

  function start() {
    if (uri && (!loaded || !visiblePageConfirmed || changingPage || error || pageCount > 10 || !localDeckId)) return;
    router.push({ pathname: "/rehearsal", params: { slide: index, audience, ...(uri ? { uri, title, pageCount } : {}), ...(localDeckId ? { localDeckId } : {}) } });
  }
  const stage = uri ? (
        <Pdf
          ref={pdfRef}
          source={{ uri }}
          horizontal
          enablePaging
          fitPolicy={0}
          style={{ flex: 1, width: "100%", backgroundColor: "white" }}
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
          renderActivityIndicator={() => <ActivityIndicator  />}
        />
  ) : <SlidePreview index={index} />;
  return { uri, title, localDeckId, index, pageCount, loaded, visiblePageConfirmed, changingPage, error, audience, setAudience, stage, sampleCount: demoSlides.length, changePage, start };
}
