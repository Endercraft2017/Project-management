import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
const require = createRequire(import.meta.url),
  express = require("express"),
  { chromium } = require("playwright");
const {
  legacyServiceWorkerRoutes,
} = require("../server/dist/delivery/legacy-service-worker.js");
let deployed = false;
const old = `self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open('old-shell');await c.put('/console/login',new Response('<h1>Old Google login</h1>',{headers:{'Content-Type':'text/html'}}));await self.skipWaiting()})()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'&&new URL(e.request.url).pathname==='/console/login')e.respondWith(caches.open('old-shell').then(c=>c.match('/console/login')))});`;
const app = express();
app.use((req, res, next) => {
  if (!deployed && req.path === "/sw.js")
    res.type("js").set("Cache-Control", "no-store").send(old);
  else if (deployed) legacyServiceWorkerRoutes(req, res, next);
  else next();
});
app.get("/other/sw.js", (_q, res) =>
  res
    .type("js")
    .send(
      "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));",
    ),
);
app.get("*", (req, res) =>
  res
    .type("html")
    .send(
      req.path === "/console/login"
        ? "<h1>Operator console</h1>"
        : '<h1>Workspace</h1><input aria-label="Draft">',
    ),
);
const server = createServer(app);
let browser,
  passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  });
  const context = await browser.newContext(),
    page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(base + "/seed");
  await check(
    "cached legacy login overrides the current network HTML",
    async () => {
      await page.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      });
      await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null,
      );
      await page.goto(base + "/console/login");
      await page.getByRole("heading", { name: "Old Google login" }).waitFor();
      await page.reload();
      await page.getByRole("heading", { name: "Old Google login" }).waitFor();
      assert.match(
        await (await context.request.get(base + "/console/login")).text(),
        /Operator console/,
      );
    },
  );
  await page.evaluate(async () => {
    localStorage.setItem("sentinel", "keep-local");
    const c = await caches.open("user-data");
    await c.put("/sentinel", new Response("keep-cache"));
    await new Promise((resolve, reject) => {
      const r = indexedDB.open("sentinel", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("drafts");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result,
          t = db.transaction("drafts", "readwrite");
        t.objectStore("drafts").put("keep-idb", "draft");
        t.oncomplete = () => {
          db.close();
          resolve();
        };
        t.onerror = () => reject(t.error);
      };
    });
    await navigator.serviceWorker.register("/other/sw.js", {
      scope: "/other/",
    });
  });
  await context.addCookies([
    { name: "sentinel", value: "keep-cookie", url: base },
  ]);
  const workspace = await context.newPage();
  await workspace.goto(base + "/app");
  await workspace.getByLabel("Draft").fill("Unsaved task");
  await workspace.evaluate(() => (window.tabSentinel = "alive"));
  let navigations = 0;
  workspace.on("framenavigated", (f) => {
    if (f === workspace.mainFrame()) navigations++;
  });
  deployed = true;
  await check("compiled endpoints return uncached JavaScript", async () => {
    for (const p of ["/sw.js", "/registerSW.js"]) {
      const r = await context.request.get(base + p);
      assert.equal(r.status(), 200);
      assert.match(r.headers()["content-type"], /application\/javascript/);
      assert.equal(r.headers()["cache-control"], "no-store");
      assert.equal(r.headers()["service-worker-allowed"], "/");
      assert.doesNotMatch(await r.text(), /<h1>/);
    }
  });
  await check(
    "update unregisters only root worker without forcing navigation",
    async () => {
      await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration("/");
        if (!r) throw Error("Missing legacy registration");
        await r.update();
      });
      await page.waitForFunction(
        async () => !(await navigator.serviceWorker.getRegistration("/")),
      );
      await page.getByRole("heading", { name: "Old Google login" }).waitFor();
      assert.equal(navigations, 0);
      assert.equal(
        await workspace.getByLabel("Draft").inputValue(),
        "Unsaved task",
      );
      assert.equal(await workspace.evaluate(() => window.tabSentinel), "alive");
      assert(
        (
          await page.evaluate(async () =>
            (await navigator.serviceWorker.getRegistrations()).map(
              (r) => new URL(r.scope).pathname,
            ),
          )
        ).includes("/other/"),
      );
    },
  );
  await check(
    "ordinary reload recovers current login while retaining browser data",
    async () => {
      await page.reload();
      await page.getByRole("heading", { name: "Operator console" }).waitFor();
      const saved = await page.evaluate(async () => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open("sentinel", 1);
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const db = r.result,
              q = db.transaction("drafts").objectStore("drafts").get("draft");
            q.onsuccess = () => {
              resolve(q.result);
              db.close();
            };
            q.onerror = () => reject(q.error);
          };
        });
        return {
          local: localStorage.getItem("sentinel"),
          cache: await (
            await (await caches.open("user-data")).match("/sentinel")
          ).text(),
          idb,
          legacy: (await caches.keys()).includes("old-shell"),
          cookie: document.cookie,
        };
      });
      assert.equal(saved.local, "keep-local");
      assert.equal(saved.cache, "keep-cache");
      assert.equal(saved.idb, "keep-idb");
      assert.equal(saved.legacy, true);
      assert.match(saved.cookie, /sentinel=keep-cookie/);
      await page.reload();
      await page.getByRole("heading", { name: "Operator console" }).waitFor();
      assert.equal(
        await page.evaluate(() => navigator.serviceWorker.controller),
        null,
      );
      await workspace.reload();
      assert.deepEqual(
        await page.evaluate(async () =>
          (await navigator.serviceWorker.getRegistrations()).map(
            (r) => new URL(r.scope).pathname,
          ),
        ),
        ["/other/"],
      );
    },
  );
  await check(
    "fresh browser compatibility script installs no worker",
    async () => {
      const fresh = await browser.newContext(),
        p = await fresh.newPage();
      await p.goto(base + "/console/login");
      await p.evaluate(() => {
        window.registerCalls = 0;
        const original = navigator.serviceWorker.register.bind(
          navigator.serviceWorker,
        );
        navigator.serviceWorker.register = (...args) => {
          window.registerCalls++;
          return original(...args);
        };
      });
      await p.addScriptTag({ url: base + "/registerSW.js" });
      assert.equal(await p.evaluate(() => window.registerCalls), 0);
      assert.equal(
        await p.evaluate(
          async () => (await navigator.serviceWorker.getRegistrations()).length,
        ),
        0,
      );
      await fresh.close();
    },
  );
  await context.close();
  console.log(`${passed} service-worker recovery checks passed`);
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
