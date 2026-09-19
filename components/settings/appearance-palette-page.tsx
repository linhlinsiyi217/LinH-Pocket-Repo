/* ══════════════════════════════════════════
   外观 · CSS Variables 调色页（v0.8.0 T5 等价抽离）
   8 个 --c-* 表面颜色变量：取色 + 透明度；不改 --c-* 命名。
   ══════════════════════════════════════════ */
"use client";
import { useState } from "react";
import { PaintBucket, RotateCcw } from "lucide-react";
import { normalizeThemeProfile } from "@/lib/theme-types";
import {
  COLOR_ITEMS,
  buildColor,
  parseColorAlpha,
  type AppearanceDraftPageProps,
} from "./appearance-shared";

export function PalettePresetPage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
}: AppearanceDraftPageProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  function handleColorChange(key: string, value: string) {
    const newOverrides = { ...draft.cssOverrides };
    if (!value.trim()) {
      delete newOverrides[key];
    } else {
      newOverrides[key] = value.trim();
    }
    const next = normalizeThemeProfile({ ...draft, cssOverrides: newOverrides });
    onDraftChange(next);
  }

  function handleApplyAll() {
    onApply(draft);
    onNotice("主题色已应用");
  }

  function handleReset() {
    const newOverrides = { ...draft.cssOverrides };
    for (const item of COLOR_ITEMS) {
      delete newOverrides[item.key];
    }
    const next = normalizeThemeProfile({ ...draft, cssOverrides: newOverrides });
    onDraftChange(next);
    onApply(next);
    onNotice("已恢复默认颜色");
  }

  return (
    <div className="theme-section-page" data-bottom-reserve>
      <div className="flex flex-col gap-4">
        <div>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_ITEMS.map((seed) => {
              const currentValue = draft.cssOverrides[seed.key] || seed.defaultValue;
              const isActive = activeKey === seed.key;
              return (
                <div key={seed.key} className="flex flex-col items-center cursor-pointer" onClick={() => setActiveKey(isActive ? null : seed.key)}>
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2"
                    style={{
                      backgroundImage: "conic-gradient(#ccc 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75%)",
                      backgroundSize: "8px 8px",
                      borderColor: isActive ? "var(--c-icon-active)" : "var(--c-card-border)",
                    }}>
                    <div className="absolute inset-0" style={{ background: currentValue }} />
                  </div>
                  <div className="ts-10 font-medium mt-1 text-center leading-tight truncate w-full">{seed.label}</div>
                </div>
              );
            })}
          </div>
          {activeKey && (() => {
            const seed = COLOR_ITEMS.find(s => s.key === activeKey);
            if (!seed) return null;
            const currentValue = draft.cssOverrides[seed.key] || seed.defaultValue;
            const { hex, alpha } = parseColorAlpha(currentValue);
            return (
              <div className="mt-3 rounded-xl bg-[var(--c-card)] border border-[var(--c-card-border)] overflow-hidden">
                <label className="relative block w-full h-[120px] cursor-pointer"
                  style={{ backgroundImage: "conic-gradient(#ccc 25%, #fff 25% 50%, #ccc 50% 75%)", backgroundSize: "12px 12px" }}>
                  <div className="absolute inset-0" style={{ background: currentValue }} />
                  <input type="color" value={hex}
                    onChange={(e) => handleColorChange(seed.key, buildColor(e.target.value, alpha))}
                    className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
                <div className="px-3 py-2.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="ts-11 text-[var(--c-text)] flex-shrink-0">透明度</span>
                    <input type="range" min={0} max={100} step="any"
                      value={alpha * 100}
                      onChange={(e) => handleColorChange(seed.key, buildColor(hex, Number(e.target.value) / 100))}
                      className="ui-slider flex-1" />
                    <span className="ui-slider-value">{Math.round(alpha * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="ts-12 font-medium">{seed.label}</span>
                    <span className="ts-10 text-[var(--c-text)] font-mono">{seed.key}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] border border-black/10 bg-white px-4 text-xs font-bold text-gray-800 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-95 focus:outline-none"
          onClick={handleReset}
        >
          <RotateCcw size={15} strokeWidth={1.8} />
          <span>重置</span>
        </button>
        <button
          type="button"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] bg-black px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-95 focus:outline-none"
          onClick={handleApplyAll}
        >
          <PaintBucket size={15} strokeWidth={1.8} />
          <span>应用</span>
        </button>
      </div>
    </div>
  );
}
