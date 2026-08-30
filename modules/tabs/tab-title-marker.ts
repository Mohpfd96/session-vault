const SESSION_MARKER_PATTERN = /^[🔴🟠🟡🟢🔵🟣🟤⚫⚪]\s*/u;

export function stripTabTitleMarker(title: string): string {
  return title.replace(SESSION_MARKER_PATTERN, '');
}

export function applyTabTitleMarker(title: string, emoji: string): string {
  const stripped = stripTabTitleMarker(title);
  if (stripped.length === 0) {
    return `${emoji} `;
  }
  return `${emoji} ${stripped}`;
}

export function installTabTitleMarker(emoji: string): () => void {
  let applying = false;

  const apply = (): void => {
    if (applying) {
      return;
    }
    const current = document.title;
    const next = applyTabTitleMarker(current, emoji);
    if (current === next) {
      return;
    }
    applying = true;
    document.title = next;
    applying = false;
  };

  apply();

  const observer = new MutationObserver(() => {
    apply();
  });
  const root = document.head ?? document.documentElement;
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  const started = Date.now();
  const timer = window.setInterval(() => {
    apply();
    if (Date.now() - started > 12_000) {
      window.clearInterval(timer);
    }
  }, 300);

  return () => {
    observer.disconnect();
    window.clearInterval(timer);
  };
}
