import { onMounted, onUnmounted, readonly, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'

export function useUnsavedChangesGuard(
  hasUnsavedChanges: MaybeRefOrGetter<boolean>,
  flush: () => Promise<boolean>,
) {
  const router = useRouter()
  const confirmationOpen = ref(false)
  let removeRouteGuard: (() => void) | null = null
  let resolveConfirmation: ((leave: boolean) => void) | null = null
  let confirmationPromise: Promise<boolean> | null = null

  function requestLeaveConfirmation(): Promise<boolean> {
    if (confirmationPromise) return confirmationPromise
    confirmationOpen.value = true
    confirmationPromise = new Promise((resolve) => { resolveConfirmation = resolve })
    return confirmationPromise
  }

  function settleConfirmation(leave: boolean) {
    confirmationOpen.value = false
    resolveConfirmation?.(leave)
    resolveConfirmation = null
    confirmationPromise = null
  }

  async function guardNavigation() {
    if (!toValue(hasUnsavedChanges)) return true
    if (await flush()) return true
    return requestLeaveConfirmation()
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (!toValue(hasUnsavedChanges)) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => {
    removeRouteGuard = router.beforeEach(guardNavigation)
    globalThis.window.addEventListener('beforeunload', beforeUnload)
  })
  onUnmounted(() => {
    settleConfirmation(false)
    removeRouteGuard?.()
    removeRouteGuard = null
    globalThis.window.removeEventListener('beforeunload', beforeUnload)
  })

  return {
    confirmationOpen: readonly(confirmationOpen),
    stay: () => settleConfirmation(false),
    leave: () => settleConfirmation(true),
  }
}
