/* ══════════════════════════════════════════
   外观 · 显示与颜色页（v0.8.0 T5 等价抽离）
   日/夜间模式 + 全局主色调；修改即实时预览，「应用」持久化。
   不触碰 data-icon-effect / data-skinned / data-borders 主题引擎。
   ══════════════════════════════════════════ */
"use client";
import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { ColorPanel } from "@/components/ui/color-panel";
import { normalizeThemeProfile, type ThemeProfile } from "@/lib/theme-types";
import type { AppearanceDraftPageProps } from "./appearance-shared";

/**
 * 主题联动缩略图：直接消费 :root 上的统一 token（与真实 .phone-wallpaper-tint
 * 和 .ios-lock-accent-tint 完全同源），取色器拖动即可看到桌面/锁屏同步变色。
 */
function ThemeSurfaceThumb({ label, variant, isDark }: { label: string; variant: "home" | "lock"; isDark: boolean }) {
  const glow = variant === "home"
    ? "var(--c-accent-tint-glow, rgba(60,130,210,0.16))"
    : "var(--c-lock-tint-glow, rgba(60,130,210,0.18))";
  const wash = variant === "home"
    ? "var(--c-accent-tint, rgba(60,130,210,0.08))"
    : "var(--c-lock-tint, rgba(60,130,210,0.10))";
  const base = isDark
    ? "linear-gradient(160deg,#232328 0%,#101013 100%)"
    : variant === "home"
      ? "linear-gradient(155deg,#f6f9fc 0%,#dde5ee 100%)"
      : "linear-gradient(145deg,#f8fafc 0%,#e3e8ef 55%,#d2d9e2 100%)";
  const background = [
    `radial-gradient(135% 95% at 88% -10%, ${glow} 0%, transparent 58%)`,
    variant === "home"
      ? `radial-gradient(110% 80% at -10% 110%, ${wash} 0%, transparent 60%)`
      : `linear-gradient(165deg, ${wash} 0%, transparent 55%)`,
    base,
  ].join(",");
  const ink = isDark ? "rgba(255,255,255,0.85)" : "#4b515b";
  const glass = isDark
    ? "rgba(255,255,255,0.12) border-white/15"
    : "rgba(255,255,255,0.42) border-white/55";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative h-[118px] w-full overflow-hidden rounded-2xl border border-[var(--c-card-border)]"
        style={{ background }}
      >
        {/* 模拟状态栏 */}
        <div className="absolute inset-x-3 top-2 flex items-center justify-between">
          <span className="text-[8px] font-semibold" style={{ color: ink }}>9:41</span>
          <span className="h-[7px] w-7 rounded-full bg-black/70" />
          <span className="h-[5px] w-5 rounded-[2px]" style={{ border: `1px solid ${ink}`, opacity: 0.55 }} />
        </div>

        {variant === "lock" ? (
          <div className="absolute inset-x-0 top-[24px] flex flex-col items-center">
            <span className="text-[8px] font-medium" style={{ color: ink }}>周四 1月1日</span>
            <span
              className="text-[28px] font-extralight leading-none tracking-tight"
              style={{ color: isDark ? "rgba(255,255,255,0.9)" : "#565d68" }}
            >
              02:20
            </span>
            <div className={`mt-2 flex items-center gap-1.5 rounded-lg border ${glass} px-2 py-1 backdrop-blur-md`}>
              <span
                className="grid h-4 w-4 place-items-center rounded-full"
                style={{ background: "var(--c-accent-surface, rgba(60,130,210,0.16))" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--c-accent, #3c82d2)" }} />
              </span>
              <span className="h-1 w-8 rounded-full" style={{ background: ink, opacity: 0.25 }} />
            </div>
          </div>
        ) : (
          <>
            {/* 图标网格：首块为主色派生的 icon tile tint */}
            <div className="absolute inset-x-4 top-[22px] grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <span
                  key={index}
                  className="h-5 w-5 rounded-[7px] border backdrop-blur-sm"
                  style={
                    index === 0
                      ? {
                          background: "var(--c-accent-surface, rgba(60,130,210,0.16))",
                          borderColor: "var(--c-accent-tint-glow, rgba(60,130,210,0.25))",
                        }
                      : { background: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.5)", borderColor: "transparent" }
                  }
                />
              ))}
            </div>
            {/* dock 玻璃条 */}
            <div className={`absolute inset-x-3 bottom-2 flex h-7 items-center justify-around rounded-xl border ${glass} backdrop-blur-md`}>
              {Array.from({ length: 4 }).map((_, index) => (
                <span
                  key={index}
                  className="h-4 w-4 rounded-md"
                  style={{
                    background:
                      index === 3
                        ? "var(--c-accent, #3c82d2)"
                        : isDark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.65)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <span className="ts-10 text-[var(--c-text)]">{label}</span>
    </div>
  );
}

export function DisplayColorPage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
  focusAccent = false,
}: AppearanceDraftPageProps & {
  /** 从「主题色」磁贴进入时，滚动并短暂高亮主色调面板 */
  focusAccent?: boolean;
}) {
  const isDark = draft.colorMode === "dark";
  const currentAccent = draft.accentColor || "";
  const accentBlockRef = useRef<HTMLDivElement>(null);
  const [accentHighlight, setAccentHighlight] = useState(false);

  useEffect(() => {
    if (!focusAccent || !accentBlockRef.current) return;
    accentBlockRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setAccentHighlight(true);
    const timer = setTimeout(() => setAccentHighlight(false), 1400);
    return () => clearTimeout(timer);
  }, [focusAccent]);

  function commit(patch: Partial<ThemeProfile>) {
    onDraftChange(normalizeThemeProfile({ ...draft, ...patch }));
  }

  // colorMode 是全局外观开关（Appearance Bridge 单一事实源），点击即持久化：
  // writeThemeProfile 广播后桌面 / 锁屏 / 设置的订阅同步变化，无需再点“应用”，
  // 也不允许本页保留第二份 Light/Dark 本地状态。
  function commitColorMode(mode: ThemeProfile["colorMode"]) {
    const next = normalizeThemeProfile({ ...draft, colorMode: mode });
    onDraftChange(next);
    onApply(next);
  }

  function handleApply() {
    const next = normalizeThemeProfile({ ...draft });
    onApply(next);
    onNotice("显示设置已应用");
  }

  function handleReset() {
    const next = normalizeThemeProfile({ ...draft, colorMode: "light", accentColor: "" });
    onDraftChange(next);
    onApply(next);
    onNotice("已恢复默认显示");
  }

  return (
    <div className="theme-section-page" data-bottom-reserve>
      <div className="flex flex-col gap-5">
        {/* 模式切换 */}
        <div>
          <p className="ts-11 font-semibold mb-2 text-[var(--c-text-title)]">外观模式</p>
          <div className="flex rounded-[16px] border border-[var(--c-card-border)] bg-[var(--c-input)] p-1">
            {([
              { key: "light", label: "日间" },
              { key: "dark", label: "夜间" },
            ] as const).map((opt) => {
              const active = (isDark ? "dark" : "light") === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => commitColorMode(opt.key)}
                  className="flex-1 h-9 rounded-[12px] ts-12 font-medium transition-all duration-200 active:scale-[0.97]"
                  style={active ? {
                    background: "var(--c-panel)",
                    color: "var(--c-text-title)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  } : {
                    background: "transparent",
                    color: "var(--c-text)",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 全局主色调：面板式取色器（格线 / 光谱 / 滑杆 + 快捷预设） */}
        <div
          ref={accentBlockRef}
          style={accentHighlight ? {
            borderRadius: 16,
            boxShadow: "0 0 0 2px var(--c-accent, #3c82d2)",
            transition: "box-shadow 300ms ease",
            padding: 8,
            margin: -8,
          } : { borderRadius: 16, transition: "box-shadow 300ms ease", padding: 8, margin: -8 }}
        >
          <p className="ts-11 font-semibold mb-2 text-[var(--c-text-title)]">全局主色调</p>
          <ColorPanel
            value={currentAccent}
            onChange={(hex) => commit({ accentColor: hex })}
          />
        </div>

        {/* 实时预览 */}
        <div>
          <p className="ts-11 font-semibold mb-2 text-[var(--c-text-title)]">实时预览</p>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--c-card-border)] bg-[var(--c-card)] px-4 py-3">
            <button type="button" className="ui-btn ui-btn-primary ts-11" onClick={(e) => e.preventDefault()}>
              主按钮
            </button>
            <span className="ui-chip ts-11" data-selected>标签</span>
            <label className="block w-10 h-[24px] relative shrink-0 ml-auto" onClick={(e) => e.preventDefault()}>
              <span
                className="absolute inset-0 rounded-[12px]"
                style={{ background: currentAccent ? "var(--c-accent)" : "var(--c-success)" }}
              />
              <span
                className="absolute w-5 h-5 bg-white rounded-full top-[2px] pointer-events-none"
                style={{ left: 18, boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
              />
            </label>
          </div>

          {/* 桌面 / 锁屏联动预览：种子色经统一 token 同步着色，取色器拖动即实时变化 */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ThemeSurfaceThumb label="桌面" variant="home" isDark={isDark} />
            <ThemeSurfaceThumb label="锁屏" variant="lock" isDark={isDark} />
          </div>

          <p className="ts-10 mt-2 leading-relaxed text-[var(--c-text)]">
            桌面壁纸、锁屏背景、按钮与开关都从同一个主色派生；壁纸仅轻度着色，拖动取色器即可看到全部表面联动。
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-5">
        <button
          type="button"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] border border-black/10 bg-white px-4 text-xs font-bold text-gray-800 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-95 focus:outline-none"
          onClick={handleReset}
        >
          <RotateCcw size={15} strokeWidth={1.8} />
          <span>恢复默认</span>
        </button>
        <button
          type="button"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] bg-black px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-95 focus:outline-none"
          onClick={handleApply}
        >
          <Check size={15} strokeWidth={1.8} />
          <span>应用</span>
        </button>
      </div>
    </div>
  );
}
