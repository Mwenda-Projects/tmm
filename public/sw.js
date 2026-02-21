// public/sw.js
// Service Worker for TellMeMore Web Push Notifications
// Place this file in your /public folder

const APP_NAME = 'TellMeMore';

// ─── Push event: fired when a push notification arrives ───────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: APP_NAME, body: event.data.text() };
  }

  const title = data.title || APP_NAME;
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon.ico',          // use your app icon
    badge: '/favicon.ico',
    tag: data.tag || 'tmm-notif', // tag groups notifications of same type
    renotify: true,                // vibrate/sound even if same tag
    data: {
      url: data.url || '/',        // where to navigate on click
      type: data.type || 'general',
    },
    actions: data.actions || [],
    vibrate: [200, 100, 200],      // vibration pattern on Android
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification click: open the app at the right page ───────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ─── Notification close: analytics hook (optional) ────────────────────────────
self.addEventListener('notificationclose', (_event) => {
  // Could log dismissals here if needed
});

// ─── Activate: take control immediately ───────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});