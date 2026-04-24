const CACHE = 'rifiuti-sgm-v2';
const FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES).catch(() => c.add('./index.html')))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

async function cancelScheduled() {
  try {
    const existing = await self.registration.getNotifications({ includeTriggered: true });
    existing.forEach(n => {
      if (n.tag && n.tag.startsWith('rifiuti-')) n.close();
    });
  } catch (err) {
    console.warn('cancel fail', err);
  }
}

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  // Reply either to MessageChannel port (event.ports[0]) or to the sending client
  const reply = (msg) => {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(msg);
    } else if (event.source && event.source.postMessage) {
      event.source.postMessage(msg);
    }
  };

  if (data.type === 'SCHEDULE_NOTIFICATIONS') {
    const supportsTriggers = 'showTrigger' in Notification.prototype;
    await cancelScheduled();

    if (!supportsTriggers) {
      reply({ type: 'SCHEDULE_RESULT', supported: false, count: 0 });
      return;
    }

    let count = 0;
    for (const n of data.notifications) {
      try {
        await self.registration.showNotification(n.title, {
          body: n.body,
          tag: n.tag,
          icon: n.icon,
          badge: n.icon,
          showTrigger: new TimestampTrigger(n.timestamp),
          data: { url: n.url || './' }
        });
        count++;
      } catch (err) {
        console.warn('schedule fail', err);
      }
    }
    reply({ type: 'SCHEDULE_RESULT', supported: true, count });
  }

  if (data.type === 'CANCEL_NOTIFICATIONS') {
    await cancelScheduled();
  }

  if (data.type === 'SHOW_NOW') {
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag || 'rifiuti-now',
      icon: data.icon,
      badge: data.icon,
      data: { url: data.url || './' }
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
