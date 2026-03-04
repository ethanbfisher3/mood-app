import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { purchaseService } from "@/services/PurchaseService"

const PRO_STORAGE_KEY = "@mood_tracker_pro_status"
const MOCK_IAP_KEY = "@mood_tracker_mock_iap"

export interface ProFeature {
  id: string
  title: string
  description: string
}

export const PRO_FEATURES: ProFeature[] = [
  {
    id: "mood-distribution",
    title: "Mood Distribution",
    description: "See how your moods are distributed over time",
  },
  {
    id: "unlimited-history",
    title: "Unlimited History",
    description: "Access your complete mood history with full year view",
  },
  {
    id: "view-all-entries",
    title: "View All Entries",
    description: "Browse and search through all your mood entries in detail",
  },
  {
    id: "advanced-analytics",
    title: "Advanced Analytics",
    description: "Discover mood patterns, trends, and emotional correlations",
  },
  {
    id: "custom-reminders",
    title: "Multiple Reminders",
    description: "Set multiple reminder times throughout the day",
  },
  {
    id: "mood-insights",
    title: "Mood Insights",
    description:
      "Get personalized insights and recommendations based on your patterns",
  },
  {
    id: "multi-mood",
    title: "Multiple Daily Moods",
    description:
      "Log your mood throughout the day to capture how it changes over time",
  },
]

type ProContextValue = {
  isPro: boolean
  isLoading: boolean
  purchaseLoading: boolean
  purchaseError: string | null
  mockIapEnabled: boolean
  buyPro: () => Promise<void>
  restorePurchases: () => Promise<void>
  toggleMockIapMode: () => Promise<void>
  togglePro: () => Promise<void>
  features: ProFeature[]
}

const ProContext = createContext<ProContextValue | null>(null)

export function ProProvider({ children }: PropsWithChildren) {
  const [isPro, setIsPro] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [mockIapEnabled, setMockIapEnabled] = useState(false)

  const isProcessingRef = useRef(false)

  const persistProStatus = useCallback(async (status: boolean) => {
    await AsyncStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(status))
  }, [])

  const unlockPro = useCallback(async () => {
    setIsPro(true)
    await persistProStatus(true)
  }, [persistProStatus])

  const initialize = useCallback(async () => {
    try {
      const storedStatus = await AsyncStorage.getItem(PRO_STORAGE_KEY)
      if (storedStatus) {
        setIsPro(JSON.parse(storedStatus) === true)
      }

      const storedMockMode = await AsyncStorage.getItem(MOCK_IAP_KEY)
      const isMock = storedMockMode === "true"
      setMockIapEnabled(isMock)

      if (isMock) {
        setPurchaseError(null)
        return
      }

      // NOTE: `react-native-iap` does not work in Expo Go.
      // Use EAS build / dev client / TestFlight / Play internal testing.
      await purchaseService.initialize({
        onPurchaseCompleted: async (purchase) => {
          if (purchase.productId !== "pro_upgrade") {
            return
          }

          // TODO(server-validation): replace this client-side unlock with
          // secure server-side receipt/token verification.
          if (purchase.transactionReceipt || purchase.purchaseToken) {
            await unlockPro()
          }
        },
        onPurchaseError: (error) => {
          setPurchaseError(error.message)
        },
      })

      // Re-check on launch to support reinstall and cross-device restore.
      const restored = await purchaseService.restorePurchases()
      if (restored.length > 0) {
        await unlockPro()
      }
    } catch (error) {
      setPurchaseError(
        error instanceof Error
          ? error.message
          : "Failed to initialize purchases",
      )
    } finally {
      setIsLoading(false)
    }
  }, [unlockPro])

  useEffect(() => {
    initialize()
    return () => {
      purchaseService.cleanup()
    }
  }, [initialize])

  const buyPro = useCallback(async () => {
    if (isProcessingRef.current) {
      throw new Error("A purchase is already in progress")
    }

    setPurchaseError(null)
    setPurchaseLoading(true)
    isProcessingRef.current = true

    try {
      if (mockIapEnabled) {
        await unlockPro()
        return
      }

      await purchaseService.buyPro()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Purchase failed. Try again."
      setPurchaseError(message)
      throw error
    } finally {
      setPurchaseLoading(false)
      isProcessingRef.current = false
    }
  }, [mockIapEnabled, unlockPro])

  const restorePurchases = useCallback(async () => {
    if (isProcessingRef.current) {
      throw new Error("Another purchase action is already in progress")
    }

    setPurchaseError(null)
    setPurchaseLoading(true)
    isProcessingRef.current = true

    try {
      if (mockIapEnabled) {
        const storedStatus = await AsyncStorage.getItem(PRO_STORAGE_KEY)
        if (storedStatus === "true") {
          setIsPro(true)
        }
        return
      }

      const restored = await purchaseService.restorePurchases()
      if (restored.length > 0) {
        await unlockPro()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Restore failed. Try again."
      setPurchaseError(message)
      throw error
    } finally {
      setPurchaseLoading(false)
      isProcessingRef.current = false
    }
  }, [mockIapEnabled, unlockPro])

  const toggleMockIapMode = useCallback(async () => {
    const nextValue = !mockIapEnabled
    await AsyncStorage.setItem(MOCK_IAP_KEY, nextValue ? "true" : "false")
    setMockIapEnabled(nextValue)
    setPurchaseError(null)

    if (nextValue) {
      purchaseService.cleanup()
    }
  }, [mockIapEnabled])

  const togglePro = useCallback(async () => {
    const nextProStatus = !isPro
    setIsPro(nextProStatus)
    await persistProStatus(nextProStatus)
  }, [isPro, persistProStatus])

  const value = useMemo<ProContextValue>(
    () => ({
      isPro,
      isLoading,
      purchaseLoading,
      purchaseError,
      mockIapEnabled,
      buyPro,
      restorePurchases,
      toggleMockIapMode,
      togglePro,
      features: PRO_FEATURES,
    }),
    [
      isPro,
      isLoading,
      purchaseLoading,
      purchaseError,
      mockIapEnabled,
      buyPro,
      restorePurchases,
      toggleMockIapMode,
      togglePro,
    ],
  )

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>
}

export function useProSubscription() {
  const context = useContext(ProContext)
  if (!context) {
    throw new Error("useProSubscription must be used within ProProvider")
  }
  return context
}
