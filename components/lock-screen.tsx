"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 仿 iOS 极简锁屏（PROJECT_RULES.md 三-2）：
 * 超大纤细时钟 + 中文日期，手指按住向上滑动跟手上移，越过阈值弹性解锁，
 * 未越过则带回弹地归位。解锁后平滑过渡到主页。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const UNLOCK_DURATION_MS = 460;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export function LockScreen({ onUnlock }: { onUnlock?: () => void }) {
  const [now, setNow] = useState<Date | null>(null);
  const [dragY, setDragY] = useState(0);
  const [settling, setSettling] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (unlocking) return;
    draggingRef.current = true;
    startYRef.current = event.clientY;
    setSettling(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || startYRef.current === null) return;
    // 只允许向上拖，向下不产生位移
    setDragY(Math.min(0, event.clientY - startYRef.current));
  };

  const finishDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startYRef.current = null;
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const threshold = Math.min(150, height * 0.18);
    if (dragY <= -threshold) {
      setUnlocking(true);
      try {
        navigator.vibrate?.(12);
      } catch {
        // 不支持震动时忽略
      }
      window.setTimeout(() => onUnlock?.(), UNLOCK_DURATION_MS);
    } else {
      setSettling(true);
      window.setTimeout(() => {
        setDragY(0);
        setSettling(false);
      }, 20);
    }
  };

  const timeText = now ? `${now.getHours()}:${pad2(now.getMinutes())}` : "--:--";
  const dateText = now
    ? `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`
    : "";

  const layerStyle: React.CSSProperties = unlocking
    ? {
        transform: "translate3d(0, -104%, 0)",
        opacity: 0.4,
        transition: `transform ${UNLOCK_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${UNLOCK_DURATION_MS}ms ease`,
      }
    : {
        transform: `translate3d(0, ${dragY}px, 0)`,
        opacity: Math.max(0.25, 1 + dragY / 520),
        transition: settling
          ? "transform 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease"
          : "none",
      };

  return (
    <main className="app-root splash-root">
      <section className="phone-shell-wrap splash-shell-wrap">
        <div className="phone-case">
          <div className="phone-frame">
            <div
              className="phone-shell splash-phone-screen lock-screen-shell"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <div className="lock-screen-vignette" aria-hidden />
              <div className="lock-screen-layer" style={layerStyle}>
                <div className="lock-screen-status">
                  <span className="lock-screen-signal" aria-hidden>
                    <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                      <rect x="0" y="8" width="3" height="4" rx="1" fill="rgba(255,255,255,0.92)" />
                      <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="rgba(255,255,255,0.92)" />
                      <rect x="10" y="2.8" width="3" height="9.2" rx="1" fill="rgba(255,255,255,0.92)" />
                      <rect x="15" y="0.3" width="3" height="11.7" rx="1" fill="rgba(255,255,255,0.92)" />
                    </svg>
                  </span>
                  <span className="lock-screen-battery" aria-hidden>
                    <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
                      <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                      <rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="rgba(255,255,255,0.92)" />
                      <path d="M24.5 4.5v4c1-.25 1.5-1 1.5-2s-.5-1.75-1.5-2z" fill="rgba(255,255,255,0.55)" />
                    </svg>
                  </span>
                </div>

                <div className="lock-screen-center">
                  <div className="lock-screen-lock" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" />
                      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="lock-screen-date">{dateText}</div>
                  <div className="lock-screen-clock">{timeText}</div>
                </div>

                <div className="lock-screen-bottom">
                  <div className="lock-screen-hint" aria-hidden>
                    <span className={`lock-screen-chevron ${dragY < 0 ? "lock-screen-chevron-dragged" : ""}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M6 14l6-6 6 6" stroke="rgba(255,255,255,0.92)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="lock-screen-hint-text">向上滑动解锁</span>
                  </div>
                  <span className="lock-screen-home-indicator" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
