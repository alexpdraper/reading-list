const MESSAGE_KIND = 'reading-list:changed';

export function broadcastListChange(): void {
  void chrome?.runtime?.sendMessage?.({ kind: MESSAGE_KIND })?.catch(() => {});
}

export function onListChange(handler: () => void): () => void {
  const listener = (message: unknown) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { kind?: unknown }).kind === MESSAGE_KIND
    ) {
      handler();
    }
  };
  chrome?.runtime?.onMessage?.addListener(listener);
  return () => chrome?.runtime?.onMessage?.removeListener(listener);
}
