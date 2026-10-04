import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Image, Text, TextInput } from "react-native";
import type { Slide, SlideDescription } from "../../contracts";
import { API_URL } from "../../services/api";
import { Action, Card, Screen, styles } from "../../ui/components";

export function DescriptionsScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const [slides, setSlides] = useState<SlideDescription[]>([]);
  const [images, setImages] = useState<Slide[]>([]);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [desc, deck] = await Promise.all([fetch(`${API_URL}/decks/${deckId}/descriptions/`, { signal: controller.signal }), fetch(`${API_URL}/decks/${deckId}/`, { signal: controller.signal })]);
        if (!desc.ok || !deck.ok) throw new Error("Could not load slide descriptions.");
        const [data, pdf] = await Promise.all([desc.json(), deck.json()]);
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.slides) || !Array.isArray(pdf.slides) || !Number.isInteger(data.revision)) throw new Error("Invalid description response.");
        setRevision(data.revision); setSlides(data.slides); setImages(pdf.slides);
      } catch { if (!controller.signal.aborted) setMessage("Could not load descriptions. Check the backend connection."); }
    })();
    return () => controller.abort();
  }, [deckId]);
  function edit(index: number, field: keyof Omit<SlideDescription, "slide_index">, value: string) {
    setSlides(current => current.map((s, i) => i !== index ? s : { ...s, [field]: field === "key_ideas" || field === "visual_facts" ? value.split("\n") : value }));
  }
  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${API_URL}/decks/${deckId}/descriptions/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, slides }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(response.status === 409 ? "Descriptions changed elsewhere. Reopen this screen before editing again." : "Could not save. Use at most five compact facts per slide.");
      const data = await response.json(); setRevision(data.revision); setSlides(data.slides);
      setMessage("Saved. Existing suggestions are marked outdated; retry an attempt to generate feedback using these corrections.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed."); }
    finally { setBusy(false); }
  }
  return <Screen><Text style={styles.title}>Slide understanding</Text><Text style={styles.body}>Check descriptions against your slides. Corrections are reused for future rehearsals. Keep uncertain chart values in the uncertainty field.</Text>
    {!slides.length && <Text style={styles.body}>Descriptions are prepared after your first transcript when AI feedback is enabled.</Text>}
    {slides.map((slide, index) => <Card key={slide.slide_index}>
      <Text style={styles.heading}>Slide {slide.slide_index + 1}</Text>
      {!!images[slide.slide_index]?.image_url && <Image source={{ uri: images[slide.slide_index].image_url }} style={{ width: "100%", height: 190 }} resizeMode="contain" />}
      {(["summary", "key_ideas", "visual_facts", "uncertainty"] as const).map(field => <TextInput key={`${slide.slide_index}-${field}`} accessibilityLabel={`Slide ${slide.slide_index + 1} ${field}`} placeholder={field.replaceAll("_", " ")} multiline style={styles.input} maxLength={field === "summary" ? 700 : field === "uncertainty" ? 500 : 2000} value={Array.isArray(slide[field]) ? slide[field].join("\n") : slide[field] as string} onChangeText={value => edit(index, field, value)} />)}
    </Card>)}
    {!!message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
    {!!slides.length && <Action label={busy ? "Saving…" : "Save corrections"} disabled={busy} onPress={() => void save()} />}
  </Screen>;
}
