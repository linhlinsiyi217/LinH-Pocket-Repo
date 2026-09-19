"use client";

/* ═══════════════════════════════════════════════════════════
   PhoneThemeApp（v0.8.0 T5 起为兼容薄壳）
   - 全部外观子页 / 菜单 / 对话框已抽到
     components/settings/appearance-*.tsx 的共享组件；
   - 设置 → 外观与主题 与本薄壳（旧图标 / 旧深链兜底）渲染
     同一个 AppearanceRoot，操作写入同一份主题 storage；
   - mascot-theme-section 深链引导逻辑保留在 AppearanceRoot 内。
   ═══════════════════════════════════════════════════════════ */
import { AppearanceRoot } from "@/components/settings/appearance-root";
import type { AppearanceRootProps } from "@/components/settings/appearance-shared";

export type PhoneThemeAppProps = AppearanceRootProps;

export function PhoneThemeApp(props: PhoneThemeAppProps) {
  return <AppearanceRoot {...props} />;
}
