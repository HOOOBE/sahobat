// يحفظ ملفات التطبيق على الجهاز حتى يشتغل بدون نت.
// عند وجود نت يجلب أحدث نسخة، وعند انقطاعه يفتح النسخة المحفوظة.
const CACHE = "withdrawals-v2";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE && n !== "wd-data").map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).pathname.endsWith("/__xp")) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match("./index.html")))
  );
});

// فحص الصلاحية بالخلفية (كروم أندرويد، للتطبيق المثبت فقط، مرة كل ~12 ساعة حسب النظام)
function dNum(k) { const p = k.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
function todayKey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
async function checkXp() {
  if (self.Notification && self.Notification.permission !== "granted") return;
  const c = await caches.open("wd-data");
  const r = await c.match("./__xp"); if (!r) return;
  const { xp, xpd, cats } = await r.json();
  const items = new Set([].concat(...cats));
  const t = dNum(todayKey());
  const l = Object.keys(xp).filter(n => items.has(n)).map(n => ({ n, d: dNum(xp[n]) - t })).filter(x => x.d <= xpd).sort((a, b) => a.d - b.d);
  if (!l.length) return;
  const last = await c.match("./__nt");
  if (last && (await last.text()) === todayKey()) return;
  await c.put("./__nt", new Response(todayKey()));
  const out = l.filter(x => x.d <= 0).length, soon = l.length - out;
  await self.registration.showNotification("⏳ تنبيه صلاحية المواد", {
    body: (out ? out + " مادة منتهية أو تنتهي اليوم. " : "") + (soon ? soon + " مادة تنتهي خلال " + xpd + " يوم. " : "") + "\n" +
      l.slice(0, 4).map(x => "• " + x.n + " (" + (x.d < 0 ? "منتهية" : x.d === 0 ? "اليوم" : x.d + " يوم") + ")").join("\n"),
    icon: "icon-192.png", badge: "icon-192.png", tag: "wd-xp", lang: "ar", dir: "rtl"
  });
}
self.addEventListener("periodicsync", e => { if (e.tag === "wd-xp") e.waitUntil(checkXp().catch(() => {})); });
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(w => w.length ? w[0].focus() : self.clients.openWindow("./")));
});
