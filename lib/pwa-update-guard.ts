// PWA 自动刷新安全守卫（Task 4.5）
//
// 业务模块（聊天室流式生成、未保存编辑等）可注册「忙碌中」判定函数。
// pwa-registrar 在新 SW 接管、准备自动 reload 前统一查询：
// 任一守卫返回 true（或抛错按忙碌处理之外的安全默认——这里异常不阻塞）
// 则放弃自动刷新，改为轻提示由用户手动刷新。
// 仅内存态，不写任何存储；注册返回注销函数，组件卸载时调用。

export type PwaRefreshGuard = () => boolean;

declare global {
  interface Window {
    __pwaRefreshGuards?: PwaRefreshGuard[];
  }
}

export function registerPwaRefreshGuard(guard: PwaRefreshGuard): () => void {
  if (typeof window === "undefined") return () => {};
  const list = (window.__pwaRefreshGuards ??= []);
  list.push(guard);
  return () => {
    const index = list.indexOf(guard);
    if (index >= 0) list.splice(index, 1);
  };
}

/** true = 当前有任务不可被自动刷新打断。 */
export function isPwaRefreshBlocked(): boolean {
  if (typeof window === "undefined") return false;
  const list = window.__pwaRefreshGuards;
  if (!list) return false;
  for (const guard of list) {
    try {
      if (guard()) return true;
    } catch {
      // 单个守卫异常不影响其余判定
    }
  }
  return false;
}

/**
 * 聚焦中的输入框 / textarea / contenteditable 有非空内容 → 视为用户正在输入，
 * 自动切换版本会丢草稿（System Update 安全时机判定）。
 */
export function hasFocusedDraft(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value.trim().length > 0;
  }
  if (el.isContentEditable) {
    return (el.textContent || "").trim().length > 0;
  }
  return false;
}

/**
 * 自动更新可否立即激活/刷新：注册守卫全部放行，且用户没有正在输入的草稿。
 * 手动点击「立即更新」不受此判定限制。
 */
export function isSafeToAutoActivate(): boolean {
  return !isPwaRefreshBlocked() && !hasFocusedDraft();
}
