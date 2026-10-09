import { Tabs, router } from "expo-router";
import { Brand, Icon, IconButton, colors } from "./components";
export function MainNavigation() {
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
        },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { minHeight: 48 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerTitle: () => <Brand />,
          headerRight: () => (
            <IconButton
              label="Help and connection"
              icon="help-circle"
              onPress={() => router.push("/utilities")}
            />
          ),
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: "Practice",
          tabBarIcon: ({ color }) => <Icon name="clock" color={color} />,
        }}
      />
    </Tabs>
  );
}
