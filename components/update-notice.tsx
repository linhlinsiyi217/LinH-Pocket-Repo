"use client";

import { useCallback, useEffect, useState } from "react";

import {
  APP_VERSION,
  CHANGELOG_KIND_META,
  RELEASE_NOTES,
  UPDATE_UNREAD_CHANGED_EVENT,
  isUpdateUnread,
  markUpdateRead,
  type ChangelogKind,
} from "@/lib/version-info";

/** 设置页点击「更新日志」时广播，主页挂载的弹窗收到后打开。 */
export const OPEN_CHANGELOG_EVENT = "linh-pocket-open-changelog";

/** 订阅未读状态：供桌面设置角标与设置页行内小白点共用。 */
export function useUpdateUnread(): boolean {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    const sync = () => setUnread(isUpdateUnread());
    sync();
    window.addEventListener(UPDATE_UNREAD_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(UPDATE_UNREAD_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return unread;
}

function ChangelogTag({ kind }: { kind: ChangelogKind }) {
  const meta = CHANGELOG_KIND_META[kind];
  return (
    <span
      className="update-tag"
      style={{
        color: meta.color,
        background: `${meta.color}1f`,
        borderColor: `${meta.color}55`,
      }}
    >
      {meta.label}
    </span>
  );
}

/**
 * 更新日志弹窗（PROJECT_RULES.md 三-4、第四章）：
 * 进入主页后，只要 localStorage 已读版本 ≠ 当前版本（新老用户都算），自动弹出；
 * 「知道了」写入已读版本。毛玻璃遮罩 + 弹性动画，彩色标签仅在此与更新日志面板出现。
 */
export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const openTimer = window.setTimeout(() => {
      setMounted(true);
      if (isUpdateUnread()) setOpen(true);
    }, 600);

    const openByEvent = () => setOpen(true);
    window.addEventListener(OPEN_CHANGELOG_EVENT, openByEvent);
    return () => {
      window.clearTimeout(openTimer);
      window.removeEventListener(OPEN_CHANGELOG_EVENT, openByEvent);
    };
  }, []);

  const handleKnow = useCallback(() => {
    markUpdateRead();
    setOpen(false);
  }, []);

  if (!mounted || !open) return null;

  return (
    <div className="update-overlay" data-ui="modal" onClick={handleKnow}>
      <div className="update-dialog" data-ui="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="update-dialog-handle" aria-hidden />
        <div className="update-dialog-head">
          <span className="update-dialog-title">更新日志</span>
          <span className="update-dialog-version">v{APP_VERSION}</span>
        </div>
        <div className="update-dialog-body">
          {RELEASE_NOTES.map((release) => (
            <section key={release.version} className="update-release">
              <div className="update-release-meta">
                <span>v{release.version}</span>
                <span className="update-release-date">{release.date}</span>
              </div>
              <ul className="update-entry-list">
                {release.entries.map((entry, index) => (
                  <li key={`${release.version}-${index}`} className="update-entry">
                    <ChangelogTag kind={entry.kind} />
                    <span className="update-entry-text">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button type="button" className="update-know-btn" onClick={handleKnow}>
          知道了
        </button>
      </div>
    </div>
  );
}
