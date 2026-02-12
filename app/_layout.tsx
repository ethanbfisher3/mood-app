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
import { useEffect } from "react"
import "react-native-reanimated"

import { useColorScheme } from "@/hooks/use-color-scheme"

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

export const unstable_settings = {
  anchor: "(tabs)",
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

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
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
