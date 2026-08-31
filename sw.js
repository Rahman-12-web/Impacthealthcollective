// Impact Health Collective — service worker
//
// This exists mainly to satisfy browsers' PWA installability requirement
// (a registered service worker with a fetch handler). It also caches the
// app "shell" (this HTML file + manifest + icons) so the page can still
// open if the connection drops — it does NOT cache or work with your
// Firebase data. All Firebase/Firestore requests, and anything from a
// different origin (Google Fonts, the Firebase SDK, etc.), always go
// straight to the network, untouched.

const CACHE_NAME = "ihc-shell-v2";
const APP_SHELL = [
  "index.html",
  "manifest.json"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () {
        // Don't fail install if one shell file is briefly unavailable.
      });
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Browsers refuse to accept a "redirected" Response object for a page
// navigation (this is exactly what broke opening the installed app after
// the host's server redirected a URL). If a fetch ever comes back marked
// as redirected, this rebuilds a plain, non-redirected Response with the
// same content before handing it back, so that can never happen again —
// regardless of the reason for the redirect.
function stripRedirectFlag(res) {
  if (!res || !res.redirected) return res;
  return res.blob().then(function (body) {
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Only ever handle same-origin GET requests for the app shell.
  // Everything else (Firebase, fonts, CDN scripts) is left completely alone.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req)
        .then(function (res) {
          if (res && res.status === 200 && !res.redirected) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
          }
          return stripRedirectFlag(res);
        })
        .catch(function () { return cached; });
      return cached || networkFetch;
    })
  );
});
