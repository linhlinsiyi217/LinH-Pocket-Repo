"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BatteryFull,
  Camera,
  Flashlight,
  Heart,
  Leaf,
  LockKeyhole,
  Cloud,
  Flower2,
} from "lucide-react";

/**
 * iOS 韩系玻璃拟态锁屏（外部设计稿原样保留，业务逻辑未改动）。
 *
 * 仅做了 3 处 Next.js 集成所必需的最小适配：
 * 1. 顶部 "use client"（App Router 客户端组件要求）；
 * 2. 新增可选 onUnlock 回调：上滑达到阈值时触发，main-app 据此切到主页；
 *    组件内部原有 unlocked 状态/“Lock again”逻辑保持原样；
 * 3. 给最外层 main、手机卡片及几个安全区关键节点加了纯样式标记类
 *    （ios-lock-*），供 CSS 在真机上做全屏铺满与 safe-area 内容避让，
 *    不改变任何交互逻辑。
 */
export default function IOSKoreanLockScreen({ onUnlock }: { onUnlock?: () => void }) {
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [cameraPressed, setCameraPressed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [pressedNotification, setPressedNotification] = useState<number | null>(
    null
  );

  const startY = useRef<number | null>(null);

  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;

    const delta = e.clientY - startY.current;

    if (delta < 0) {
      setDragY(Math.max(delta, -180));
    }
  };

  const handlePointerUp = () => {
    if (dragY < -95) {
      setUnlocked(true);
      // 集成点：通知宿主（main-app）进入主页。宿主会立即卸载锁屏，
      // 因此内部 “Unlocked / Lock again” 画面在真机流程中不会出现。
      onUnlock?.();
    }

    setDragY(0);
    startY.current = null;
  };

  if (unlocked) {
    return (
      <main className="min-h-screen ios-lock-unlocked bg-neutral-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] bg-white shadow-[0_12px_40px_rgba(0,0,0,.09)]">
            <LockKeyhole className="h-6 w-6 text-neutral-700" />
          </div>

          <h1 className="text-2xl font-medium tracking-[-0.04em] text-neutral-900">
            Unlocked
          </h1>

          <button
            onClick={() => setUnlocked(false)}
            className="mt-6 rounded-full bg-black px-6 py-3 text-sm text-white transition-transform duration-200 active:scale-[0.96]"
          >
            Lock again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="ios-lock-root min-h-screen bg-[#edf0f4] flex items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className="
          ios-lock-card
          relative
          h-[820px]
          w-[390px]
          max-w-full
          overflow-hidden
          rounded-[52px]
          bg-[#e7ebf0]
          shadow-[0_30px_90px_rgba(60,72,90,.22)]
          ring-1
          ring-white/80
          select-none
          touch-none
        "
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateY(${dragY * 0.16}px) scale(${
            dragY < 0 ? 1 + Math.abs(dragY) / 9000 : 1
          })`,
          transition: startY.current === null ? "transform 360ms cubic-bezier(.22,1,.36,1)" : "none",
        }}
      >
        {/* Wallpaper */}
        <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(145deg,#f8fafc_0%,#e9edf2_38%,#d5dbe3_100%)]">
          <div
            className="
              absolute
              -left-[110px]
              top-[110px]
              h-[440px]
              w-[520px]
              rotate-[28deg]
              rounded-[48%]
              bg-gradient-to-br
              from-white/90
              via-white/35
              to-slate-300/35
              shadow-[inset_-20px_-25px_50px_rgba(120,130,145,.15),inset_18px_18px_35px_rgba(255,255,255,.85),0_30px_70px_rgba(120,130,145,.18)]
              blur-[0.2px]
            "
          />

          <div
            className="
              absolute
              -right-[220px]
              top-[340px]
              h-[570px]
              w-[610px]
              rotate-[-34deg]
              rounded-[48%]
              border
              border-white/75
              bg-gradient-to-tr
              from-slate-300/35
              via-white/45
              to-white/90
              shadow-[inset_12px_18px_30px_rgba(255,255,255,.9),inset_-26px_-30px_70px_rgba(122,132,146,.13),0_18px_70px_rgba(102,114,132,.15)]
            "
          />

          <div
            className="
              absolute
              left-[50px]
              top-[430px]
              h-[340px]
              w-[460px]
              rotate-[18deg]
              rounded-[50%]
              border
              border-white/65
              bg-white/15
              shadow-[inset_20px_15px_30px_rgba(255,255,255,.7),0_30px_80px_rgba(100,112,130,.15)]
              backdrop-blur-xl
            "
          />

          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-slate-500/10" />
        </div>

        {/* subtle top haze */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/20 to-transparent" />

        {/* status bar —— 与主界面 desktop-shell 的 phone-status-bar 完全同款
            （相同类名、相同 SVG、相同 CSS 变量；仅外层卡片做安全区偏移） */}
        <header className="phone-status-bar ios-lock-phone-status-bar">
          <span className="status-time">{time}</span>
          <div className="status-island" />
          <div className="status-right" aria-hidden>
            <svg viewBox="0 0 72 51" className="status-signal" fill="currentColor">
              <path d="M11.6,41.9c0,1.4,0,2.8,0,4.3c0,2.3-1.4,3.7-3.6,3.8c-1.5,0.1-3,0.1-4.4,0c-1.9-0.1-3.2-1.2-3.4-3c-0.3-3.4-0.2-6.8,0-10.1c0.1-1.8,1.5-3,3.3-3.1c1.5-0.1,3-0.1,4.4,0c2.2,0.1,3.6,1.5,3.7,3.8C11.6,39,11.6,40.5,11.6,41.9z" />
              <path d="M31.7,36.9c0,2.8,0,5.7,0,8.5c0,3.5-1.1,4.6-4.5,4.6c-1.2,0-2.4,0-3.6,0c-2-0.1-3.4-1.5-3.4-3.4c-0.1-6.5-0.1-13,0-19.6c0-1.9,1.6-3.4,3.6-3.5c1.4-0.1,2.7,0,4.1,0c2.3,0.1,3.8,1.4,3.8,3.8C31.8,30.5,31.7,33.7,31.7,36.9z" />
              <path d="M40.4,30.3c0-5,0-10.1,0-15.1c0-3,1.2-4.2,4.2-4.2c1,0,2,0,3,0c2.9,0,4.2,1.4,4.2,4.2c0,9,0,17.9,0,26.9c0,1.4,0,2.7,0,4.1c0,2.3-1.4,3.8-3.7,3.8c-1.3,0-2.6,0-3.9,0c-2.5-0.1-3.8-1.3-3.8-3.9C40.4,40.9,40.4,35.6,40.4,30.3z" />
              <path d="M72,25.7c0,6.6,0,13.3,0,19.9c0,3.2-1.2,4.4-4.4,4.4c-1.1,0-2.3,0-3.4,0c-2.3-0.1-3.7-1.4-3.8-3.8c0-2.9,0-5.8,0-8.7c0-10.6,0-21.2,0-31.8c0-3.3,1.2-4.5,4.5-4.5c0.9,0,1.8,0,2.7,0c3.1,0,4.4,1.3,4.4,4.5C72,12.3,72,19,72,25.7z" />
            </svg>
            <svg viewBox="98 0 67 51" className="status-wifi" fill="currentColor">
              <path d="M134.6,0c9.8,0.1,20.4,4.8,29.2,13.7c1.6,1.6,1.6,2.1,0,3.8c-0.8,0.8-1.6,1.6-2.3,2.5c-1.1,1.3-2.1,1.2-3.3,0c-3.5-3.7-7.6-6.5-12.3-8.6c-13-5.6-28.3-2.7-38.7,7.3c-0.5,0.5-0.9,0.9-1.4,1.4c-1,1.1-2,1.1-3-0.1c-0.9-1.1-2-2-3-3.1c-0.9-0.9-0.9-1.8,0-2.8C107.7,5.4,119.9,0,134.6,0z" />
              <path d="M132.1,13.9c8.9,0.2,16.5,3.5,22.8,9.8c1.1,1.1,1.1,2.1,0,3.2c-0.9,0.9-1.8,1.9-2.7,2.8c-1.1,1.2-2,1.1-3.1,0c-3.9-3.9-8.6-6.3-14.1-6.9c-7.5-0.9-13.9,1.5-19.4,6.5c-1.9,1.8-2.1,1.8-3.9,0c-0.8-0.8-1.6-1.7-2.5-2.6c-1.1-1-1-2,0-3C115.5,17.5,123.1,14.1,132.1,13.9z" />
              <path d="M131.9,27.8c5.4,0.1,9.8,2,13.6,5.5c1.1,1,1.2,2,0.1,3c-0.9,0.9-1.9,1.8-2.7,2.8c-1.1,1.4-2.1,1.3-3.4,0.2c-3.6-3-7.7-3.7-12.1-1.9c-1.3,0.5-2.4,1.3-3.4,2.2c-0.9,0.8-1.8,0.9-2.6-0.1c-1.1-1.1-2.1-2.2-3.2-3.3c-0.9-1-0.8-1.8,0.1-2.8C122.2,29.8,126.8,27.9,131.9,27.8z" />
              <path d="M132,41.6c1.8,0,3.5,0.5,5,1.6c0.9,0.6,1.1,1.3,0.2,2.2c-1.5,1.5-2.9,2.9-4.4,4.4c-0.7,0.7-1.2,0.6-1.8,0c-1.5-1.6-2.9-3.1-4.4-4.6c-0.7-0.8-0.5-1.3,0.2-1.9C128.4,42.1,130.1,41.5,132,41.6z" />
            </svg>
            <svg viewBox="0 0 26 12" className="status-battery" fill="currentColor">
              <rect x="0.5" y="0.5" width="22" height="11" rx="2.6" fill="none" stroke="currentColor" strokeOpacity="0.42" strokeWidth="1" />
              <rect x="22.7" y="4" width="1.8" height="4" rx="0.7" opacity="0.42" />
              <rect x="2" y="2" width="14" height="8" rx="1.5" />
            </svg>
          </div>
        </header>

        {/* main lock content */}
        <section className="ios-lock-content relative z-10 flex flex-col items-center px-5">
          <p className="mt-[48px] text-[18px] font-medium tracking-[-0.035em] text-[#444953]">
            Thu 1 Jan
          </p>

          <h1
            className="
              mt-[-4px]
              text-[105px]
              font-[250]
              leading-none
              tracking-[-0.08em]
              text-[#565d68]
              drop-shadow-[0_1px_0_rgba(255,255,255,.85)]
            "
          >
            {time}
          </h1>

          {/* widgets */}
          <div className="mt-5 flex w-full justify-center gap-3">
            <GlassCard className="flex h-[78px] w-[172px] items-center px-4">
              <div className="mr-3 grid h-11 w-11 place-items-center rounded-full bg-white/55 shadow-inner">
                <Cloud
                  className="h-7 w-7 fill-white text-white drop-shadow"
                  strokeWidth={1.4}
                />
              </div>

              <div>
                <p className="text-[24px] font-light leading-none text-[#4b515b]">
                  26°
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#585f69]">
                  Partly Cloudy
                </p>
                <p className="text-[10px] text-[#707783]">H:28° L:20°</p>
              </div>
            </GlassCard>

            <GlassCircle>
              <Leaf className="mb-1 h-6 w-6 text-[#606771]" strokeWidth={1.7} />
              <span className="text-[10px] leading-tight text-[#626974]">
                Good
                <br />
                Day
              </span>
            </GlassCircle>

            <GlassCircle>
              <BatteryFull
                className="mb-1 h-6 w-6 text-[#5c636e]"
                strokeWidth={1.8}
              />
              <span className="text-[11px] text-[#626974]">100%</span>
            </GlassCircle>
          </div>
        </section>

        {/* middle phrase */}
        <div className="absolute left-7 top-[410px] z-10 text-[#7a8390]">
          <p className="text-[13px] font-light leading-[1.15] tracking-[0.12em]">
            A
            <br />
            Brighter
            <br />
            Day
            <br />
            Ahead
          </p>

          <div className="mt-4 h-px w-5 bg-[#7c8490]/70" />
        </div>

        {/* notifications */}
        <div className="ios-lock-notifications absolute inset-x-4 bottom-[145px] z-20 space-y-2.5">
          <Notification
            active={pressedNotification === 0}
            onClick={() =>
              setPressedNotification(pressedNotification === 0 ? null : 0)
            }
            icon={
              <Heart
                className="h-5 w-5 fill-[#687487] text-[#687487]"
                strokeWidth={1.5}
              />
            }
            title="LinH Pocket"
            body="A small world in your hand ♡"
            time="now"
          />

          <Notification
            active={pressedNotification === 1}
            onClick={() =>
              setPressedNotification(pressedNotification === 1 ? null : 1)
            }
            icon={
              <Flower2
                className="h-5 w-5 text-[#697893]"
                strokeWidth={1.6}
              />
            }
            title="New Moment"
            body="There's a change in your average walking distance. Keep going!"
            time="1m ago"
          />
        </div>

        {/* bottom buttons */}
        <div className="ios-lock-bottom absolute inset-x-0 bottom-[52px] z-30 flex items-center justify-between px-8">
          <RoundButton
            active={flashlightOn}
            onClick={() => setFlashlightOn((v) => !v)}
            ariaLabel="Toggle flashlight"
          >
            <Flashlight
              className={`h-7 w-7 transition-transform duration-200 ${
                flashlightOn ? "-rotate-12" : ""
              }`}
              strokeWidth={1.8}
            />
          </RoundButton>

          <RoundButton
            active={cameraPressed}
            onClick={() => {
              setCameraPressed(true);
              window.setTimeout(() => setCameraPressed(false), 220);
            }}
            ariaLabel="Open camera"
          >
            <Camera className="h-7 w-7" strokeWidth={1.8} />
          </RoundButton>
        </div>

        {/* swipe text */}
        <div className="ios-lock-swipe absolute bottom-[30px] left-1/2 z-20 -translate-x-1/2 text-center">
          <p
            className="mb-3 whitespace-nowrap text-[11px] text-[#5e6672]/85"
            style={{
              opacity: Math.max(0.15, 1 - Math.abs(dragY) / 120),
            }}
          >
            Swipe up to open
          </p>

          <div
            className="
              mx-auto
              h-[5px]
              w-[135px]
              rounded-full
              bg-white/95
              shadow-[0_1px_5px_rgba(70,80,95,.18)]
            "
          />
        </div>

        {/* flashlight glow */}
        <div
          className={`
            pointer-events-none
            absolute
            inset-0
            z-[5]
            transition-opacity
            duration-300
            ${
              flashlightOn
                ? "opacity-100 bg-[radial-gradient(circle_at_20%_86%,rgba(255,255,255,.9),rgba(255,255,255,.15)_18%,transparent_36%)]"
                : "opacity-0"
            }
          `}
        />
      </div>
    </main>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`
        rounded-[27px]
        border
        border-white/70
        bg-white/28
        shadow-[inset_0_1px_1px_rgba(255,255,255,.85),0_10px_25px_rgba(90,104,124,.10)]
        backdrop-blur-[22px]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

function GlassCircle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        flex
        h-[78px]
        w-[67px]
        flex-col
        items-center
        justify-center
        rounded-full
        border
        border-white/70
        bg-white/24
        text-center
        shadow-[inset_0_1px_1px_rgba(255,255,255,.9),0_10px_25px_rgba(95,105,120,.10)]
        backdrop-blur-[22px]
      "
    >
      {children}
    </div>
  );
}

function RoundButton({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  // 直接使用 Pearl Glass 的圆形玻璃按钮：
  // :active 由设计系统统一给 scale(0.965) 物理回弹；
  // is-active（手电筒开启）变深并带内发光，无需调用任何硬件 API。
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`glass-btn glass-btn--circle ios-lock-round ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

function Notification({
  icon,
  title,
  body,
  time,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  time: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex
        w-full
        items-start
        rounded-[23px]
        border
        px-3
        py-3
        text-left
        backdrop-blur-[28px]
        transition-[transform,background-color,box-shadow]
        duration-200
        ease-out
        active:scale-[0.985]

        ${
          active
            ? `
              border-white/90
              bg-white/62
              shadow-[0_14px_35px_rgba(83,95,112,.16)]
            `
            : `
              border-white/70
              bg-white/44
              shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_9px_24px_rgba(83,95,112,.10)]
            `
        }
      `}
    >
      <div
        className="
          mr-3
          grid
          h-11
          w-11
          shrink-0
          place-items-center
          rounded-[14px]
          border
          border-white/75
          bg-gradient-to-br
          from-white/90
          to-slate-300/65
          shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_5px_12px_rgba(72,86,104,.14)]
        "
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#242932]">
            {title}
          </p>

          <span className="text-[10px] text-[#777f8c]">{time}</span>
        </div>

        <p className="mt-0.5 text-[11px] leading-[1.25] text-[#5e6570]">
          {body}
        </p>
      </div>
    </button>
  );
}
