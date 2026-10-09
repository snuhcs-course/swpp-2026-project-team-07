import { Text } from "react-native";
import { Action, Card, Notice, Screen, styles } from "./components";
import type { UtilitiesModel } from "../contracts";
export function UtilitiesView({ model }: { model: UtilitiesModel }) {
  const { apiUrl, checking, notice, connect, openSample } = model;
  return (
    <Screen>
      <Text style={styles.title}>Help & connection</Text>
      <Card>
        <Text style={styles.heading}>Backend connection</Text>
        <Text selectable style={styles.caption}>
          {apiUrl}
        </Text>
        <Action
          label={checking ? "Checking…" : "Check connection"}
          disabled={checking}
          onPress={() => void connect()}
        />
        {notice && <Notice text={notice} />}
      </Card>
      <Card>
        <Text style={styles.heading}>Sample presentation</Text>
        <Text style={styles.body}>
          Explore labelled sample slides separately from your own recordings.
        </Text>
        <Action
          label="Open sample slides"
          secondary
          onPress={openSample}
        />
      </Card>
    </Screen>
  );
}
