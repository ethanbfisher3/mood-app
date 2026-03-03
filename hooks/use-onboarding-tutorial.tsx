import AsyncStorage from "@react-native-async-storage/async-storage"
import {
    createContext,
    MutableRefObject,
    PropsWithChildren,
    RefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

const ONBOARDING_COMPLETE_KEY = "@onboarding_tutorial_complete_v1"
const PRO_TUTORIAL_COMPLETE_KEY = "@pro_tutorial_complete_v1"

export type TutorialTargetId =
  | "mood-chart"
  | "notifications-page"
  | "add-notification"
  | "mood-distribution"
  | "pro-section"
  | "year-view"
  | "advanced-analytics"
  | "mood-insights"
  | "multi-entries"

export type TutorialStepId =
  | "step-welcome"
  | "step-mood-chart"
  | "step-notifications"
  | "step-add-notification"
  | "step-pro-modal"
  | "step-distribution"
  | "pro-step-thanks"
  | "pro-step-year-view"
  | "pro-step-distribution"
  | "pro-step-advanced-analytics"
  | "pro-step-multiple-reminders"
  | "pro-step-mood-insights"
  | "pro-step-multiple-entries"

type TutorialFlow = "onboarding" | "pro"

export type TutorialStepKind = "spotlight" | "modal"
export type TutorialCardPlacement = "top" | "bottom" | "center"

export interface TutorialStep {
  id: TutorialStepId
  kind: TutorialStepKind
  title: string
  description: string
  targetId?: TutorialTargetId
  primaryLabel?: string
  cardPlacement?: TutorialCardPlacement
}

export interface MeasuredRect {
  x: number
  y: number
  width: number
  height: number
}

const ONBOARDING_STEPS: TutorialStep[] = [
  {
    id: "step-welcome",
    kind: "modal",
    title: "Welcome to Mood Tracker!",
    description: "",
    primaryLabel: "Next",
    cardPlacement: "center",
  },
  {
    id: "step-mood-chart",
    kind: "spotlight",
    targetId: "mood-chart",
    title: "Mood Chart",
    description:
      "This chart shows how your mood changes over time. Each bar represents logged moods for the selected period.",
    primaryLabel: "Next",
  },
//   {
//     id: "step-distribution",
//     kind: "spotlight",
//     targetId: "mood-distribution",
//     title: "Mood Distribution",
//     description:
//       "These bars show how often each mood appears. Larger percentages indicate patterns you can reflect on and improve.",
//     primaryLabel: "Next",
//     cardPlacement: "top",
//   },
  {
    id: "step-notifications",
    kind: "spotlight",
    targetId: "notifications-page",
    title: "Notifications",
    description:
      "Use reminders to build a mood-tracking habit. We brought you to the Notifications page so you can configure them.",
    primaryLabel: "Next",
  },
  {
    id: "step-add-notification",
    kind: "spotlight",
    targetId: "add-notification",
    title: "Add Notification",
    description:
      "Tap Add Reminder to set more times in your day. Then choose time and frequency that works for you.",
    primaryLabel: "Next",
  },
  {
    id: "step-pro-modal",
    kind: "spotlight",
    title: "Upgrade to Pro",
    targetId: "pro-section",
    description:
      "Unlock advanced analytics, deeper insights, and multiple reminders for richer mood tracking.",
    primaryLabel: "Finish",
    cardPlacement: "top",
  },
]

const PRO_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "pro-step-thanks",
    kind: "modal",
    title: "Thanks for becoming a Pro member!",
    description:
      "Let’s take a quick tour of your Pro features so you can get the most out of Mood Tracker.",
    primaryLabel: "Next",
    cardPlacement: "center",
  },
  {
    id: "pro-step-year-view",
    kind: "spotlight",
    targetId: "year-view",
    title: "Year View",
    description:
      "As a Pro member, switch to Year view to analyze long-term mood trends.",
    primaryLabel: "Next",
  },
  {
    id: "pro-step-distribution",
    kind: "spotlight",
    targetId: "mood-distribution",
    title: "Mood Distribution",
    description:
      "See how often each mood appears to spot your emotional patterns at a glance.",
    primaryLabel: "Next",
  },
  {
    id: "pro-step-advanced-analytics",
    kind: "spotlight",
    targetId: "advanced-analytics",
    title: "Advanced Analytics",
    description:
      "Use Deep Insights to understand best days, hardest days, streaks, and progress over time.",
    primaryLabel: "Next",
  },
  {
    id: "pro-step-multiple-reminders",
    kind: "spotlight",
    targetId: "add-notification",
    title: "Multiple Reminders",
    description:
      "Pro lets you add extra reminder times so mood tracking fits your day.",
    primaryLabel: "Next",
  },
  {
    id: "pro-step-mood-insights",
    kind: "spotlight",
    targetId: "mood-insights",
    title: "Mood Insights",
    description:
      "Get richer interpretation of your mood patterns and trends from your logged history.",
    primaryLabel: "Next",
  },
  {
    id: "pro-step-multiple-entries",
    kind: "spotlight",
    targetId: "multi-entries",
    title: "Multiple Entries Per Day",
    description:
      "Log more than one mood entry each day to capture emotional shifts throughout the day.",
    primaryLabel: "Finish",
  },
]

type UpgradeHandler = () => void

interface OnboardingTutorialContextValue {
  isReady: boolean
  isActive: boolean
  currentStepIndex: number
  currentStep: TutorialStep | null
  steps: TutorialStep[]
  registerTarget: (
    id: TutorialTargetId,
    ref: RefObject<any> | MutableRefObject<any | null>,
  ) => void
  unregisterTarget: (id: TutorialTargetId) => void
  measureTarget: (id: TutorialTargetId) => Promise<MeasuredRect | null>
  startTutorial: (forceReplay?: boolean) => Promise<void>
  startProTutorial: (forceReplay?: boolean) => Promise<void>
  nextStep: () => Promise<void>
  skipTutorial: () => Promise<void>
  completeTutorial: () => Promise<void>
  setUpgradeHandler: (handler: UpgradeHandler | null) => void
  onUpgradePress: () => void
}

const OnboardingTutorialContext =
  createContext<OnboardingTutorialContextValue | null>(null)

export function OnboardingTutorialProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<TutorialFlow>("onboarding")
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const targetRefs = useRef(
    new Map<TutorialTargetId, RefObject<any> | MutableRefObject<any | null>>(),
  )
  const upgradeHandlerRef = useRef<UpgradeHandler | null>(null)

  const activeSteps =
    currentFlow === "pro" ? PRO_TUTORIAL_STEPS : ONBOARDING_STEPS
  const currentStep = isActive ? activeSteps[currentStepIndex] : null

  useEffect(() => {
    let isMounted = true
    const initialize = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
        const hasCompleted = stored === "true"
        if (!isMounted) return
        if (!hasCompleted) {
          setCurrentStepIndex(0)
          setIsActive(true)
        }
      } catch (error) {
        console.error("Failed to load onboarding tutorial state:", error)
      } finally {
        if (isMounted) setIsReady(true)
      }
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [])

  const registerTarget = useCallback(
    (
      id: TutorialTargetId,
      ref: RefObject<any> | MutableRefObject<any | null>,
    ) => {
      targetRefs.current.set(id, ref)
    },
    [],
  )

  const unregisterTarget = useCallback((id: TutorialTargetId) => {
    targetRefs.current.delete(id)
  }, [])

  const measureTarget = useCallback(async (id: TutorialTargetId) => {
    const targetRef = targetRefs.current.get(id)
    const node = targetRef?.current
    if (!node || typeof node.measureInWindow !== "function") {
      return null
    }

    return new Promise<MeasuredRect | null>((resolve) => {
      requestAnimationFrame(() => {
        try {
          node.measureInWindow(
            (x: number, y: number, width: number, height: number) => {
              if (!width || !height) {
                resolve(null)
                return
              }
              resolve({ x, y, width, height })
            },
          )
        } catch {
          resolve(null)
        }
      })
    })
  }, [])

  const completeTutorial = useCallback(async () => {
    try {
      const key =
        currentFlow === "pro" ? PRO_TUTORIAL_COMPLETE_KEY : ONBOARDING_COMPLETE_KEY
      await AsyncStorage.setItem(key, "true")
    } catch (error) {
      console.error("Failed to persist onboarding completion:", error)
    } finally {
      setIsActive(false)
      setCurrentFlow("onboarding")
      setCurrentStepIndex(0)
    }
  }, [currentFlow])

  const skipTutorial = useCallback(async () => {
    await completeTutorial()
  }, [completeTutorial])

  const nextStep = useCallback(async () => {
    setCurrentStepIndex((prev) => {
      if (prev >= activeSteps.length - 1) {
        void completeTutorial()
        return prev
      }
      return prev + 1
    })
  }, [activeSteps.length, completeTutorial])

  const startTutorial = useCallback(async (forceReplay = false) => {
    try {
      if (forceReplay) {
        await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY)
      }
    } catch (error) {
      console.error("Failed to reset onboarding tutorial:", error)
    } finally {
      setCurrentFlow("onboarding")
      setCurrentStepIndex(0)
      setIsActive(true)
    }
  }, [])

  const startProTutorial = useCallback(
    async (forceReplay = false) => {
      let shouldStart = true
      try {
        if (forceReplay) {
          await AsyncStorage.removeItem(PRO_TUTORIAL_COMPLETE_KEY)
        } else {
          const completed = await AsyncStorage.getItem(PRO_TUTORIAL_COMPLETE_KEY)
          if (completed === "true") {
            shouldStart = false
          }
        }
      } catch (error) {
        console.error("Failed to initialize pro tutorial:", error)
      }

      if (shouldStart) {
        setCurrentFlow("pro")
        setCurrentStepIndex(0)
        setIsActive(true)
      }
    },
    [],
  )

  const setUpgradeHandler = useCallback((handler: UpgradeHandler | null) => {
    upgradeHandlerRef.current = handler
  }, [])

  const onUpgradePress = useCallback(() => {
    if (upgradeHandlerRef.current) {
      upgradeHandlerRef.current()
    }
  }, [])

  const value = useMemo<OnboardingTutorialContextValue>(
    () => ({
      isReady,
      isActive,
      currentStepIndex,
      currentStep,
      steps: activeSteps,
      registerTarget,
      unregisterTarget,
      measureTarget,
      startTutorial,
      startProTutorial,
      nextStep,
      skipTutorial,
      completeTutorial,
      setUpgradeHandler,
      onUpgradePress,
    }),
    [
      isReady,
      isActive,
      currentStepIndex,
      currentStep,
      activeSteps,
      registerTarget,
      unregisterTarget,
      measureTarget,
      startTutorial,
      startProTutorial,
      nextStep,
      skipTutorial,
      completeTutorial,
      setUpgradeHandler,
      onUpgradePress,
    ],
  )

  return (
    <OnboardingTutorialContext.Provider value={value}>
      {children}
    </OnboardingTutorialContext.Provider>
  )
}

export function useOnboardingTutorial() {
  const context = useContext(OnboardingTutorialContext)
  if (!context) {
    throw new Error(
      "useOnboardingTutorial must be used within OnboardingTutorialProvider",
    )
  }
  return context
}
