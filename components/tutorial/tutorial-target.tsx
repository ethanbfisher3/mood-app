import { TutorialTargetId, useOnboardingTutorial } from "@/hooks/use-onboarding-tutorial"
import { PropsWithChildren, useEffect, useRef } from "react"
import { View, ViewProps } from "react-native"

interface TutorialTargetProps extends ViewProps {
  id: TutorialTargetId
}

export function TutorialTarget({
  id,
  children,
  ...rest
}: PropsWithChildren<TutorialTargetProps>) {
  const { registerTarget, unregisterTarget } = useOnboardingTutorial()
  const ref = useRef<View>(null)

  useEffect(() => {
    registerTarget(id, ref)
    return () => unregisterTarget(id)
  }, [id, registerTarget, unregisterTarget])

  return (
    <View ref={ref} collapsable={false} {...rest}>
      {children}
    </View>
  )
}
