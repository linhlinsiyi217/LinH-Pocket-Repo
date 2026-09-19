// 设置深链桥（0.8.0 T4）：桌面旧图标（theme/characters/resources）、mascot、
// 控制中心、通知等外部入口统一通过本桥打开「设置」并定位到子页/二级 tab。
//
// 协议：window CustomEvent("settings-deep-link", { detail: { page, tab? } })
// - 设置 App 未挂载时，由 desktop-shell 监听后 setActiveApp("settings") 并经
//   initialDeepLink prop 传入（事件可能早于挂载）；
// - 设置已在前台时，PhoneSettingsApp 直接监听本事件即时导航。
// 旧的 mascot-navigate-mode / settings-navigate 事件保持不变（兼容）。

export const SETTINGS_DEEP_LINK_EVENT = "settings-deep-link";

export type SettingsDeepLink = {
  /** PhoneSettingsApp 注册的子页 id（见 SETTINGS_SEARCH_INDEX）。 */
  page: string;
  /** 二级深链，如资源库的 "memory" / "vn_assets"。 */
  tab?: string;
};

export function openSettingsPage(page: string, tab?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SettingsDeepLink>(SETTINGS_DEEP_LINK_EVENT, {
      detail: { page, tab },
    }),
  );
}
