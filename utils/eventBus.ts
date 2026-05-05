export const SENTINEL_EVENTS = {
  SET_VIEW: 'sentinel:set-view',
  PLATFORM_READY: 'sentinel:platform-ready',
  CUSTODY_CHECK: 'sentinel:custody-check',
} as const;

export type ViewMode = 'detection' | 'expedients';

export const dispatchViewChange = (mode: ViewMode) => {
  window.dispatchEvent(
    new CustomEvent(SENTINEL_EVENTS.SET_VIEW, {
      detail: mode,
      bubbles: true,
    })
  );
};

export const onViewChange = (
  callback: (mode: ViewMode) => void
): (() => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ViewMode>;
    if (customEvent.detail === 'detection' || customEvent.detail === 'expedients') {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(SENTINEL_EVENTS.SET_VIEW, handler as EventListener);
  return () => window.removeEventListener(SENTINEL_EVENTS.SET_VIEW, handler as EventListener);
};
