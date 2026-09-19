// ─────────────────────────────────────────────────────────────
// PWA Service Worker —— 版本 / 更新 / 接管策略（Task 4.5 / 4.5.1）
//
// 【bump 规则】以下任一情况必须把 CACHE_VERSION 数字 +1（v14 → v15 …）：
//   1. 正式发版（Vercel 生产构建）；
//   2. 本文件缓存策略（预缓存清单 / 导航策略 / 静态策略）发生变更。
//
// 【版本保留（4.5.1 核心策略）】activate 只删除「当前代 −2 及更老」的缓存，
//   始终保留当前代 + 上一代（最多两代，不永久堆积）。原因：skipWaiting +
//   clients.claim 会让新 SW 立即接管仍在运行旧 bundle 的旧 document，
//   旧页面此后仍可能懒加载旧 hash chunk —— 若 activate 立即删上一代缓存，
//   这些请求会落到网络，而旧 hash 已随部署从服务器消失 → ChunkLoadError。
//   保留上一代后，旧页面请求经全局 caches.match 在上一代缓存命中，
//   从根上消除「旧 document + 新 SW + 旧缓存已删」的瞬时错配。
//
// 【install 关键性】"/" 快照是离线冷启动的最小 App Shell，属关键资源：
//   重试仍失败则本次 install 失败（浏览器稍后自动重试，旧 SW 继续服务，
//   不会出现「假成功」的残缺离线壳）；manifest/图标为可选资源，允许失败。
//
// 绝不触碰 IndexedDB / localStorage / sessionStorage（用户数据零清理）。
// ─────────────────────────────────────────────────────────────
const CACHE_VERSION = "ai-phone-pwa-v17";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 关键资源：离线 App Shell（失败 → install 失败，交还旧 SW，稍后自动重试）
const PRECACHE_CRITICAL_URLS = ["/"];
// 可选资源：PWA 元数据与图标（失败不阻断升级）
const PRECACHE_OPTIONAL_URLS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// 关键资源预缓存：cache:"reload" 绕过 HTTP 缓存确保拿到当前部署的 HTML；
// 每项最多重试 2 次，仍失败则抛错让 install 整体失败。
async function precacheCritical(cache) {
  for (const url of PRECACHE_CRITICAL_URLS) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
  }
}

// 导航网络超时：超过该时长且本地有可用快照时先回落快照，避免弱网长挂起；
// 本地没有快照时继续等待真实网络（不中断请求）。
const NAVIGATION_TIMEOUT_MS = 4500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      // 关键资源用 Promise.all（失败 → install 失败，旧 SW 继续服务）；
      // 可选资源用 Promise.allSettled（单项失败不阻断新 SW install → activate）。
      .then((cache) => Promise.all([
        precacheCritical(cache),
        Promise.allSettled(
          PRECACHE_OPTIONAL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" })))
        ),
      ]))
      .then(() => self.skipWaiting())
  );
});

// 允许客户端在「等待中 SW」场景主动推进（updatefound waiting 分支的兜底）。
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING" || (data && data.type === "SKIP_WAITING")) {
    self.skipWaiting();
  }
});

// 从缓存名解析代数：ai-phone-pwa-v13-static → 13；也兼容裸版本号
// ai-phone-pwa-v13（activate 传 CACHE_VERSION 时命中此形态，4.5.1 round 2
// 实测发现：旧正则要求尾随 "-"，导致当前代解析为 NaN、activate 永不清缓存）。
// 非本项目管理的缓存返回 NaN。
function cacheGenerationOf(key) {
  const match = key.match(/^ai-phone-pwa-v(\d+)(?:$|-)/);
  return match ? Number(match[1]) : NaN;
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // 只淘汰「当前代 −2 及更老」的缓存：保留上一代供仍在运行的旧 document
    // 懒加载旧 hash chunk 命中（详见文件头【版本保留】）；下下次升级时自然淘汰，
    // 最多同时存在两代，不永久堆积。非本项目命名的缓存一律不动。
    caches.keys()
      .then((keys) => {
        const currentGeneration = cacheGenerationOf(CACHE_VERSION);
        return Promise.all(
          keys
            .filter((key) => {
              const generation = cacheGenerationOf(key);
              return !Number.isNaN(generation) && generation < currentGeneration - 1;
            })
            .map((key) => caches.delete(key))
        );
      })
      // 刷新预缓存的 "/" 快照：它是离线导航的最终兜底，若停留在旧部署版本，
      // 引用的旧 hash CSS/JS 已 404，会渲染出无样式页面。失败（离线）则保留
      // install 阶段刚拿到的快照。
      .then(() => caches.open(STATIC_CACHE))
      .then((cache) => cache.add(new Request("/", { cache: "reload" })).catch(() => {}))
      .then(() => self.clients.claim())
  );
});

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return ["font", "image", "script", "style", "worker"].includes(request.destination);
}

// 导航回退链：精确请求（带 query 也只按 pathname 存）→ "/" 快照（任意缓存）。
async function matchNavigationFallback(cache, request) {
  const pathname = new URL(request.url).pathname;
  const cached =
    (await cache.match(request)) ||
    (await cache.match(pathname)) ||
    (await caches.match("/"));
  return cached || null;
}

// 导航：network-first（在线绝不返回旧 HTML，跨构建版本不复用快照）。
// - 网络成功：以 pathname 为键写入运行时缓存（剥离 query，避免每个 ?v= 留一份）。
// - 网络超时但本地有快照：先给快照；无快照则继续等网络。
// - 网络错误（离线）：回退缓存 "/"。
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const networkRequest = new Request(request, { cache: "no-cache" });
  const fetchPromise = fetch(networkRequest).then((response) => {
    if (response.ok) {
      const key = new Request(new URL(request.url).pathname);
      cache.put(key, response.clone()).catch(() => {});
    }
    return response;
  });

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
  });

  let response = null;
  try {
    response = await Promise.race([fetchPromise, timeout]);
  } catch {
    response = null;
  }
  if (response) return response;

  const cached = await matchNavigationFallback(cache, request);
  if (cached) return cached;
  // 超时且无快照：继续等真实网络；若网络已失败这里会抛错，交由浏览器处理。
  return fetchPromise;
}

// 静态资源（字体/图片/脚本/样式/模型）用 cache-first：命中缓存直接返回，
// 不再每次都在后台把整份文件重新拉一遍校验。字体动辄 7~24MB，旧的
// stale-while-revalidate 会持续重下，是带宽爆掉的主因之一。
// `_next/static` 内为内容 hash 不可变文件，天然适配 cache-first；
// 需要更新缓存内容时，升 CACHE_VERSION 即可让旧缓存在 activate 时清空。
// 未命中且网络失败（旧 hash 已随部署淘汰）→ 由客户端 ChunkLoadError
// 一次性 reload 策略兜底（见 components/pwa-registrar.tsx），不让用户白屏。
async function cacheFirst(request) {
  // 全局匹配（当前代 + 保留的上一代）：新 SW 接管旧 document 后，旧页面
  // 懒加载的旧 hash chunk 在当前代必然未命中，命中点在上一代缓存 ——
  // 这是消除「升级窗口跨版本 ChunkLoadError」的关键路径。
  const cached = await caches.match(request);
  if (cached) return cached;
  // 兼容旧版本以剥离 query 的 pathname 为键写入的运行时条目
  const cachedLoose = await caches.match(request, { ignoreSearch: true });
  if (cachedLoose) return cachedLoose;
  const cache = await caches.open(RUNTIME_CACHE);
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// 离线推送：App 被杀后由系统唤起 SW 弹通知。payload 由服务端 JSON 编码。
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const declarative = data.web_push === 8030 && data.notification && typeof data.notification === "object"
    ? data.notification
    : null;
  const notificationData = declarative && declarative.data && typeof declarative.data === "object"
    ? data.notification
    : data;
  const title = (declarative && declarative.title) || data.title || "小手机";
  event.waitUntil((async () => {
    if (notificationData.type === "chat_outbox") {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.filter((client) => client.visibilityState === "visible");
      if (visible.length > 0) {
        visible.forEach((client) => client.postMessage({ type: "push_outbox_ready" }));
        return;
      }
    }
    // 来电推送：页面可见时直接进页面振铃（来电横幅），不弹系统通知
    if (notificationData.type === "incoming_call") {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.filter((client) => client.visibilityState === "visible");
      if (visible.length > 0) {
        visible.forEach((client) => client.postMessage({
          type: "incoming_call_push",
          sessionId: notificationData.sessionId || "",
          callTs: notificationData.callTs || 0,
        }));
        visible.forEach((client) => client.postMessage({ type: "push_outbox_ready" }));
        return;
      }
    }
    await self.registration.showNotification(title, {
      body: (declarative && declarative.body) || data.body || "",
      icon: (declarative && declarative.icon) || data.icon || "/icon-192.png",
      badge: (declarative && declarative.badge) || "/icon-192.png",
      tag: (declarative && declarative.tag) || data.tag || `push-${Date.now()}`,
      data: {
        url: (declarative && declarative.navigate) || notificationData.url || "/",
        type: notificationData.type || "",
        commandId: notificationData.commandId || "",
        sessionId: notificationData.sessionId || "",
        callTs: notificationData.callTs || 0,
      },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || "/";
  if (notificationData.type === "shortcut_command") {
    // iOS silently ignores custom URL schemes passed to clients.openWindow().
    event.waitUntil((async () => {
      const absoluteUrl = new URL(targetUrl, self.location.origin).href;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // 有活窗口：不导航（navigate 会杀掉 SPA，回来一片空白、进行中的生成全断）。
      // 交给页面自己 location 到 /shortcut-run——302 到 shortcuts:// 属于外部 App
      // 启动，WebKit 不会卸载当前页面，聊天界面与本地生成原地保留。
      for (const client of windows) {
        if ("focus" in client) {
          client.postMessage({ type: "run_shortcut", url: absoluteUrl });
          return client.focus();
        }
      }
      // App 已被杀：没有页面可保，开新窗口走 /shortcut-run 跳转
      return self.clients.openWindow(absoluteUrl);
    })());
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (notificationData.type === "chat_outbox") {
            client.postMessage({ type: "push_outbox_ready" });
          }
          if (notificationData.type === "incoming_call") {
            // 有活窗口：不导航（会杀掉 SPA），交给页面弹来电横幅 + 合并 outbox
            client.postMessage({
              type: "incoming_call_push",
              sessionId: notificationData.sessionId || "",
              callTs: notificationData.callTs || 0,
            });
            client.postMessage({ type: "push_outbox_ready" });
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isCacheableRequest(request)) {
    event.respondWith(cacheFirst(request));
  }
});
