import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ChatPluginBootstrap } from "@/components/chat-plugin-bootstrap";
import { ChatReasoningVisibilityController } from "@/components/chat-reasoning-visibility-controller";
import { CSSImportEnhancer } from "@/components/css-import-enhancer";
import { PWAManifestInjector } from "@/components/pwa-manifest-injector";
import { PWARegistrar } from "@/components/pwa-registrar";
import "../styles/fonts.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "float",
  description: "float",
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <meta name="theme-color" content="#f8f7f2" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="float" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* 首帧同步沉浸判定：必须早于 CSS 首绘与 hydration 执行。
            Android 安装 PWA（standalone/fullscreen）默认隐藏模拟状态栏、
            按 env(safe-area-inset-*) 避让刘海，杜绝真实系统栏 + 模拟栏双状态栏；
            iOS 安装 PWA 保留模拟状态栏承接系统区。pwa-manifest-injector 挂载后
            会用同一套规则复核并监听 display-mode/cookie 变化。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var n=navigator||{},ua=n.userAgent||"",mm=function(q){return window.matchMedia&&window.matchMedia(q).matches};var ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&n.maxTouchPoints>1);var d=document.documentElement;d.dataset.mobileOs=ios?"ios":"android";var dm="browser";if(document.fullscreenElement||mm("(display-mode: fullscreen)"))dm="fullscreen";else if(mm("(display-mode: standalone)"))dm="standalone";else if(mm("(display-mode: minimal-ui)"))dm="minimal-ui";else if(n.standalone)dm="standalone";var pref=(document.cookie.match(/(?:^|;\\s*)pwa_display_mode=([^;]+)/)||[])[1];var installed=dm==="standalone"||dm==="fullscreen";if(pref==="standalone"||(installed&&!ios))d.dataset.pwaDisplayMode=dm;}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <PWAManifestInjector />
        <PWARegistrar />
        <CSSImportEnhancer />
        <ChatPluginBootstrap />
        <ChatReasoningVisibilityController />
        {children}
      </body>
    </html>
  );
}
