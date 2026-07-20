const CACHE = 'sgm-v2-2';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== 'sgm-settings').map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow('./index.html');
  }));
});

// ── Promemoria in background (Periodic Background Sync) ──
const U='umido',P='plastica',C='carta',V='vetro e lattine',S='secco',_=null;
const CALENDARIO={
 5:[_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_],
 6:[U,_,C,U,S,U,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C,U],
 7:[S,U,_,U,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C,U,S,U,_],
 8:[U,_,_,U,P,U,_,U,_,U,C,U,S,U,_,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V],
 9:[U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P],
 10:[U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U],
 11:[_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C,U,S,U,_,U,_,V,U,P,U,_,U,_,C],
 12:[U,S,U,_,U,_,U,_,V,U,P,U,_,C,U,S,U,_,U,_,V,U,P,U,_,_,_,C,U,S,U]};
const ICONS={umido:'🍃',plastica:'♻️',carta:'📄','vetro e lattine':'🍶',secco:'🗑️'};
const getR=(m,d)=>{const a=CALENDARIO[m];return a?(a[d-1]||null):null};
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const fmtLong=d=>cap(d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}));

async function leggiImpostazioni() {
  try {
    const c = await caches.open('sgm-settings');
    const r = await c.match('./settings');
    return r ? await r.json() : null;
  } catch (e) { return null; }
}
async function salvaImpostazioni(s) {
  const c = await caches.open('sgm-settings');
  await c.put('./settings', new Response(JSON.stringify(s)));
}

async function controllaENotifica() {
  const s = await leggiImpostazioni();
  if (!s || !s.notifOn) return;
  const oggi = new Date();
  const oggiStr = oggi.toDateString();
  if (s.lastNotifDate === oggiStr) return; // già avvisato oggi
  const dom = new Date(oggi); dom.setDate(oggi.getDate() + 1);
  if (dom.getFullYear() !== 2026) return;
  const r = getR(dom.getMonth() + 1, dom.getDate());
  if (!r) return; // domani niente raccolta: nessun disturbo
  await self.registration.showNotification('♻️ Raccolta Rifiuti', {
    body: `${fmtLong(dom)}: porta fuori ${ICONS[r]} ${r}\nEsponi dopo le 22:00`,
    icon: 'icon-192.png', badge: 'icon-192.png', tag: 'sgm-promemoria'
  });
  s.lastNotifDate = oggiStr;
  await salvaImpostazioni(s);
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'sgm-daily') e.waitUntil(controllaENotifica());
});
self.addEventListener('message', e => {
  if (e.data === 'sgm-check') e.waitUntil(controllaENotifica());
});
