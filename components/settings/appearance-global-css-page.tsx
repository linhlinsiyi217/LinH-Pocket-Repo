/* ══════════════════════════════════════════
   外观 · 全局自定义 CSS 页（v0.8.0 T5 等价抽离）
   globalCustomCSS 优先级保持最高，存储格式不动。
   ══════════════════════════════════════════ */
"use client";
import { useState } from "react";
import CSSSchemeBar from "@/components/ui/css-scheme-picker";
import { normalizeThemeProfile } from "@/lib/theme-types";
import { readThemeProfile } from "@/lib/theme-storage";
import type { AppearanceDraftPageProps } from "./appearance-shared";

export function GlobalCSSPage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
}: AppearanceDraftPageProps) {
  const [localCSS, setLocalCSS] = useState(() => {
    // Read latest from storage in case 小卷 updated it
    try {
      return readThemeProfile().globalCustomCSS || draft.globalCustomCSS;
    } catch { return draft.globalCustomCSS; }
  });

  function handleApply() {
    const next = normalizeThemeProfile({ ...draft, globalCustomCSS: localCSS });
    onDraftChange(next);
    onApply(next);
    console.log("[GlobalCSS] Applied CSS length:", localCSS.length, "| preview:", localCSS.slice(0, 80));
    onNotice("自定义 CSS 已应用");
  }

  return (
    <div className="theme-section-page">
      <p className="ts-13 text-[var(--c-text)] mb-3 leading-relaxed">
        {"编写自定义 CSS，覆盖 :root 变量或为任意元素添加样式。修改后点击「应用」生效。"}
      </p>
      <textarea
        className="ui-textarea font-mono ts-13 leading-relaxed flex-1"
        style={{ minHeight: 280, resize: "none", scrollbarWidth: "none" }}
        placeholder={'[data-ui="card"] {\n  border-radius: 14px;\n}\n\n.ui-btn {\n  border-radius: 999px;\n}'}
        value={localCSS}
        onChange={(e) => setLocalCSS(e.target.value)}
        spellCheck={false}
      />
      <div className="flex gap-2 mt-3 items-center">
        <CSSSchemeBar target="global" currentCSS={localCSS} onLoad={setLocalCSS} />
        <button type="button" className="ui-btn ui-btn-outline flex-1" onClick={() => setLocalCSS("")}>清除</button>
        <button type="button" className="ui-btn ui-btn-soft-action flex-1" onClick={handleApply}>应用</button>
      </div>
    </div>
  );
}
