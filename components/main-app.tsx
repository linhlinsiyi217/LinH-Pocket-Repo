"use client";

import { useEffect, useRef, useState } from "react";

import { AccountGate } from "@/components/auth/account-gate";
import { BootSplash } from "@/components/boot-splash";
import { CloudBackupScheduler } from "@/components/cloud-backup-scheduler";
import IOSKoreanLockScreen from "@/components/ios-korean-lock-screen";
import { PasscodeScreen } from "@/components/passcode-screen";
import { RealityBridgeScheduler } from "@/components/reality-bridge-scheduler";
import { MediaMaintenanceScheduler } from "@/components/media-maintenance-scheduler";
import { ThemeAccentStyle } from "@/components/theme-accent-style";
import { AppearanceBridgeProvider } from "@/components/appearance-bridge-provider";
import { DesktopShell } from "./desktop-shell";
import { OfflinePushRevampAnnouncement } from "./offline-push-revamp-announcement";
import { UpdateNotice } from "./update-notice";
import { UpdateCompleteToast } from "./update-complete-toast";
import { useViewportVh } from "@/lib/use-viewport-vh";
import { MusicProvider } from "@/lib/music-context";
import { hydrateKvDb, isKvHydrated } from "@/lib/kv-db";
import { getThemeAssetMap, readThemeProfile } from "@/lib/theme-storage";
import { resolveActiveIconSkins, type ThemeProfile } from "@/lib/theme-types";
import { hasPendingMcpOAuthCallback } from "@/lib/tool-executor";
import { isPasscodeEnabled, LOCK_RELOCK_GRACE_MS } from "@/lib/passcode-service";

const TEXT = {
  loading: "\u52A0\u8F7D\u4E2D...",
};

const BUILTIN_FONT_URLS = [
  "/fonts/huiwen.woff2",
  "/fonts/huiwen.woff2",
  "/fonts/special-elite.woff2",
  "/fonts/splash/instrument-serif-regular-400.woff2",
  "/fonts/splash/instrument-serif-italic-400.woff2",
  "/fonts/splash/inter-300.woff2",
  "/fonts/splash/inter-400.woff2",
  "/fonts/splash/inter-500.woff2",
  "/fonts/splash/major-mono-display-400.woff2",
  "/fonts/splash/jetbrains-mono-300.woff2",
  "/fonts/splash/jetbrains-mono-400.woff2",
  "/fonts/interview/noto-serif-sc.woff2",
  "/fonts/interview/bodoni-moda.woff2",
  "/fonts/interview/bodoni-moda-italic.woff2",
  "/fonts/interview/eb-garamond.woff2",
  "/fonts/interview/eb-garamond-italic.woff2",
  "/fonts/interview/long-cang.woff2",
  "/fonts/interview/cinzel.woff2",
  "/fonts/interview/press-start-2p.woff2",
  "/fonts/notewall/ximai.woff2",
  "/fonts/notewall/xiaozhitiao.woff2",
  "/fonts/notewall/huiwen-upload.woff2",
  "/fonts/notewall/chen-yuluoyan-thin.woff2",
  "/fonts/game-hall/fredoka-400.woff2",
  "/fonts/game-hall/fredoka-500.woff2",
  "/fonts/game-hall/fredoka-600.woff2",
  "/fonts/game-hall/fredoka-700.woff2",
  "/fonts/game-hall/caveat-500.woff2",
  "/fonts/game-hall/caveat-700.woff2",
  "/fonts/game-hall/zen-maru-gothic-500.woff2",
  "/fonts/game-hall/zen-maru-gothic-700.woff2",
  "/fonts/game-hall/zen-maru-gothic-900.woff2",
  "/fonts/\u5B57\u4F53/MISANS-REGULAR.woff2",
  "/fonts/\u5B57\u4F53/MISANS-MEDIUM.woff2",
  "/fonts/\u5B57\u4F53/MISANS-SEMIBOLD.woff2",
] as const;

const BUILTIN_FONT_LOAD_SPECS = [
  '400 1em "Instrument Serif"',
  'italic 400 1em "Instrument Serif"',
  '300 1em "Inter"',
  '400 1em "Inter"',
  '500 1em "Inter"',
  '400 1em "Major Mono Display"',
  '300 1em "JetBrains Mono"',
  '400 1em "JetBrains Mono"',
  '400 1em "Huiwen"',
  '400 1em "Noto Serif SC"',
  '400 1em "Source Han Serif SC"',
  '400 1em "Bodoni Moda"',
  'italic 400 1em "Bodoni Moda"',
  '400 1em "EB Garamond"',
  'italic 400 1em "EB Garamond"',
  '400 1em "Long Cang"',
  '400 1em "Cinzel"',
  '400 1em "Press Start 2P"',
  '400 1em "Special Elite"',
  '400 1em "NoteWall Ximai"',
  '400 1em "NoteWall Xiaozhitiao"',
  '400 1em "NoteWall Huiwen"',
  '400 1em "Game Hall Fredoka"',
  '500 1em "Game Hall Fredoka"',
  '600 1em "Game Hall Fredoka"',
  '700 1em "Game Hall Fredoka"',
  '500 1em "Game Hall Caveat"',
  '700 1em "Game Hall Caveat"',
  '500 1em "Game Hall Zen Maru Gothic"',
  '700 1em "Game Hall Zen Maru Gothic"',
  '900 1em "Game Hall Zen Maru Gothic"',
  '400 1em "MiSans"',
  '500 1em "MiSans"',
  '600 1em "MiSans"',
] as const;

const FONT_CACHE_BATCH_SIZE = 3;
const FONT_CACHE_BATCH_DELAY_MS = 80;

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadlineLike) => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleIdleTask(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => { };
  }

  const idleWindow = window as WindowWithIdleCallback;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => callback(), { timeout: 2400 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 600);
  return () => window.clearTimeout(handle);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function cacheFontUrl(url: string): Promise<void> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) return;
  await response.arrayBuffer();
}

async function warmBuiltinFonts(shouldStop: () => boolean): Promise<void> {
  if (typeof window === "undefined") return;

  for (let index = 0; index < BUILTIN_FONT_URLS.length; index += FONT_CACHE_BATCH_SIZE) {
    if (shouldStop()) return;
    const batch = BUILTIN_FONT_URLS.slice(index, index + FONT_CACHE_BATCH_SIZE);
    await Promise.all(batch.map((url) => cacheFontUrl(url).catch(() => undefined)));
    if (shouldStop()) return;
    await wait(FONT_CACHE_BATCH_DELAY_MS);
  }

  if (shouldStop() || !document.fonts) return;
  await Promise.all(BUILTIN_FONT_LOAD_SPECS.map((spec) => document.fonts.load(spec).catch(() => [])));
}

type BootPhase = "boot" | "locked" | "passcode" | "home";

type PreparedDesktopTheme = {
  profile: ThemeProfile;
  assets: Record<string, string>;
};

function collectFirstPaintThemeAssetIds(profile: ThemeProfile): string[] {
  const ids = [
    profile.wallpaperAssetId,
    profile.fontAssetId,
    profile.dockSkinAssetId,
    ...Object.values(resolveActiveIconSkins(profile))
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(ids));
}

function preloadImageDataUrl(url: string): Promise<void> {
  if (typeof window === "undefined" || !url.startsWith("data:image/")) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const image = new Image();
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (typeof image.decode === "function") {
        void image.decode().catch(() => undefined).finally(resolve);
        return;
      }
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
    if (image.complete) {
      finish();
    }
  });
}

async function prepareDesktopThemeForFirstPaint(): Promise<PreparedDesktopTheme> {
  const profile = readThemeProfile();
  const assetIds = collectFirstPaintThemeAssetIds(profile);
  const assets = assetIds.length ? await getThemeAssetMap(assetIds) : {};
  await Promise.all(Object.values(assets).map(preloadImageDataUrl));
  return { profile, assets };
}

export function MainApp() {
  // 全面屏动态视口：visualViewport 实时写入 --vh，禁止任何硬编码状态栏高度
  useViewportVh();
  const [preparedDesktopTheme, setPreparedDesktopTheme] = useState<PreparedDesktopTheme | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<BootPhase>("boot");
  const [kvHydrateFailed, setKvHydrateFailed] = useState(false);
  const [initAttempt, setInitAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // 申请持久化存储：批准后 iOS/安卓不会再因存储压力擅自回收 IndexedDB
    // （摊主钥匙、聊天记录等都存在里面）。静默尽力而为，被拒也无碍。
    void navigator.storage?.persist?.().catch(() => {});

    void (async () => {
      await hydrateKvDb();
      if (cancelled) return;
      // 水合失败绝不放行：此时所有 KV 数据（设置/绑定/线下记录等）在内存里都是
      // 空的，进入后任何一次保存都会拿空数据整包覆盖 IndexedDB 里的真实历史。
      if (!isKvHydrated()) {
        setKvHydrateFailed(true);
        return;
      }
      setKvHydrateFailed(false);

      let nextPreparedTheme: PreparedDesktopTheme | null = null;
      try {
        nextPreparedTheme = await prepareDesktopThemeForFirstPaint();
      } catch (error) {
        console.warn("[MainApp] desktop theme preload failed:", error);
      }

      if (cancelled) return;
      setPreparedDesktopTheme(nextPreparedTheme);
      setHydrated(true);
    })();

    // 全屏策略以 PWA 为准（manifest display:fullscreen）：
    // 已安装到桌面的应用启动即沉浸，不在页面加载/点击/路由变化时反复调用
    // requestFullscreen()，避免 Android Chrome 反复弹出全屏说明条。
    return () => {
      cancelled = true;
    };
  }, [initAttempt]);

  // 后台重锁：记录隐藏时刻，回来时若离开超过宽限期则重新进入锁屏。
  // 30 秒以内切回来保持现状（LOCK_RELOCK_GRACE_MS 集中配置）。
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current === null) return;
      const awayMs = Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (awayMs > LOCK_RELOCK_GRACE_MS) {
        setPhase((current) => (current === "boot" ? current : "locked"));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  if (kvHydrateFailed) {
    return (
      <main className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "0 28px", background: "#0c0c12", color: "#e8e8ef" }}>
        <div style={{ maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>本机数据暂时读取失败</div>
          <div style={{ fontSize: 13, lineHeight: 1.8, opacity: 0.75, marginBottom: 20 }}>
            浏览器的本地数据库（IndexedDB）没能打开。数据本身还在，为了避免在读不到数据的状态下继续使用把历史记录覆盖掉，应用先暂停进入。
            <br />可以先重试；仍然不行的话，试试关掉本站的其他标签页、重启浏览器，或确认没有开无痕/隐私模式。
          </div>
          <button
            type="button"
            onClick={() => { setKvHydrateFailed(false); setInitAttempt((n) => n + 1); }}
            style={{ padding: "10px 32px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  return (
    <AccountGate>
      {/* 统一主色 token：首帧即生效，锁屏/密码页（phone-shell 之外）也能取到 */}
      <ThemeAccentStyle />
      {/* v0.8.0 Appearance Bridge：data-color-mode 唯一写入点 + 全局外观变量 */}
      <AppearanceBridgeProvider />
      {phase === "boot" && (
        <BootSplash onFinish={() => setPhase(hasPendingMcpOAuthCallback() ? "home" : "locked")} />
      )}
      {phase === "locked" && (
        <IOSKoreanLockScreen
          onUnlock={() => setPhase(isPasscodeEnabled() ? "passcode" : "home")}
        />
      )}
      {phase === "passcode" && (
        <PasscodeScreen
          onSuccess={() => setPhase("home")}
          onCancel={() => setPhase("locked")}
        />
      )}
      {phase === "home" && (
        hydrated ? (
          <main className="app-root">
            <MusicProvider>
              <DesktopShell
                initialThemeProfile={preparedDesktopTheme?.profile}
                initialThemeAssets={preparedDesktopTheme?.assets}
              />
              <OfflinePushRevampAnnouncement />
              <UpdateNotice />
              <UpdateCompleteToast />
              <CloudBackupScheduler />
              <RealityBridgeScheduler />
              <MediaMaintenanceScheduler />
            </MusicProvider>
          </main>
        ) : (
          <main className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(var(--vh, 1dvh) * 100)", background: "var(--c-page-body-bg, #f8f7f2)" }}>
            <span className="home-prepare-dot" aria-label={TEXT.loading} />
          </main>
        )
      )}
    </AccountGate>
  );
}
