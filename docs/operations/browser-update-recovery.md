# Legacy browser update recovery

The previous PWA can continue serving cached Google-only login pages even after
the server has deployed the native tenant and operator forms. The browser source
in the observed incident referenced `index-DgOWv5Wv.js` and `registerSW.js`.
Bypassing its service worker immediately revealed the current form.

Production now serves a retirement worker at the original `/sw.js` URL, before
static files, sessions, and the SPA fallback. Its JavaScript response has
`Cache-Control: no-store`; previously that URL returned the SPA's HTML, which
cannot install as an updated worker. The replacement activates without waiting,
claims existing clients, and unregisters its own registration. It has no fetch
handler. Keep this endpoint available long term for infrequent returning users.

The compatibility `/registerSW.js` script updates only an existing root-scoped
`/sw.js` registration. It does not register a worker in fresh browsers or change
unrelated registrations. Current HTML does not load that compatibility script.

Recovery depends on the browser checking for the worker update while online.
It is not an immediate push to every dormant installation. After that check,
the user's next ordinary navigation or refresh fetches the current app. Existing
tabs are not forcibly reloaded, to protect unsaved work. CacheStorage, cookies,
localStorage, and IndexedDB are preserved; account passwords are unchanged.

Customer support: ask the user to save any work, stay online, and refresh/reopen
the site. They should not need Developer Tools or to clear all browsing data.
If the problem persists, collect the URL and the loaded entry-script filename
before assuming a cache issue. Offline clients cannot download the replacement.

Regression: build the server, then run
`node scripts/service-worker-recovery-smoke.mjs`. The fixture uses a disposable
local HTTP origin and a synthetic old PWA; it never contacts the production
database or modifies a customer's browser.
