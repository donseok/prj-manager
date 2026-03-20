const openPopups = new Map<string, Window>();

// Periodically clean up closed popups
setInterval(() => {
  for (const [key, win] of openPopups) {
    if (win.closed) openPopups.delete(key);
  }
}, 2000);

export function openPopup({ projectId, page }: { projectId: string; page: 'wbs' | 'gantt' }) {
  const key = `${projectId}-${page}`;
  const existing = openPopups.get(key);

  if (existing && !existing.closed) {
    existing.focus();
    return;
  }

  const url = `/popup/projects/${projectId}/${page}`;
  const width = Math.min(screen.availWidth, 1600);
  const height = Math.min(screen.availHeight, 1000);
  const left = Math.round((screen.availWidth - width) / 2);
  const top = Math.round((screen.availHeight - height) / 2);
  const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;

  const popup = window.open(url, `dk-flow-${key}`, features);

  if (!popup) {
    alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
    return;
  }

  openPopups.set(key, popup);
}
