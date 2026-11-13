export const DEMO_NOTIFICATIONS_CHANGED = 'bds-demo-notifications-changed';
const storageKey = 'bds-gis-chain-demo-notifications-v1';

const initialNotifications = [
  { id: 'welcome', title: 'Chào mừng đến GIS-CHAIN', body: 'Menu tài khoản và các trang demo đã sẵn sàng để bạn trải nghiệm.', time: 'Hôm nay', read: false },
  { id: 'sample-data', title: 'Hồ sơ mẫu sẵn sàng', body: 'Bạn có thể xem bản đồ GIS và danh sách hồ sơ bất động sản mẫu.', time: 'Hôm nay', read: false },
];

export function loadDemoNotifications() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === null) return initialNotifications;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : initialNotifications;
  } catch {
    return initialNotifications;
  }
}

function saveDemoNotifications(notifications) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(notifications));
  } catch {
    // Keep the UI usable in private browsing modes that block localStorage.
  }
  window.dispatchEvent(new CustomEvent(DEMO_NOTIFICATIONS_CHANGED, { detail: notifications }));
}

export function setDemoNotificationRead(id, read) {
  saveDemoNotifications(loadDemoNotifications().map((item) => item.id === id ? { ...item, read } : item));
}

export function markAllDemoNotificationsRead() {
  saveDemoNotifications(loadDemoNotifications().map((item) => ({ ...item, read: true })));
}
