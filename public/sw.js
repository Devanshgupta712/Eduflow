// ─── Service Worker Lifecycle ────────────────────────────
// These events are CRITICAL for mobile push notifications.
// Without them, the service worker may never activate on phones.

self.addEventListener('install', function(event) {
  console.log('[SW] Installing service worker...');
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activating service worker...');
  // Claim all open clients so push works without page reload
  event.waitUntil(clients.claim());
});

// ─── Push Notification Handler ──────────────────────────
self.addEventListener('push', function(event) {
  console.log('[SW] Push event received');
  
  let data = { title: 'EduSuite.ai', message: 'You have a new notification', link: '/' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('[SW] Failed to parse push data', e);
      // Try text fallback
      try {
        data.message = event.data.text();
      } catch (e2) {
        console.error('[SW] Failed to read push text', e2);
      }
    }
  }

  const options = {
    body: data.message || 'You have a new notification',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'edusuite-notification-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.link || '/'
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'EduSuite.ai', options)
  );
});

// ─── Notification Click Handler ─────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Handle action button clicks
  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Notification Close Handler ─────────────────────────
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed', event.notification.tag);
});
