/* ══════════════════════════════════════════
   外观 · 玻璃风格页（v0.8.0 T5 新增）
   暴露 Task 1 已接入实时渲染链路的外观字段：
   - pearlGlassStrength（0.6~1.4）：--pearl-glass-strength，
     Dock / 图标 / 组件毛玻璃 blur 实时倍率；
   - iconAppearance（auto/glass/mono）：经 Appearance Bridge
     解析为 .phone-shell[data-icon-effect]，CSS 已完整消费。
   边框 / 阴影开关放在外观首页「高级外观」行内。
   注意：widgetAppearance=editorial、wallpaperBrightness、锁屏壁纸
   自定义暂无 CSS 消费端（T12/后续任务接入），本页不放假开关。
   ══════════════════════════════════════════ */
"use client";
import { normalizeThemeProfile, type ThemeProfile } from "@/lib/theme-types";
import type { AppearanceDraftPageProps } from "./appearance-shared";

const GLASS_MIN = 0.6;
const GLASS_MAX = 1.4;
const GLASS_STEP = 0.05;

const ICON_APPEARANCE_OPTIONS: ReadonlyArray<{
  key: ThemeProfile["iconAppearance"];
  label: string;
  desc: string;
}> = [
  { key: "auto", label: "自动", desc: "跟随 Pearl Glass 默认玻璃图标" },
  { key: "glass", label: "玻璃", desc: "始终使用毛玻璃图标" },
  { key: "mono", label: "单色", desc: "黑白灰阶纯色图标" },
];

export function GlassStylePage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
}: AppearanceDraftPageProps) {
  const strengthPct = Math.round(draft.pearlGlassStrength * 100);

  function commit(patch: Partial<ThemeProfile>, notice?: string) {
    const next = normalizeThemeProfile({ ...draft, ...patch });
    onDraftChange(next);
    onApply(next);
    if (notice) onNotice(notice);
  }

  return (
    <div className="theme-section-page" data-bottom-reserve>
      <div className="flex flex-col gap-5">
        {/* Pearl Glass 强度 */}
        <div>
          <p className="ts-11 font-semibold mb-2 text-[var(--c-text-title)]">Pearl Glass 强度</p>
          <div className="rounded-[16px] border border-[var(--c-card-border)] bg-[var(--c-card)] px-4 py-3">
            <div className="wp-slider-row">
              <label>{"玻璃模糊"}</label>
              <input
                className="ui-slider"
                type="range"
                min={GLASS_MIN * 100}
                max={GLASS_MAX * 100}
                step={GLASS_STEP * 100}
                value={strengthPct}
                onChange={(e) => commit({ pearlGlassStrength: Number(e.target.value) / 100 })}
              />
              <span className="wp-slider-value">{Math.round(draft.pearlGlassStrength * 100)}%</span>
            </div>
            <p className="ts-10 mt-2 leading-relaxed text-[var(--c-text)]">
              {"调整 Dock、图标与桌面组件毛玻璃的模糊强度，实时预览；范围 60% ~ 140%，默认 100%。"}
            </p>
          </div>
        </div>

        {/* 图标材质 */}
        <div>
          <p className="ts-11 font-semibold mb-2 text-[var(--c-text-title)]">图标材质</p>
          <div className="flex rounded-[16px] border border-[var(--c-card-border)] bg-[var(--c-input)] p-1">
            {ICON_APPEARANCE_OPTIONS.map((opt) => {
              const active = draft.iconAppearance === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => commit({ iconAppearance: opt.key })}
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
          <p className="ts-10 mt-2 leading-relaxed text-[var(--c-text)]">
            {ICON_APPEARANCE_OPTIONS.find(o => o.key === draft.iconAppearance)?.desc}
            {"。已上传自定义图标皮肤的图标始终优先显示皮肤。"}
          </p>
        </div>
      </div>
    </div>
  );
}
