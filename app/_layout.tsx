import {
  handleNotificationResponse,
  setupNotificationCategories,
} from "@/services/notification-service"
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native"
import * as Notifications from "expo-notifications"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SystemUI from "expo-system-ui"
import { useEffect, useState } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import "react-native-reanimated"

import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay"
import { OnboardingTutorialProvider } from "@/hooks/use-onboarding-tutorial"
import { ProProvider } from "@/hooks/use-pro-subscription"
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
} from "react-native"

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [isDevView, setIsDevView] = useState(true)

  // Set the root background color to match the app background
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colorScheme === "dark" ? "#000" : "#fff")
  }, [colorScheme])

  // Set up notification categories and response listeners
  useEffect(() => {
    // Initialize notification categories for expandable mood actions
    setupNotificationCategories()

    // Listen for notification responses (when user interacts with notification actions)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response)
      })

    // Check if app was opened from a notification action
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response)
      }
    })

    return () => {
      responseSubscription.remove()
    }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <ProProvider>
          <OnboardingTutorialProvider>
            <Stack>
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, isDevView }}
              />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
            <StatusBar style="auto" />
            <TutorialOverlay />

            {/* Dev/Prod View Toggle Button */}
            {__DEV__ && (
              <TouchableOpacity
                style={[
                  styles.devViewToggleButton,
                  !isDevView && styles.devViewToggleProd,
                ]}
                onPress={() => setIsDevView((v) => !v)}
              >
                <Text style={styles.devViewToggleText}>
                  {isDevView ? "DEV" : "PROD"}
                </Text>
              </TouchableOpacity>
            )}
          </OnboardingTutorialProvider>
        </ProProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  devViewToggleButton: {
    position: "absolute",
    bottom: 80,
    left: 20,
    backgroundColor: "#FF9800",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999,
  },
  devViewToggleLightMode: {
    backgroundColor: "#2196F3",
    bottom: 160,
  },
  devViewToggleProd: {
    backgroundColor: "#4CAF50",
  },
  devViewToggleText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
})
