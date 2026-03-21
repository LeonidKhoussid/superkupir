export const AUTH_MODAL_OPEN_EVENT = 'kray-tour:open-auth-modal'

export const requestAuthModalOpen = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(AUTH_MODAL_OPEN_EVENT))
}
