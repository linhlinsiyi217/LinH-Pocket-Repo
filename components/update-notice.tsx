"use client";

import { useCallback, useEffect, useState } from "react";

import {
  APP_VERSION,
  UPDATE_UNREAD_CHANGED_EVENT,
  isUpdateUnread,
  markUpdateRead,
} from "@/lib/version-info";
import {
  CHANGELOG,
  CHANGELOG_SECTION_META,
  type ChangelogSectionKey,
} from "@/lib/update/changelog";

/** 设置页 / 更新完成卡片点击时广播，主页挂载的弹窗收到后打开。 */
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

const RELEASE_SECTION_ORDER: ChangelogSectionKey[] = [
  "added",
  "improved",
  "fixed",
  "knownIssues",
];

function ChangelogTag({ section }: { section: ChangelogSectionKey }) {
  const meta = CHANGELOG_SECTION_META[section];
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
 * 更新日志弹窗（System Update）：
 * 单一数据源 lib/update/changelog.ts；不再进主页自动弹出，
 * 仅由 OPEN_CHANGELOG_EVENT 唤起（更新中心「查看完整更新日志」、
 * 新版本首启完成卡片「查看更新内容」）。「知道了」写入已读版本。
 * 毛玻璃遮罩 + 弹性动画，彩色标签仅在此与更新日志面板出现。
 */
export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const openByEvent = () => setOpen(true);
    window.addEventListener(OPEN_CHANGELOG_EVENT, openByEvent);
    return () => {
      window.removeEventListener(OPEN_CHANGELOG_EVENT, openByEvent);
    };
  }, []);

  const handleKnow = useCallback(() => {
    markUpdateRead();
    setOpen(false);
  }, []);

  if (!mounted || !open) return null;

  return (
    <div className="update-overlay glass-overlay" data-ui="modal" onClick={handleKnow}>
      <div className="update-dialog glass-modal" data-ui="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="update-dialog-handle" aria-hidden />
        <div className="update-dialog-head">
          <span className="update-dialog-title">更新日志</span>
          <span className="update-dialog-version">v{APP_VERSION}</span>
        </div>
        <div className="update-dialog-body">
          {CHANGELOG.map((release) => (
            <section key={release.version} className="update-release">
              <div className="update-release-meta">
                <span>v{release.version}</span>
                <span className="update-release-date">{release.date}</span>
              </div>
              <div className="update-release-heading">{release.title}</div>
              {release.summary ? (
                <p className="update-release-summary">{release.summary}</p>
              ) : null}
              <ul className="update-entry-list">
                {RELEASE_SECTION_ORDER.flatMap((section) =>
                  release[section].map((text, index) => (
                    <li key={`${release.version}-${section}-${index}`} className="update-entry">
                      <ChangelogTag section={section} />
                      <span className="update-entry-text">{text}</span>
                    </li>
                  )),
                )}
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
