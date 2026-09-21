"use client";

/* ═══════════════════════════════════════════════════════════
   更新完成一次性卡片（System Update）
   - 新版本首次启动后在底部展示一次 Pearl Glass 轻卡片
   - 仅升级用户可见：无历史记录（全新安装）不弹，静默写入基线
   - 展示即刻写入 localStorage，刷新 / 重开都不会重复出现
   - 「查看更新内容」复用 update-notice 的同一个更新日志弹窗
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

import { PearlSymbol } from "./ui/pearl-symbol";
import { OPEN_CHANGELOG_EVENT } from "./update-notice";
import { APP_VERSION, compareVersions } from "@/lib/version-info";
import { LATEST_RELEASE } from "@/lib/update/changelog";

const COMPLETED_VERSION_KEY = "linh-pocket-update-completed-version";

function readCompletedVersion(): string | null {
    try {
        return window.localStorage.getItem(COMPLETED_VERSION_KEY);
    } catch {
        return null;
    }
}

function writeCompletedVersion(): void {
    try {
        window.localStorage.setItem(COMPLETED_VERSION_KEY, APP_VERSION);
    } catch {
        // 隐私模式等场景 localStorage 不可用：本次仍展示，不影响使用
    }
}

export function UpdateCompleteToast() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const previous = readCompletedVersion();
        // 全新安装：建立基线，不打扰；老版本升级到当前版本：展示一次
        if (previous && compareVersions(APP_VERSION, previous) > 0) {
            setVisible(true);
        }
        writeCompletedVersion();
    }, []);

    if (!visible) return null;

    const dismiss = () => setVisible(false);
    const openChangelog = () => {
        window.dispatchEvent(new CustomEvent(OPEN_CHANGELOG_EVENT));
        dismiss();
    };

    return (
        <div className="su-complete-toast" role="status" aria-live="polite">
            <div className="su-complete-head">
                <span className="su-complete-icon" aria-hidden>
                    <PearlSymbol name="update" size={18} strokeWidth={2} />
                </span>
                <span className="su-complete-title">{`LinH Pocket 已更新至 v${APP_VERSION}`}</span>
                <button type="button" className="su-complete-close" aria-label="关闭" onClick={dismiss}>
                    <PearlSymbol name="close" size={15} strokeWidth={2.2} />
                </button>
            </div>
            <p className="su-complete-sub">{LATEST_RELEASE.title}</p>
            <div className="su-complete-actions">
                <button type="button" className="su-complete-link" onClick={openChangelog}>
                    查看更新内容
                </button>
            </div>
        </div>
    );
}
