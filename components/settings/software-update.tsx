"use client";

/* ═══════════════════════════════════════════════════════════
   软件更新（System Update）设置子页
   - 全部复用 Pearl Settings 原语（ps-group / ps-row / ps-switch）
   - 状态来自 lib/update/update-center-store 单一状态机（真实 SW 链路）
   - 更新日志只从 lib/update/changelog.ts 单一数据源取数
   ═══════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

import {
    SettingsGroup,
    SettingsRow,
    SettingsSectionTitle,
    SettingsToggleRow,
} from "./pearl-settings";
import { PearlSymbol, type PearlSymbolName, type PearlSymbolTone } from "../ui/pearl-symbol";
import { OPEN_CHANGELOG_EVENT, useUpdateUnread } from "../update-notice";
import { APP_VERSION } from "@/lib/version-info";
import {
    CHANGELOG_SECTION_META,
    LATEST_RELEASE,
    type ChangelogSectionKey,
} from "@/lib/update/changelog";
import {
    activateNow,
    checkForUpdates,
    getDisplayStatus,
    setAutoUpdatePreference,
    useUpdateCenter,
    type UpdateDisplayStatus,
} from "@/lib/update/update-center-store";

function formatCacheVersion(value: string | null): string {
    if (!value) return "—";
    return value.replace(/^ai-phone-pwa-/, "");
}

function formatBuildId(value: string | null): string {
    if (!value) return "—";
    return value.length > 10 ? value.slice(0, 8) : value;
}

type StatusVisual = {
    symbol: PearlSymbolName;
    tone: PearlSymbolTone;
    title: string;
    sub: string;
    spinning?: boolean;
};

function getStatusVisual(status: UpdateDisplayStatus, state: ReturnType<typeof useUpdateCenter>): StatusVisual {
    const readyLabel = state.readyVersion
        ? `${formatCacheVersion(state.readyVersion)} 已下载完成`
        : "新版本已下载完成";
    switch (status) {
        case "unsupported":
            return {
                symbol: "general",
                tone: "mono",
                title: "自动更新未启用",
                sub: "当前为开发模式或浏览器不支持 Service Worker；正式版 / 安装到桌面后将启用真实更新链路",
            };
        case "offline":
            return {
                symbol: "wifi-off",
                tone: "mono",
                title: "离线",
                sub: "当前离线，将在恢复网络后检查更新",
            };
        case "idle":
            return { symbol: "update", tone: "mono", title: "准备检查更新…", sub: " ", spinning: true };
        case "checking":
            return { symbol: "update", tone: "mono", title: "正在检查更新…", sub: " ", spinning: true };
        case "downloading":
            return { symbol: "update", tone: "mono", title: "正在下载新版本…", sub: "下载完成前当前版本可正常使用", spinning: true };
        case "ready":
            return {
                symbol: "download",
                tone: "mono",
                title: "有新版本可用",
                sub: `${readyLabel}。点击「立即更新」切换；不更新则继续使用当前稳定版本`,
            };
        case "waiting-safe":
            return {
                symbol: "clock",
                tone: "mono",
                title: "等待安全更新",
                sub: `${state.blockedReason ?? "有进行中的任务"}；任务结束后将自动切换，不会打断当前操作`,
            };
        case "activating":
            return { symbol: "update", tone: "mono", title: "正在准备更新…", sub: "新版本即将接管，页面将刷新一次", spinning: true };
        case "error":
            return {
                symbol: "warning",
                tone: "danger",
                title: "更新失败",
                sub: state.errorMessage ?? "新版本下载失败，当前稳定版本可继续使用",
            };
        case "latest":
        default:
            return {
                symbol: "check",
                tone: "success",
                title: "已是最新版本",
                sub: `LinH Pocket v${APP_VERSION}`,
            };
    }
}

const RELEASE_SECTION_ORDER: ChangelogSectionKey[] = ["added", "improved", "fixed", "knownIssues"];

function ReleaseSectionList({ items, section }: { items: string[]; section: ChangelogSectionKey }) {
    if (items.length === 0) return null;
    const meta = CHANGELOG_SECTION_META[section];
    return (
        <div className="su-log-section">
            <p className="su-log-section-title" style={{ color: meta.color }}>
                <span className="su-log-dot" style={{ background: meta.color }} aria-hidden />
                {meta.label}
            </p>
            <ul className="su-log-list">
                {items.map((text, index) => (
                    <li key={`${section}-${index}`} className="su-log-item">{text}</li>
                ))}
            </ul>
        </div>
    );
}

export function SoftwareUpdatePage() {
    const state = useUpdateCenter();
    const updateUnread = useUpdateUnread();
    const status = getDisplayStatus(state);
    const visual = getStatusVisual(status, state);

    const busy = status === "checking" || status === "downloading" || status === "activating" || status === "idle";
    const canCheck = state.supported && state.online && !busy;
    const canActivate = status === "ready";

    let note: ReactNode = null;
    if (status === "offline") {
        note = "当前离线，将在恢复网络后自动检查更新；已下载的新版本仍可离线安装。";
    } else if (status === "error") {
        note = state.errorMessage ?? "新版本下载失败，当前稳定版本可继续使用。";
    } else if (status === "unsupported") {
        note = "开发模式不启用 Service Worker；偏好设置会被保存，生产构建（npm run build 后启动）下为真实更新链路。";
    } else if (status === "waiting-safe") {
        note = "自动更新仅会在聊天生成、文字输入、角色 / 世界卷宗编辑、文件上传等任务全部结束后切换，且每次切换只刷新一次。";
    } else if (status === "ready" && !state.autoUpdate) {
        note = "自动更新已关闭：新版本已在后台下载完成，不会自动切换；点击「立即更新」后才会重启生效。";
    }

    return (
        <div className="settings-pearl-scroll">
            <SettingsSectionTitle>版本</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow symbol="about" title="应用版本" value={`v${APP_VERSION}`} showChevron={false} static />
                <SettingsRow symbol="storage" title="构建版本" value={formatBuildId(state.buildId)} showChevron={false} static />
                <SettingsRow
                    symbol="archive"
                    title="缓存版本"
                    value={formatCacheVersion(state.cacheVersion)}
                    sub={state.readyVersion ? `待切换：${formatCacheVersion(state.readyVersion)}` : undefined}
                    showChevron={false}
                    static
                />
            </SettingsGroup>

            <SettingsSectionTitle>更新</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow
                    symbol={visual.symbol}
                    tone={visual.tone}
                    title={visual.title}
                    sub={visual.sub.trim() ? <span className="su-sub-multi">{visual.sub}</span> : undefined}
                    showChevron={false}
                    static
                    trailing={
                        visual.spinning ? (
                            <PearlSymbol name="update" size={17} strokeWidth={2.1} className="su-spin" />
                        ) : undefined
                    }
                />
                <SettingsRow
                    symbol="update"
                    title="检查更新"
                    onClick={canCheck ? () => void checkForUpdates() : undefined}
                    static={!canCheck}
                    trailing={
                        busy ? (
                            <PearlSymbol name="update" size={17} strokeWidth={2.1} className="su-spin" />
                        ) : undefined
                    }
                />
                {canActivate ? (
                    <SettingsRow
                        symbol="download"
                        title={<span className="su-apply-title">立即更新</span>}
                        sub="重启并切换到新版本"
                        onClick={() => activateNow()}
                    />
                ) : null}
                <SettingsToggleRow
                    symbol="sparkles"
                    title="自动更新"
                    sub="下载后仅在安全时机自动切换"
                    checked={state.autoUpdate}
                    onChange={(next) => setAutoUpdatePreference(next)}
                />
            </SettingsGroup>
            {note ? <p className="ps-note su-status-note">{note}</p> : null}

            <SettingsSectionTitle>更新日志</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow
                    symbol="sparkles"
                    title="查看完整更新日志"
                    onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHANGELOG_EVENT))}
                    trailing={
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            {updateUnread ? <span className="update-dot update-dot-row" aria-label="有未读更新内容" /> : null}
                            <PearlSymbol name="chevron" size={17} strokeWidth={2.2} className="ps-row-chevron" />
                        </span>
                    }
                />
            </SettingsGroup>

            <SettingsSectionTitle>{`v${LATEST_RELEASE.version} · ${LATEST_RELEASE.title}`}</SettingsSectionTitle>
            <div className="su-log-card">
                <p className="su-log-date">{LATEST_RELEASE.date}</p>
                <p className="su-log-summary">{LATEST_RELEASE.summary}</p>
                {RELEASE_SECTION_ORDER.map((section) => (
                    <ReleaseSectionList key={section} section={section} items={LATEST_RELEASE[section]} />
                ))}
            </div>
        </div>
    );
}
