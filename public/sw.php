<?php
/* ==========================================================
   EasyLogger — Service Worker (PWA offline)
   Servito da PHP così la versione (e quindi la cache) cambia da sola
   ad ogni bump di APP_VERSION.
========================================================== */
require_once __DIR__ . '/config/app.php';
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('X-Content-Type-Options: nosniff');
$v = APP_VERSION;
?>
'use strict';
const VERSION = <?= json_encode($v) ?>;
const SHELL_CACHE   = 'easylogger-shell-' + VERSION;
const RUNTIME_CACHE = 'easylogger-runtime';
const V = '?v=' + encodeURIComponent(VERSION);

const SHELL = [
  './',
  'assets/css/style.css' + V,
  'assets/js/i18n.js' + V,
  'assets/js/app.js' + V,
  'manifest.json',
  'favicon/favicon.ico',
  'favicon/favicon-16x16.png',
  'favicon/favicon-32x32.png',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
];
// Risorse esterne: messe in cache "al meglio" (se la rete le blocca l'installazione non fallisce)
const EXTERNAL = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    const rt = await caches.open(RUNTIME_CACHE);
    await Promise.all(EXTERNAL.map(async u => {
      try { const r = await fetch(u, { mode: 'no-cors' }); await rt.put(u, r); } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('easylogger-shell-') && k !== SHELL_CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // API, reset password e service worker: sempre rete, mai cache
  if (sameOrigin && /\/(api|reset|sw)\.php$/.test(url.pathname)) return;

  // Pagina dell'app: prima la rete (versione aggiornata), offline la copia in cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL_CACHE)).put('./', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./', { cacheName: SHELL_CACHE })) || Response.error();
      }
    })());
    return;
  }

  // Asset dell'app (URL versionate): prima la cache
  if (sameOrigin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) (await caches.open(RUNTIME_CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // CDN e font: cache + aggiornamento in background (stale-while-revalidate)
  if (/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
