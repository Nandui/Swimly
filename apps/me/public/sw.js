/* Turnfin Me's service worker (e-learning phase 9).
 *
 * It keeps the app's own pages and scripts so a course saved for offline
 * still opens with no signal. It never touches the staff API (another
 * origin): saved course content lives in the app's offline store instead
 * (src/lib/offline.ts). The pages kept here are the app's empty shell; what
 * a person sees on them is loaded by the page itself. */

const STATIC = "tf-static-v1";
const PAGES = "tf-pages-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add(OFFLINE)).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== STATIC && name !== PAGES).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

/** Scripts, styles and fonts never change under the same name: the copy kept is the one used. */
async function fromCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** Pages come from the network while there's signal, and the copy kept otherwise. */
async function fromNetworkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match(OFFLINE)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Next's own page data: when it fails, Next loads the whole page instead, which is kept below.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/_next/static/") || /^\/(icon|apple-icon)[\w-]*\.png$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(fromCacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(fromNetworkFirst(request));
  }
});
