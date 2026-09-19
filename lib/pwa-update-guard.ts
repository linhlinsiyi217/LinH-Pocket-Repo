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
