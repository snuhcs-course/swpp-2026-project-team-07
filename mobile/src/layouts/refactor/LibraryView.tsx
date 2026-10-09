import { Pressable, Text, View } from 'react-native';
import { Action, Card, Chip, Icon, Notice, Screen, TextAction, colors, styles } from './components';
import type { LibraryModel } from '../contracts';
export function LibraryView({ model }: { model: LibraryModel }) {
  const { mode, importing, notice, refreshing, importPdf, refreshLibrary, recent, practiced, hasGroups, openLibrary, openHome } = model;
  return (
    <Screen tab={mode !== "all"}>
      {mode === "home" ? (
        <View style={{ gap: 8, paddingTop: 6 }}>
          <Text style={styles.caption}>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
          <Text style={styles.title}>What are you practicing today?</Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>
            {mode === "practice" ? "Your rehearsals" : "Presentations"}
          </Text>
          <Text style={styles.body}>
            {mode === "practice"
              ? "Your attempts, grouped by presentation."
              : "Choose your slides and make them your own."}
          </Text>
        </View>
      )}
      {mode !== "practice" && (
        <View style={{ gap: 8 }}>
          <Action
            icon="upload"
            label={importing ? "Importing PDF…" : "Import PDF"}
            disabled={importing}
            onPress={() => void importPdf()}
          />
          <Text style={[styles.caption, { textAlign: "center" }]}>
            PDF · up to 20 MiB · rehearse up to 10 slides
          </Text>
        </View>
      )}
      {importing && <Notice text="Importing your PDF…" busy />}
      {!!notice && <Notice text={notice} tone="warning" />}
      <View style={styles.between}>
        <Text style={styles.heading}>
          {mode === "home"
            ? "Recent"
            : mode === "practice"
              ? "Saved rehearsals"
              : "Your library"}
        </Text>
        {mode === "home" ? (
          <TextAction label="See all" onPress={openLibrary} />
        ) : (
          <TextAction
            label={refreshing ? "Refreshing history…" : "Refresh history"}
            disabled={refreshing}
            onPress={() => void refreshLibrary()}
          />
        )}
      </View>
      {mode === "home" && refreshing && (
        <Text style={styles.caption}>Refreshing history…</Text>
      )}
      {mode === "practice"
        ? practiced.map((group) => (
            <Card key={group.key}>
              <Text style={styles.heading}>{group.title}</Text>
              <Text style={styles.caption}>
                {group.entries.length} saved {group.entries.length === 1 ? "attempt" : "attempts"} · newest first
              </Text>
              {group.entries.map((entry) => (
                <RehearsalRow key={entry.id} entry={entry} />
              ))}
            </Card>
          ))
        : recent.map((group) => (
            <PresentationCard
              key={group.key}
              group={group}
              showHistory={mode === "all"}
            />
          ))}
      {!(mode === "practice"
        ? practiced.length
        : hasGroups) && (
        <View
          style={[
            styles.card,
            {
              alignItems: "center",
              paddingVertical: 36,
              gap: 14,
              borderStyle: "dashed",
            },
          ]}
        >
          <Icon
            name={mode === "practice" ? "mic" : "file-text"}
            size={40}
            color={colors.muted}
          />
          <Text style={styles.heading}>
            {mode === "practice" ? "No rehearsals yet" : "No presentations yet"}
          </Text>
          <Text style={[styles.body, { textAlign: "center", maxWidth: 280 }]}>
            {mode === "practice"
              ? "Record a presentation and your saved sessions will appear here."
              : "Import your slides to practice, then revisit your recording alongside each slide."}
          </Text>
          {mode === "practice" && (
            <Action
              label="Choose a presentation"
              onPress={openHome}
            />
          )}
        </View>
      )}
      {mode === "home" && !hasGroups && (
        <Notice
          title="Saved on your device"
          text="Capture works offline. Stopping a recording automatically uploads the PDF and audio. Transcription follows the first-use OpenAI disclosure; AI feedback remains a separate action."
        />
      )}
    </Screen>
  );
}
function PresentationCard({ group, showHistory }: { group: LibraryModel['recent'][number]; showHistory: boolean }) {
  const pdf = group.hasPdf, latest = group.entries[0], open = group.open;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          pdf ? `Open slides: ${group.title}` : `Review ${group.title}`
        }
        onPress={open}
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          minHeight: 64,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        {group.thumbnail}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 15,
              lineHeight: 21,
              fontWeight: "700",
              color: colors.ink,
            }}
          >
            {group.title}
          </Text>
          <Text style={styles.caption}>
            {group.entries.length
              ? `${group.entries.length} saved rehearsal${group.entries.length === 1 ? "" : "s"}`
              : "Not practiced yet"}
          </Text>
          <Chip label={latest ? latest.status : "Ready to rehearse"} />
        </View>
      </Pressable>
      {latest && !showHistory && (
        <View
          style={[
            styles.between,
            { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
          ]}
        >
          <Text style={styles.caption}>
            {latest.duration}{" "}
            · latest rehearsal
          </Text>
          <Action
            label="Review latest rehearsal"
            displayLabel="Review"
            secondary
            compact
            onPress={latest.open}
          />
        </View>
      )}
      {!pdf && (
        <Text style={styles.caption}>
          Original PDF unavailable. Saved rehearsals and media recovery remain
          accessible.
        </Text>
      )}
      {showHistory && (
        <>
          <View style={styles.row}>
            {group.removals.map((item) => (
              <TextAction
                key={item.id}
                label={`Remove ${item.title}`}
                onPress={() => void item.remove()}
              />
            ))}
          </View>
          {group.entries.map((entry) => (
            <RehearsalRow key={entry.id} entry={entry} />
          ))}
        </>
      )}
    </Card>
  );
}
function RehearsalRow({ entry }: { entry: LibraryModel['recent'][number]['entries'][number] }) {
  const date = entry.date;
  return (
    <View
      style={{
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: 12,
      }}
    >
      <View style={styles.between}>
        <Text style={styles.caption}>
          {date
            ? new Date(date).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Date unavailable"}
        </Text>
        <Chip label={entry.status} />
      </View>
      <Text style={styles.body}>
        {entry.duration}{" "}
        · {entry.local ? "Local capture" : "Server rehearsal"}
      </Text>
      <Text style={styles.caption}>
        {entry.offline}
      </Text>
      <Action
        label="Open saved rehearsal"
        secondary
        onPress={entry.open}
      />
    </View>
  );
}
