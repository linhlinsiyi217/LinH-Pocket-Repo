"use client";

import { useEffect, useState } from "react";

/**
 * LinH Pocket 专属开屏动画（PROJECT_RULES.md 三-1）：
 * 纯黑底 + 中心玻璃质感 Logo 呼吸发光，发丝线光环展开、品牌名淡入，
 * 约 2.4 秒后自动淡出并回调，无需用户点击。
 */

const BOOT_HOLD_MS = 2150;
const BOOT_EXIT_MS = 320;

export function BootSplash({ onFinish }: { onFinish?: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLeaving(true), BOOT_HOLD_MS);
    const finishTimer = window.setTimeout(() => onFinish?.(), BOOT_HOLD_MS + BOOT_EXIT_MS);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <main className="app-root splash-root">
      <section className="phone-shell-wrap splash-shell-wrap" aria-label="LinH Pocket">
        <div className="phone-case">
          <div className="phone-frame">
            <div className="phone-shell splash-phone-screen boot-splash-shell">
              <div className={leaving ? "boot-splash boot-splash-leaving" : "boot-splash"}>
                <div className="boot-splash-glow" aria-hidden />
                <div className="boot-splash-logo" aria-hidden>
                  <span className="boot-splash-ring boot-splash-ring-1" />
                  <span className="boot-splash-ring boot-splash-ring-2" />
                  <span className="boot-splash-mark">
                    <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
                      <path
                        d="M14 34V15.5c0-1.1.9-2 2-2h11.2c4.6 0 8 3 8 7.2 0 4.3-3.4 7.3-8 7.3H19.5V34"
                        stroke="rgba(255,255,255,0.96)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="34.5" cy="15.5" r="2.1" fill="rgba(255,255,255,0.96)" />
                    </svg>
                  </span>
                </div>
                <div className="boot-splash-word">
                  <span className="boot-splash-name">LinH Pocket</span>
                  <span className="boot-splash-tagline">POCKET&nbsp;&nbsp;·&nbsp;&nbsp;AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
