/* ══════════════════════════════════════════
   外观 · 文字页（v0.8.0 T5 等价抽离）
   文字缩放 75~150 + 自定义字体上传（font 资产）。
   ══════════════════════════════════════════ */
"use client";
import { useCallback, useRef } from "react";
import { RotateCcw, Type } from "lucide-react";
import { normalizeThemeProfile } from "@/lib/theme-types";
import { saveThemeAssetFromBlob, deleteThemeAsset } from "@/lib/theme-storage";
import type { AppearanceDraftPageProps } from "./appearance-shared";

export function TextScalePage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
  compact = false,
}: AppearanceDraftPageProps & {
  compact?: boolean;
}) {
  const fontFileRef = useRef<HTMLInputElement>(null);
  const scale = Number(draft.cssOverrides["--app-text-scale"] || "1");
  const pct = Math.round(scale * 100);
  const updateScale = (val: number) => {
    const next = { ...draft, cssOverrides: { ...draft.cssOverrides, "--app-text-scale": String(val) } };
    onDraftChange(next);
    onApply(next);
  };
  const handleFontClear = useCallback(async () => {
    const assetId = draft.fontAssetId;
    const { "--app-font-family": _fontOverride, ...cssOverrides } = draft.cssOverrides;
    const next = normalizeThemeProfile({ ...draft, fontAssetId: null, cssOverrides });
    let cleanupFailed = false;
    try {
      if (assetId) {
        try {
          await deleteThemeAsset(assetId);
        } catch (err) {
          cleanupFailed = true;
          console.warn("[Font] asset cleanup failed:", err);
        }
      }
      onDraftChange(next);
      await onApply(next);
      onNotice(cleanupFailed ? "已清除上传字体，资源稍后可再清理" : "已清除上传字体");
    } catch (err) {
      console.error("[Font] clear failed:", err);
      onNotice("清除失败：" + String(err));
    }
  }, [draft, onDraftChange, onApply, onNotice]);
  const handleFontUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      console.log("[Font] uploading:", file.name, file.size, file.type);
      const assetId = await saveThemeAssetFromBlob(file, "font");
      console.log("[Font] saved assetId:", assetId);
      const { "--app-font-family": _fontOverride, ...cssOverrides } = draft.cssOverrides;
      const next = normalizeThemeProfile({ ...draft, fontAssetId: assetId, fontFamily: draft.fontFamily, cssOverrides });
      console.log("[Font] applying theme, fontAssetId:", next.fontAssetId, "fontFamily:", next.fontFamily);
      onDraftChange(next);
      await onApply(next);
      onNotice("字体已上传：" + file.name);
    } catch (err) {
      console.error("[Font] upload failed:", err);
      onNotice("上传失败：" + String(err));
    }
  }, [draft, onDraftChange, onApply, onNotice]);
  return (
    <div className="theme-section-page" style={{ padding: compact ? 0 : "16px 28px 24px" }}>
      {/* 文字缩放 */}
      <div className="wp-sliders">
        <div className="wp-slider-row">
          <label>{"文字缩放"}</label>
          <input
            className="ui-slider"
            type="range"
            min={75}
            max={150}
            step={5}
            value={pct}
            onChange={(e) => updateScale(Number(e.target.value) / 100)}
          />
          <span className="wp-slider-value">{pct}%</span>
        </div>
      </div>

      {/* 字体选择 */}
      <div className="mt-4">
        <p className="ts-13 font-medium mb-8" style={{ color: "var(--c-text-title)" }}>{"字体"}</p>
        {draft.fontAssetId && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-black/10 bg-white/70 px-3 ts-11 font-medium text-[var(--c-text)] shadow-sm transition-all hover:bg-white active:scale-95 focus:outline-none"
              onClick={handleFontClear}
              title="清除上传字体"
            >
              <RotateCcw size={12} strokeWidth={1.8} />
              <span>清除字体</span>
            </button>
          </div>
        )}
        <div className="my-3">
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] bg-black px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-95 focus:outline-none"
            onClick={() => fontFileRef.current?.click()}
          >
            <Type size={15} strokeWidth={1.8} />
            <span>上传字体</span>
          </button>
        </div>
        <input
          ref={fontFileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          className="hidden"
          onChange={handleFontUpload}
        />
      </div>

      <p className="ts-11 text-[var(--c-icon)] leading-relaxed mt-12">
        {"文字缩放：以当前设计字号为 100%，范围 75% ~ 150%。"}
        <br />
        {"字体：上传 .ttf / .otf / .woff2 文件。"}
      </p>
    </div>
  );
}
