/* ═══════════════════════════════════════════════════════════════
   统一主题色：全局主色（seed color）→ 语义 token 派生
   ────────────────────────────────────────────────────────────────
   单一事实源：用户只选一个 accentColor（种子色），锁屏 / 桌面 / 设置 /
   按钮 / widget / 壁纸着色全部从这里派生，不允许各页面再各自硬编码。

   派生策略（rgba 透明度梯度，亮色场景通用；夜间在 color-mode.css 里
   用 color-mix 基于同一 --c-accent 增强）：
   - --c-accent               主色本体（按钮、开关、选中态）
   - --c-accent-soft          14% 薄雾底（标签、按压态）
   - --c-accent-surface       10% 浅染面（图标底色、设置高亮）
   - --c-accent-surface-strong 18% 稍深染面
   - --c-accent-tint           6% 壁纸大范围轻度着色
   - --c-accent-tint-glow     12% 壁纸角落光晕
   - --c-lock-tint / -glow    锁屏壁纸着色（锁屏底更浅，需要略高 alpha）
   - --c-accent-contrast      自动反色文字（WCAG 亮度判定）

   未设置主色时返回空字符串 → 所有 var() 走调用处的 fallback，
   界面与历史默认完全一致。
   ═══════════════════════════════════════════════════════════════ */

import { getReadableOnColor, hexToRgbChannels, parseHexColor } from "@/lib/color-utils";

/** 规范化并校验种子色；非法 / 空值返回 ""（表示跟随默认）。 */
export function normalizeSeedColor(input: string | undefined | null): string {
  if (!input) return "";
  const rgb = parseHexColor(input);
  if (!rgb) return "";
  const hex = [rgb.r, rgb.g, rgb.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * 生成下发到 :root 的统一主题 token CSS。
 * 挂在 :root（而非 .phone-shell）是为了让锁屏 / 密码页这些渲染在
 * phone-shell 之外的全屏表面也能取到同一套主色。
 */
export function buildAccentTokensCSS(input: string | undefined | null): string {
  const accent = normalizeSeedColor(input);
  if (!accent) return "";

  const rgb = hexToRgbChannels(accent);
  const contrast = getReadableOnColor(accent);

  return `:root {
  --c-accent: ${accent};
  --c-accent-rgb: ${rgb};
  --c-accent-contrast: ${contrast};
  --c-accent-soft: rgba(${rgb}, 0.14);
  --c-accent-surface: rgba(${rgb}, 0.10);
  --c-accent-surface-strong: rgba(${rgb}, 0.18);
  --c-accent-tint: rgba(${rgb}, 0.06);
  --c-accent-tint-glow: rgba(${rgb}, 0.12);
  --c-lock-tint: rgba(${rgb}, 0.10);
  --c-lock-tint-glow: rgba(${rgb}, 0.16);
  /* 图标玻璃染色（icon tile tint）：图标盒 / Dock / 文件夹的雾面洗色
     与壁纸 tint、锁屏 tint 同源；CSS 中只以 5–8% 低透明度消费。 */
  --c-desktop-icon-bg: ${accent};
}`;
}

/**
 * .phone-shell 内部的业务别名：历史上图标激活态 / 聊天蓝等语义变量
 * 直接被大量组件消费，这里把它们指向同一颗种子色，保证仍是同一色彩家族。
 */
export function buildAccentPhoneShellAliasesCSS(input: string | undefined | null): string {
  const accent = normalizeSeedColor(input);
  if (!accent) return "";
  return `.phone-shell {
  --c-icon-active: ${accent};
  --c-action-blue: ${accent};
}`;
}

/**
 * 显式撤销主色 token：自定义属性的 initial 是 guaranteed-invalid，
 * 所有 var(--c-accent, fallback) 会立即退回各自 fallback（=默认外观）。
 * 用于取色器实时预览“跟随默认”时压过持久化注入器的残留值。
 */
export function buildAccentResetCSS(): string {
  return `:root {
  --c-accent: initial;
  --c-accent-rgb: initial;
  --c-accent-contrast: initial;
  --c-accent-soft: initial;
  --c-accent-surface: initial;
  --c-accent-surface-strong: initial;
  --c-accent-tint: initial;
  --c-accent-tint-glow: initial;
  --c-lock-tint: initial;
  --c-lock-tint-glow: initial;
  --c-desktop-icon-bg: initial;
}`;
}
