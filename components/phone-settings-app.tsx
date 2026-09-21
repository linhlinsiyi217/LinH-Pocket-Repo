"use client";

/* ═══════════════════════════════════════════════════════════
   PhoneSettingsApp（T6.5 Production）
   - 视觉层：Pearl Glass grouped list（ps-* 前缀，迁移自 preview）
   - 业务逻辑：保留原有 state / navigate / deep-link / settings-search /
     Appearance Bridge / ThemeProfile / DataManagement / legacy slots 等
   - IA：5 组（A1-A5），匹配 preview 确认的视觉方向
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useLayoutEffect, useCallback, useRef, createContext, type CSSProperties, type ReactNode } from "react";
import { Check, KeyRound, Loader2, LogOut, UserCircle, X } from "lucide-react";
import { ConfirmDialog } from "./ui/modal";
import { useUpdateUnread } from "./update-notice";
import { SoftwareUpdatePage } from "./settings/software-update";
import { getDisplayStatus, useUpdateCenter, type UpdateDisplayStatus } from "@/lib/update/update-center-store";
import { useAccount } from "@/lib/account-context";
import { isSelfHostedModeEnabled } from "@/lib/self-hosting";
import { changeAccountPassword } from "@/lib/account-client";
import { ApiSettings } from "./settings/api-settings";
import { VoiceSettings } from "./settings/voice-settings";
import { ImageGenerationSettings } from "./settings/image-generation-settings";
import { PresetManager } from "./settings/preset-manager";
import { WorldBookManager } from "./settings/worldbook-manager";
import { RegexManager } from "./settings/regex-manager";
import { DataManagement } from "./settings/data-management";
import { UserIdentitySettings } from "./settings/user-identity";
import { AboutDeclaration } from "./settings/about-declaration";
import { BindingManager } from "./settings/binding-manager";
import { WeixinSettings } from "./settings/weixin-settings";
import { CloudServicesPage } from "./settings/cloud-services-setup";
import { ToolboxSettings } from "./settings/toolbox-settings";
import { ModerationCenter } from "./settings/moderation-center";
import { AgentComputerSettings } from "./settings/agent-computer-settings";
import { LockPasscodeSettings } from "./settings/lock-passcode-settings";
import { fetchIsAdmin } from "@/lib/moderation-client";
import { PageShell } from "./ui/page-shell";
import { Toggle } from "./ui/form";
import { loadChatAppSettings, saveChatAppSettings } from "@/lib/chat-storage";
import { loadKeepAlive, saveKeepAlive } from "@/lib/weixin-storage";
import { BINDING_ACCENTS } from "@/lib/ui-accent-colors";
import { SETTINGS_DEEP_LINK_EVENT, type SettingsDeepLink } from "./settings/settings-deep-link";
import { searchSettings } from "./settings/settings-search";
import {
    AccountRow,
    SettingsGroup,
    SettingsLargeTitle,
    SettingsRow,
    SettingsSearchBar,
    SettingsSearchRow,
    SettingsSectionTitle,
    SettingsToggleRow,
} from "./settings/pearl-settings";
import { PearlSymbol, type PearlSymbolName, type PearlSymbolTone } from "./ui/pearl-symbol";
import {
    getAppearanceSnapshot,
    toggleColorMode,
    updateAppearance,
    subscribeAppearance,
    type AppearanceSnapshot,
} from "@/lib/appearance-bridge";

export const SettingsContext = createContext<{
    setSubpageTitle: (title: string | null) => void;
    setOverrideBack: (action: (() => void) | null) => void;
    setSubpageRightAction: (page: string, action: ReactNode | null) => void;
}>({ setSubpageTitle: () => { }, setOverrideBack: () => { }, setSubpageRightAction: () => { } });

type SettingsPageProps = {
    onClose: () => void;
    onNotice: (msg: string) => void;
    /** 外部入口（桌面旧图标 / mascot / 控制中心）指定的初始子页，挂载时消费一次。 */
    initialDeepLink?: SettingsDeepLink | null;
    /** 设置挂载前由外部暂存的深链被消费后回调（用于清状态）。 */
    onDeepLinkConsumed?: () => void;
    /**
     * 旧独立 App 全屏兼容槽（T4）：外观与主题(T5)、角色与世界(T6)、资源库(T7)
     * 完成整合前，旧图标进入设置时渲染原组件，功能不丢；返回键回设置首页。
     * 对应模块整合完成后由共享组件替换并移除槽位。
     */
    legacySlots?: Record<string, (back: () => void, tab?: string) => ReactNode>;
};

type SubPage =
    | "main"
    // ── 既有子页（全部保留）──
    | "api"
    | "voice"
    | "imageGeneration"
    | "presets"
    | "worldbook"
    | "regex"
    | "data"
    | "binding"
    | "identity"
    | "cloud"
    | "weixin"
    | "toolbox"
    | "agentComputer"
    | "moderation"
    | "lockPasscode"
    | "about"
    // ── 0.8.0 新分组骨架 ──
    | "apiHub"                  // 角色与创作 → API 与模型（二级聚合页）
    | "appearance"              // 外观与主题（T4 legacy slot，T5 替换）
    | "worldCharacters"         // 角色与世界（T4 legacy slot，T6 替换）
    | "worldResources"          // 资源库（T4 legacy slot，T7 替换；tab=memory/vn_assets）
    | "vision"                  // 视觉识别（T10 落地）
    | "lock"                    // 锁屏与状态栏（T12 落地，T4 内含密码入口）
    | "notifications"           // 通知与后台（T12 落地，T4 含后台保活）
    | "notificationsSettings"   // 通知与提醒（T6.5 新增，G1-G6）
    | "display"                 // 显示与亮度（T6.5 接入 Appearance Bridge）
    | "sound"                   // 声音与触感（规划中占位）
    | "mascot"                  // AI 与全局助手（T8/T9 落地）
    | "accessibility"           // 辅助功能（真实开关页）
    | "general"                 // 通用（软件更新入口等）
    | "softwareUpdate";         // 通用 → 软件更新（System Update）

/** 旧独立 App 全屏兼容槽页 id（不包设置 PageShell，由旧组件自带壳）。 */
const LEGACY_SLOT_PAGES = new Set<string>(["appearance", "worldCharacters", "worldResources"]);

type GroupItem = {
    page: SubPage;
    tab?: string;
    label: string;
    desc: string;
    /** Pearl Symbol 图标名（统一图标体系，替代原 glass/lucide 字段） */
    symbol: PearlSymbolName;
    /** 图标色调（默认 mono；微信=wechat 品牌绿） */
    tone?: PearlSymbolTone;
    adminOnly?: boolean;
};

type SettingsGroup = {
    id: string;
    title: string;
    items: GroupItem[];
};

// ── 5 大分组（A1-A5，T6.5 Pearl Settings IA）────────────────────────
const SETTINGS_GROUPS: SettingsGroup[] = [
    {
        id: "appearance-system",
        title: "外观与系统",
        items: [
            { page: "appearance", label: "外观与主题", desc: "深浅色 · 壁纸 · 图标 · 字体", symbol: "appearance" },
            { page: "display", label: "显示与亮度", desc: "深浅色模式与 Pearl Glass 强度", symbol: "brightness" },
            { page: "lock", label: "锁屏与状态栏", desc: "锁屏壁纸、组件与密码", symbol: "lock" },
            { page: "sound", label: "声音与触感", desc: "提示音与震动", symbol: "sound" },
            { page: "notificationsSettings", label: "通知与提醒", desc: "消息音、提醒音与 AI 通知", symbol: "bell" },
        ],
    },
    {
        id: "characters-world",
        title: "角色与世界",
        items: [
            { page: "worldCharacters", label: "角色与世界", desc: "角色档案 · 世界卷宗", symbol: "characters" },
            { page: "worldbook", label: "世界书", desc: "触发式设定与 AI 上下文", symbol: "book" },
            { page: "worldResources", label: "资源库", desc: "漫卷场景与立绘素材", symbol: "resources" },
            { page: "worldResources", tab: "memory", label: "记忆与上下文", desc: "角色记忆档案", symbol: "memory" },
        ],
    },
    {
        id: "connect-model",
        title: "连接与模型",
        items: [
            { page: "apiHub", label: "API 与模型", desc: "对话 · 语音 · 图像 · 视觉", symbol: "api" },
            { page: "voice", label: "语音", desc: "语音合成接口", symbol: "voice" },
            { page: "vision", label: "视觉识别", desc: "图片与文件的 AI 视觉识别", symbol: "vision" },
            { page: "weixin", label: "微信接入", desc: "iLink Bot", symbol: "wechat", tone: "wechat" },
            { page: "notifications", label: "通知与后台", desc: "通知、保活与推送", symbol: "background-notifications" },
        ],
    },
    {
        id: "data",
        title: "数据",
        items: [
            { page: "data", label: "数据与存储", desc: "本地数据管理", symbol: "storage" },
            { page: "data", tab: "export", label: "导入与导出", desc: "备份、迁移与恢复", symbol: "import-export" },
            { page: "worldResources", label: "全局资源", desc: "不属任何世界的资源与素材", symbol: "resources" },
            { page: "cloud", label: "云服务与备份", desc: "备份 / 微信 / 推送", symbol: "cloud" },
        ],
    },
    {
        id: "system",
        title: "系统",
        items: [
            { page: "identity", label: "用户身份", desc: "个人信息", symbol: "user" },
            { page: "accessibility", label: "辅助功能", desc: "时间感知 · 悬浮球 · 快捷操作", symbol: "accessibility" },
            { page: "general", label: "通用", desc: "软件更新与版本", symbol: "general" },
            { page: "about", label: "关于", desc: "版本与声明", symbol: "about" },
        ],
    },
];

const ALL_GROUP_ITEMS: GroupItem[] = SETTINGS_GROUPS.flatMap(g => g.items);

/**
 * 搜索命中但首页分组里没有独立卡片的子页（它们挂在聚合页内，如 API 与模型下的
 * api/voice/imageGeneration/vision），搜索结果仍展示对应 Pearl Symbol。
 */
const SEARCH_SYMBOL_FALLBACK: Partial<Record<string, PearlSymbolName>> = {
    api: "api",
    voice: "voice",
    imageGeneration: "api",
    vision: "vision",
    presets: "archive",
    regex: "settings",
    binding: "settings",
    agentComputer: "api",
    toolbox: "settings",
    mascot: "sparkles",
    lockPasscode: "lock",
    moderation: "settings",
    softwareUpdate: "update",
};

/** 「通用 → 软件更新」行的实时状态副标题。 */
function softwareUpdateSub(status: UpdateDisplayStatus): string {
    switch (status) {
        case "unsupported": return "开发模式不可用 · 正式版启用自动更新";
        case "offline": return "离线 · 恢复网络后检查更新";
        case "idle":
        case "checking": return "正在检查更新…";
        case "downloading": return "正在下载新版本…";
        case "ready": return "有新版本可用 · 已下载完成";
        case "waiting-safe": return "等待安全更新 · 任务结束后自动切换";
        case "activating": return "正在准备更新…";
        case "error": return "更新失败 · 进入查看重试";
        case "latest":
        default: return "已是最新版本";
    }
}

/** page → 首页分组面包屑（搜索结果路径副标题） */
const SEARCH_GROUP_MAP: Record<string, string> = {
    appearance: "外观与系统", display: "外观与系统", lock: "外观与系统",
    sound: "外观与系统", notificationsSettings: "外观与系统",
    worldCharacters: "角色与世界", worldbook: "角色与世界", worldResources: "角色与世界",
    apiHub: "连接与模型", api: "连接与模型", voice: "连接与模型",
    imageGeneration: "连接与模型", vision: "连接与模型", weixin: "连接与模型",
    notifications: "连接与模型",
    data: "数据", cloud: "数据",
    identity: "系统", accessibility: "系统", general: "系统", about: "系统",
    softwareUpdate: "系统",
    presets: "AI 与规则", regex: "AI 与规则", binding: "AI 与规则",
    agentComputer: "角色与世界", toolbox: "系统", moderation: "系统",
    lockPasscode: "外观与系统", mascot: "独立助手",
};

/** 搜索结果 page/tab → Pearl Symbol（优先从首页分组取，回退到 FALLBACK） */
function resolveSearchSymbol(page: string): PearlSymbolName {
    const homeItem = ALL_GROUP_ITEMS.find(i => i.page === page);
    if (homeItem) return homeItem.symbol;
    return SEARCH_SYMBOL_FALLBACK[page] ?? "settings";
}

const accountIconStyle = { "--icon-color": BINDING_ACCENTS.identity } as CSSProperties;
const passwordIconStyle = { "--icon-color": BINDING_ACCENTS.api } as CSSProperties;
const logoutIconStyle = { "--icon-color": "var(--c-danger)" } as CSSProperties;

/** 诚实占位页：后续模块才落地的能力，明确标注，不放假开关。 */
function ComingSoonPage({ title, lines }: { title: string; lines: string[] }) {
    return (
        <div className="settings-soon">
            <div className="settings-soon-icon"><PearlSymbol name="sparkles" size={22} strokeWidth={1.6} /></div>
            <div className="settings-soon-title">{title}</div>
            {lines.map(line => <p className="settings-soon-desc" key={line}>{line}</p>)}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   通知与提醒页（G1-G6，T6.5 视觉稿）
   本轮保持本地 state（与 preview 一致），持久化留后续模块。
   ═══════════════════════════════════════════════════════════ */

type SoundSource = "default" | "none" | "url" | "upload" | "file-manager";

function SoundSourceChips({ value, onChange }: { value: SoundSource; onChange: (s: SoundSource) => void }) {
    const chips: { id: SoundSource; label: string; symbol: PearlSymbolName }[] = [
        { id: "default", label: "默认", symbol: "check" },
        { id: "none", label: "无", symbol: "close" },
        { id: "url", label: "URL", symbol: "link" },
        { id: "upload", label: "上传", symbol: "upload" },
        { id: "file-manager", label: "文件管理器", symbol: "folder-open" },
    ];
    return (
        <div className="ps-chips">
            {chips.map((chip) => (
                <button
                    key={chip.id}
                    type="button"
                    className="ps-chip"
                    data-active={value === chip.id ? "true" : "false"}
                    onClick={() => onChange(chip.id)}
                >
                    <PearlSymbol name={chip.symbol} size={13} strokeWidth={1.9} />
                    {chip.label}
                </button>
            ))}
        </div>
    );
}

function MediaActions({ canDelete }: { canDelete: boolean }) {
    return (
        <div className="ps-media-actions">
            <button type="button" className="ps-btn"><PearlSymbol name="play" size={13} strokeWidth={2} />试听</button>
            <button type="button" className="ps-btn"><PearlSymbol name="stop" size={11} strokeWidth={2.2} />停止</button>
            <button type="button" className="ps-btn ps-btn--danger" disabled={!canDelete}>
                <PearlSymbol name="trash" size={13} strokeWidth={1.9} />删除
            </button>
            <button type="button" className="ps-btn" disabled={canDelete}>恢复默认</button>
        </div>
    );
}

function NotificationsSettingsBody() {
    const [enabled, setEnabled] = useState(true);
    const [lockScreen, setLockScreen] = useState(true);
    const [banner, setBanner] = useState(true);
    const [soundOn, setSoundOn] = useState(true);
    const [haptics, setHaptics] = useState(true);

    const [messageSource, setMessageSource] = useState<SoundSource>("default");
    const [reminderSource, setReminderSource] = useState<SoundSource>("default");
    const [aiMode, setAiMode] = useState<"follow" | "custom">("follow");
    const [aiSource, setAiSource] = useState<SoundSource>("upload");
    const [voiceSource, setVoiceSource] = useState<SoundSource>("upload");

    return (
        <div className="settings-pearl-scroll">
            {/* G1 通知总设置 */}
            <SettingsSectionTitle>通知总设置</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsToggleRow symbol="bell" title="允许通知" checked={enabled} onChange={setEnabled} />
                <SettingsToggleRow symbol="lock" title="锁屏显示" sub="在锁定屏幕上显示通知" checked={lockScreen} onChange={setLockScreen} />
                <SettingsToggleRow symbol="banner" title="横幅" sub="解锁使用时从顶部下拉显示" checked={banner} onChange={setBanner} />
                <SettingsToggleRow symbol="sound" title="声音" checked={soundOn} onChange={setSoundOn} />
                <SettingsToggleRow symbol="vibrate" title="震动与触感" sub="当前为模拟状态" checked={haptics} onChange={setHaptics} />
            </SettingsGroup>

            {/* G2 消息通知音 */}
            <SettingsSectionTitle>消息通知音</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow symbol="message" title="消息通知音" value={messageSource === "default" ? "三全音（默认）" : messageSource === "none" ? "无" : "自定义"} static showChevron={false} />
                <div className="ps-media-block">
                    <div className="ps-media-current">
                        <PearlSymbol name="sound" size={16} />
                        <span className="ps-media-name">{messageSource === "none" ? "静音" : "三全音"}</span>
                        <span className="ps-media-meta">mp3 · 0.8s</span>
                    </div>
                    <SoundSourceChips value={messageSource} onChange={setMessageSource} />
                    <MediaActions canDelete={messageSource !== "default"} />
                </div>
            </SettingsGroup>

            {/* G3 提醒通知音 */}
            <SettingsSectionTitle>提醒通知音</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow symbol="bell" title="提醒通知音" sub="Reminder · 计划 · AI 跟进" value={reminderSource === "default" ? "默认提醒音" : "自定义"} static showChevron={false} />
                <div className="ps-media-block">
                    <SoundSourceChips value={reminderSource} onChange={setReminderSource} />
                    <MediaActions canDelete={reminderSource !== "default"} />
                </div>
            </SettingsGroup>

            {/* G4 AI / 角色消息通知音 */}
            <SettingsSectionTitle>AI / 角色消息通知音</SettingsSectionTitle>
            <div className="ps-segmented" role="tablist" aria-label="AI 通知音模式">
                <button type="button" data-active={aiMode === "follow"} onClick={() => setAiMode("follow")}>跟随消息通知音</button>
                <button type="button" data-active={aiMode === "custom"} onClick={() => setAiMode("custom")}>自定义</button>
            </div>
            {aiMode === "custom" ? (
                <SettingsGroup>
                    <div className="ps-media-block">
                        <SoundSourceChips value={aiSource} onChange={setAiSource} />
                        <MediaActions canDelete />
                    </div>
                </SettingsGroup>
            ) : null}

            {/* G5 语音提醒 */}
            <SettingsSectionTitle>语音提醒</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow symbol="voice" title="语音提醒音频" static showChevron={false} />
                <div className="ps-media-block">
                    <p className="ps-empty" style={{ padding: 0 }}>未导入语音音频（支持 URL / 本地上传 / 文件管理器）</p>
                    <SoundSourceChips value={voiceSource} onChange={setVoiceSource} />
                </div>
            </SettingsGroup>
            <p className="ps-note">语音 TTS 为后续能力，本轮不伪造；已有语音 API Provider 时可在生产阶段扩展。</p>

            {/* G6 视频提醒媒体 */}
            <SettingsSectionTitle>视频提醒媒体</SettingsSectionTitle>
            <SettingsGroup>
                <div className="ps-media-block">
                    <div className="ps-video-placeholder">
                        <span className="ps-video-muted-tag">静音预览</span>
                        <PearlSymbol name="video" size={18} />
                        <span>可选短视频提醒媒体（mp4 / webm）</span>
                    </div>
                    <SoundSourceChips value="upload" onChange={() => undefined} />
                </div>
            </SettingsGroup>
            <p className="ps-note">
                设置页仅静音预览，不自动播放有声视频，不强制全屏。系统 Push 是否能展示视频取决于浏览器 / PWA 实际能力。
            </p>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   显示与亮度页（T6.5 接入真实 Appearance Bridge）
   深色模式 / Pearl Glass 强度 / 边框 / 阴影 / 壁纸亮度
   全局生效（documentElement → Appearance Bridge → 所有玻璃面）
   ═══════════════════════════════════════════════════════════ */

function DisplaySettingsPage({ onNavigate, onNotice }: { onNavigate: (page: string) => void; onNotice: (msg: string) => void }) {
    const [snap, setSnap] = useState<AppearanceSnapshot | null>(() =>
        typeof window === "undefined" ? null : getAppearanceSnapshot()
    );

    useEffect(() => {
        setSnap(getAppearanceSnapshot());
        const unsubscribe = subscribeAppearance((next) => setSnap(next));
        return () => { unsubscribe(); };
    }, []);

    if (!snap) {
        return (
            <div className="settings-pearl-scroll">
                <p className="ps-note">外观运行时加载中…</p>
            </div>
        );
    }

    const isDark = snap.colorMode === "dark";

    return (
        <div className="settings-pearl-scroll">
            <SettingsSectionTitle>外观</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsToggleRow
                    symbol={isDark ? "focus" : "brightness"}
                    title="深色模式"
                    checked={isDark}
                    onChange={() => {
                        toggleColorMode();
                        onNotice(isDark ? "已切换到浅色模式" : "已切换到深色模式");
                    }}
                />
                <SettingsRow
                    symbol="appearance"
                    title="外观与主题"
                    sub="壁纸 · 图标材质 · 字体 · widget 材质"
                    onClick={() => onNavigate("appearance")}
                />
            </SettingsGroup>

            <SettingsSectionTitle>全局 Pearl Glass</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsToggleRow
                    symbol="settings"
                    title="边框"
                    sub="全局玻璃卡片边框"
                    checked={snap.borders}
                    onChange={(v) => {
                        updateAppearance({ enableGlobalBorder: v });
                        onNotice(v ? "已开启全局边框" : "已关闭全局边框");
                    }}
                />
                <SettingsToggleRow
                    symbol="settings"
                    title="阴影"
                    sub="全局玻璃卡片阴影"
                    checked={snap.shadows}
                    onChange={(v) => {
                        updateAppearance({ enableGlobalShadows: v });
                        onNotice(v ? "已开启全局阴影" : "已关闭全局阴影");
                    }}
                />
            </SettingsGroup>

            <p className="ps-demo-value" style={{ margin: "0 16px 2px" }}>Pearl Glass 强度 · {snap.pearlGlassStrength.toFixed(2)}</p>
            <input
                className="ps-demo-slider"
                type="range"
                min={0.6}
                max={1.4}
                step={0.01}
                value={snap.pearlGlassStrength}
                onChange={(e) => updateAppearance({ pearlGlassStrength: Number(e.target.value) })}
                aria-label="Pearl Glass 强度"
                style={{ width: "calc(100% - 32px)", margin: "0 16px 12px" }}
            />

            <p className="ps-demo-value" style={{ margin: "0 16px 2px" }}>壁纸亮度 · {snap.wallpaperBrightness.toFixed(2)}</p>
            <input
                className="ps-demo-slider"
                type="range"
                min={0.5}
                max={1.2}
                step={0.01}
                value={snap.wallpaperBrightness}
                onChange={(e) => updateAppearance({ wallpaperBrightness: Number(e.target.value) })}
                aria-label="壁纸亮度"
                style={{ width: "calc(100% - 32px)", margin: "0 16px 12px" }}
            />

            <SettingsSectionTitle>联动目标</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow symbol="settings" title="Settings 分组容器" value="✓" static showChevron={false} />
                <SettingsRow symbol="character" title="桌面图标 / Dock" sub="修改即生效" static showChevron={false} />
                <SettingsRow symbol="lock" title="锁屏 Widget / 通知玻璃" sub="修改即生效" static showChevron={false} />
            </SettingsGroup>
            <p className="ps-note">
                外观运行时由 Appearance Bridge 统一写入 documentElement，Settings / 桌面 / 锁屏同步联动。
                icon 材质、widget 材质等更多选项请进入「外观与主题」。
            </p>
        </div>
    );
}

export function PhoneSettingsApp({ onClose, onNotice, initialDeepLink = null, onDeepLinkConsumed, legacySlots }: SettingsPageProps) {
    // 首帧即落在深链页，避免「先闪首页再跳子页」（旧三 App 全屏槽尤其明显）
    const [currentPage, setCurrentPage] = useState<SubPage>(
        initialDeepLink?.page ? initialDeepLink.page as SubPage : "main",
    );
    // 二级 tab（目前仅 worldResources: memory / vn_assets）
    const [subTab, setSubTab] = useState<string | undefined>(initialDeepLink?.tab ?? undefined);
    // 更新日志未读白色小圆点（PROJECT_RULES.md 第四章）
    const updateUnread = useUpdateUnread();
    // 软件更新中心实时状态（通用行副标题）
    const updateCenter = useUpdateCenter();
    const [subpageTitle, setSubpageTitle] = useState<string | null>(null);
    const [subpageRightActions, setSubpageRightActions] = useState<Record<string, ReactNode>>({});
    const [overrideBack, setOverrideBack] = useState<(() => void) | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [timeAware, setTimeAware] = useState(true);
    const [promptViewerEnabled, setPromptViewerEnabled] = useState(false);
    const [quickActionEnabled, setQuickActionEnabled] = useState(false);
    const [floatingDockEnabled, setFloatingDockEnabled] = useState(false);
    const [floatingDockSheetOpen, setFloatingDockSheetOpen] = useState(false);
    const [keepAlive, setKeepAlive] = useState(false);
    // 角色电脑：施工中弹窗（返回 / 仍要看看）
    const pageBodyRef = useRef<HTMLDivElement | null>(null);

    // ── 账号：显示当前登录 / 修改密码 / 退出登录 ──
    const selfHostedMode = isSelfHostedModeEnabled();
    const { account, logout } = useAccount();
    const [pwdModalOpen, setPwdModalOpen] = useState(false);
    const [oldPwd, setOldPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [pwdBusy, setPwdBusy] = useState(false);
    const [pwdError, setPwdError] = useState("");
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [accountSheetOpen, setAccountSheetOpen] = useState(false);

    // ── 管理中心入口：仅 role=admin 的账号可见 ──
    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        if (selfHostedMode || !account) return;
        let cancelled = false;
        void fetchIsAdmin().then(result => { if (!cancelled) setIsAdmin(result); });
        return () => { cancelled = true; };
    }, [selfHostedMode, account]);

    const navigate = useCallback((page: string, tab?: string) => {
        setCurrentPage(page as SubPage);
        setSubTab(tab);
        setSearchQuery("");
    }, []);

    const closePwdModal = () => {
        if (pwdBusy) return;
        setPwdModalOpen(false);
        setOldPwd("");
        setNewPwd("");
        setConfirmPwd("");
        setPwdError("");
    };

    const handleChangePassword = async () => {
        if (pwdBusy) return;
        if (!oldPwd || !newPwd) { setPwdError("请填写当前密码和新密码。"); return; }
        if (newPwd.length < 6) { setPwdError("新密码至少需要 6 位。"); return; }
        if (newPwd !== confirmPwd) { setPwdError("两次输入的新密码不一致。"); return; }
        setPwdBusy(true);
        setPwdError("");
        try {
            const result = await changeAccountPassword({ oldPassword: oldPwd, newPassword: newPwd });
            if (!result.ok) { setPwdError(result.error || "修改失败。"); return; }
            setPwdModalOpen(false);
            setOldPwd("");
            setNewPwd("");
            setConfirmPwd("");
            onNotice("密码已修改");
        } finally {
            setPwdBusy(false);
        }
    };

    const handleCopyUsername = () => {
        if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(account.username).then(() => onNotice("用户名已复制"));
        } else {
            onNotice(`用户名：${account.username}`);
        }
    };

    const groupItemById = useCallback((id: string): GroupItem | undefined => ALL_GROUP_ITEMS.find(i => i.page === id), []);

    const defaultTitle = currentPage === "main"
        ? "设置"
        : currentPage === "api" || currentPage === "voice" || currentPage === "imageGeneration" || currentPage === "presets" || currentPage === "worldbook" || currentPage === "regex" || currentPage === "identity"
            ? ""
            : currentPage === "moderation"
                ? "管理中心"
                : currentPage === "lockPasscode"
                    ? "锁屏密码"
                    : currentPage === "notificationsSettings"
                        ? "通知与提醒"
                        : currentPage === "softwareUpdate"
                            ? "软件更新"
                            : groupItemById(currentPage)?.label || "设置";
    const title = subpageTitle || defaultTitle;

    const setSubpageRightAction = useCallback((page: string, action: ReactNode | null) => {
        setSubpageRightActions(prev => {
            if (action === null) {
                const next = { ...prev };
                delete next[page];
                return next;
            }
            return { ...prev, [page]: action };
        });
    }, []);

    const handleBack = () => {
        if (overrideBack) {
            overrideBack();
        } else if (currentPage !== "main") {
            setCurrentPage("main");
            setSubTab(undefined);
            setSubpageTitle(null);
            setOverrideBack(null);
        } else {
            onClose();
        }
    };

    const handleTimeAwareChange = useCallback((next: boolean) => {
        setTimeAware(next);
        saveChatAppSettings({ ...loadChatAppSettings(), timeAware: next });
        onNotice(next ? "已开启全局真实时间感知" : "已关闭全局真实时间感知");
    }, [onNotice]);

    const handlePromptViewerChange = useCallback((next: boolean) => {
        setPromptViewerEnabled(next);
        saveChatAppSettings({ ...loadChatAppSettings(), promptViewerEnabled: next });
        onNotice(next ? "已开启提示词查看器" : "已关闭提示词查看器");
    }, [onNotice]);

    const handleQuickActionChange = useCallback((next: boolean) => {
        setQuickActionEnabled(next);
        saveChatAppSettings({ ...loadChatAppSettings(), quickActionEnabled: next });
        onNotice(next ? "已开启快捷操作" : "已关闭快捷操作");
    }, [onNotice]);

    const handleFloatingDockChange = useCallback((next: boolean) => {
        setFloatingDockEnabled(next);
        saveChatAppSettings({ ...loadChatAppSettings(), floatingDockEnabled: next });
        onNotice(next ? "已开启悬浮球贴边收拢" : "已关闭悬浮球贴边收拢");
    }, [onNotice]);

    const handleKeepAliveChange = useCallback((next: boolean) => {
        setKeepAlive(next);
        saveKeepAlive(next);
        // use-weixin-bridge 监听这个事件来起停保活（与微信 Bot 的启用状态无关）
        window.dispatchEvent(new CustomEvent("weixin-config-changed"));
        onNotice(next ? "已开启后台保活" : "已关闭后台保活");
    }, [onNotice]);

    // ── API 与模型（二级聚合页：API / 语音 / 图像 / 视觉）──
    const renderApiHub = () => (
        <div className="settings-pearl-scroll">
            <SettingsGroup>
                <SettingsRow symbol="api" title="API 设置" sub="大模型对话接口" onClick={() => navigate("api")} />
                <SettingsRow symbol="voice" title="语音 API" sub="语音合成" onClick={() => navigate("voice")} />
                <SettingsRow symbol="api" title="图像生成 API" sub="模型、参考图与提示词" onClick={() => navigate("imageGeneration")} />
                <SettingsRow symbol="vision" title="视觉识别" sub="图片与文件的 AI 视觉识别" onClick={() => navigate("vision")} />
            </SettingsGroup>
        </div>
    );

    // ── 辅助功能 ──
    const renderAccessibility = () => (
        <div className="settings-pearl-scroll">
            <SettingsGroup>
                <SettingsToggleRow symbol="sparkles" title="真实时间感知" sub="控制全局历史事件流中是否注入时间戳" checked={timeAware} onChange={handleTimeAwareChange} />
                <SettingsToggleRow symbol="vision" title="提示词查看器" sub="开启后显示悬浮按钮，可查看当前提示词" checked={promptViewerEnabled} onChange={handlePromptViewerChange} />
                <SettingsToggleRow symbol="settings" title="快捷操作" sub="快速切换 API 与世界书" checked={quickActionEnabled} onChange={handleQuickActionChange} />
            </SettingsGroup>
            <SettingsSectionTitle>悬浮球</SettingsSectionTitle>
            <SettingsGroup>
                <SettingsRow
                    symbol="general"
                    title="贴边半透明收拢模式"
                    sub={`悬浮球偏好设置${floatingDockEnabled ? "（已开启）" : ""}`}
                    onClick={() => setFloatingDockSheetOpen(true)}
                />
            </SettingsGroup>
        </div>
    );

    // ── 通知与后台 ──
    const renderNotifications = () => (
        <div className="settings-pearl-scroll">
            <SettingsGroup>
                <SettingsToggleRow symbol="background-notifications" title="后台保活" sub="切到后台时尽量保持网页运行，主动消息与轮询不中断" checked={keepAlive} onChange={handleKeepAliveChange} />
            </SettingsGroup>
            <p className="ps-note">
                锁屏通知中心：锁屏 AI 消息通知、通知中心与离线推送状态展示将在后续版本的锁屏模块中开放。
                云推送部署仍可在「数据 → 云服务与备份」完成。
            </p>
        </div>
    );

    // ── 通用（软件更新入口）──
    const renderGeneral = () => (
        <div className="settings-pearl-scroll">
            <SettingsGroup>
                <SettingsRow
                    symbol="update"
                    title="软件更新"
                    sub={softwareUpdateSub(getDisplayStatus(updateCenter))}
                    onClick={() => navigate("softwareUpdate")}
                    trailing={
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            {updateUnread ? <span className="update-dot update-dot-row" aria-label="有未读更新内容" /> : null}
                            <PearlSymbol name="chevron" size={17} strokeWidth={2.2} className="ps-row-chevron" />
                        </span>
                    }
                />
            </SettingsGroup>
        </div>
    );

    // ── 锁屏与状态栏 ──
    const renderLock = () => (
        <div className="settings-pearl-scroll">
            <SettingsGroup>
                <SettingsRow
                    symbol="lock"
                    title="锁屏密码"
                    sub="4 位 / 6 位数字密码，上滑解锁保护"
                    onClick={() => navigate("lockPasscode")}
                />
            </SettingsGroup>
            <p className="ps-note">
                锁屏壁纸与锁屏组件：跟随桌面壁纸 / 自定义壁纸、锁屏 Widget 与状态栏细项将在后续版本的锁屏模块中开放。
            </p>
        </div>
    );

    const renderSubPage = () => {
        switch (currentPage) {
            case "apiHub":
                return renderApiHub();
            case "api":
                return <ApiSettings />;
            case "voice":
                return <VoiceSettings />;
            case "imageGeneration":
                return <ImageGenerationSettings />;
            case "presets":
                return <PresetManager isActive />;
            case "worldbook":
                return <WorldBookManager isActive />;
            case "regex":
                return <RegexManager isActive />;
            case "data":
                return <DataManagement onNotice={onNotice} deepLinkTab={subTab} />;
            case "binding":
                return <BindingManager />;
            case "cloud":
                return <CloudServicesPage />;
            case "weixin":
                return <WeixinSettings onOpenCloudServices={() => navigate("cloud")} />;
            case "toolbox":
                return <ToolboxSettings />;
            case "agentComputer":
                return <AgentComputerSettings onNotice={onNotice} />;
            case "moderation":
                return <ModerationCenter onNotice={onNotice} />;
            case "identity":
                return <UserIdentitySettings />;
            case "lockPasscode":
                return <LockPasscodeSettings onNotice={onNotice} />;
            case "about":
                return <AboutDeclaration />;
            case "accessibility":
                return renderAccessibility();
            case "notifications":
                return renderNotifications();
            case "notificationsSettings":
                return <NotificationsSettingsBody />;
            case "general":
                return renderGeneral();
            case "softwareUpdate":
                return <SoftwareUpdatePage />;
            case "lock":
                return renderLock();
            case "display":
                return <DisplaySettingsPage onNavigate={navigate} onNotice={onNotice} />;
            case "vision":
                return <ComingSoonPage title="视觉识别" lines={["文件智能层与视觉识别 Provider 将在后续版本开放，用于图片理解、截图文字识别与扫描件解析。"]} />;
            case "mascot":
                return <ComingSoonPage title="AI 与全局助手" lines={["小淮宝的全局助手能力与系统动作设置将在后续版本开放。工坊仍可从桌面图标直接进入。"]} />;
            case "sound":
                return <ComingSoonPage title="声音与触感" lines={["铃声、提示音与触感偏好规划在后续版本提供。"]} />;
            default:
                return null;
        }
    };

    useLayoutEffect(() => {
        pageBodyRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [currentPage, subTab]);

    // 外部深链：页码已由 useState 初始值落在首帧，挂载后仅通知 shell 清掉暂存
    useEffect(() => {
        if (initialDeepLink?.page) onDeepLinkConsumed?.();
    // 仅挂载时消费一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 设置已在前台时的深链事件（控制中心 / mascot / 通知点击等）
    useEffect(() => {
        const onDeepLink = (e: Event) => {
            const detail = (e as CustomEvent<SettingsDeepLink>).detail;
            if (detail?.page) navigate(detail.page, detail.tab);
        };
        window.addEventListener(SETTINGS_DEEP_LINK_EVENT, onDeepLink);
        return () => window.removeEventListener(SETTINGS_DEEP_LINK_EVENT, onDeepLink);
    }, [navigate]);

    // Check for pending mascot navigation mode on mount (stored by desktop-shell)
    useEffect(() => {
        const pending = sessionStorage.getItem("mascot-settings-mode");
        if (pending) {
            sessionStorage.removeItem("mascot-settings-mode");
            // 历史 mode 为既存子页 id；新分组 id 也允许透传
            if (ALL_GROUP_ITEMS.some(i => i.page === pending) || ["api", "voice", "imageGeneration", "presets", "worldbook", "regex", "data", "binding", "cloud", "weixin", "toolbox", "agentComputer", "identity", "about"].includes(pending)) {
                navigate(pending);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const settings = loadChatAppSettings();
        setTimeAware(settings.timeAware !== false);
        setPromptViewerEnabled(settings.promptViewerEnabled === true);
        setQuickActionEnabled(settings.quickActionEnabled === true);
        setFloatingDockEnabled(settings.floatingDockEnabled === true);
        setKeepAlive(loadKeepAlive());
    }, []);

    // Listen for mascot navigation mode (e.g. jump to worldbook/regex tab)
    useEffect(() => {
        const onMode = (e: Event) => {
            const { mode } = (e as CustomEvent).detail ?? {};
            if (!mode) return;
            if (ALL_GROUP_ITEMS.some(i => i.page === mode)) {
                navigate(mode);
                return;
            }
            const legacyPages = ["api", "voice", "imageGeneration", "presets", "worldbook", "regex", "data", "binding", "cloud", "weixin", "toolbox", "agentComputer", "identity", "about", "moderation", "lockPasscode"];
            if (legacyPages.includes(mode)) setCurrentPage(mode as SubPage);
        };
        window.addEventListener("mascot-navigate-mode", onMode);
        return () => window.removeEventListener("mascot-navigate-mode", onMode);
    }, [navigate]);

    // Listen for internal settings tab navigation (e.g. mascot "修改绑定" button)
    useEffect(() => {
        const onNav = (e: Event) => {
            const { page } = (e as CustomEvent).detail ?? {};
            if (page) navigate(page);
        };
        window.addEventListener("settings-navigate", onNav);
        return () => window.removeEventListener("settings-navigate", onNav);
    }, [navigate]);

    // ── 旧独立 App 全屏兼容槽（外观/角色/资源库）：不包设置 PageShell ──
    if (LEGACY_SLOT_PAGES.has(currentPage)) {
        const slot = legacySlots?.[currentPage];
        return (
            <SettingsContext.Provider value={{ setSubpageTitle, setOverrideBack, setSubpageRightAction }}>
                {slot
                    ? <div key={`${currentPage}:${subTab ?? ""}`}>{slot(handleBack, subTab)}</div>
                    : <ComingSoonPage title="模块整合中" lines={["该能力正在整合进设置，请通过后续版本入口使用。"]} />}
            </SettingsContext.Provider>
        );
    }

    const searchResults = searchQuery.trim() ? searchSettings(searchQuery) : [];

    // 首页 currentPage === "main" 时不包额外 padding（Pearl Glass scroll 层自带 padding）
    const isHome = currentPage === "main";

    return (
        <SettingsContext.Provider value={{ setSubpageTitle, setOverrideBack, setSubpageRightAction }}>
            <PageShell title={isHome ? "" : title} onBack={handleBack} rightAction={currentPage !== "main" ? subpageRightActions[currentPage] : undefined} bodyRef={pageBodyRef}>
                {isHome && (
                    <div className="settings-pearl-scroll">
                        <SettingsLargeTitle>设置</SettingsLargeTitle>
                        <SettingsSearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="搜索设置（外观、锁屏、世界书、API、推送…）"
                        />

                        {!selfHostedMode && (
                            <SettingsGroup>
                                <AccountRow
                                    name={account.displayName || account.username}
                                    sub="账号、云端与 LinH Pocket"
                                    onClick={() => setAccountSheetOpen(true)}
                                />
                            </SettingsGroup>
                        )}

                        {searchQuery.trim() ? (
                            <>
                                <SettingsSectionTitle>{searchResults.length ? `结果 · ${searchResults.length}` : "无结果"}</SettingsSectionTitle>
                                <SettingsGroup>
                                    {searchResults.length === 0 ? (
                                        <p className="ps-empty">没有找到与「{searchQuery.trim()}」相关的设置</p>
                                    ) : (
                                        searchResults.map(entry => (
                                            <SettingsSearchRow
                                                key={`${entry.page}:${entry.tab ?? ""}`}
                                                symbol={resolveSearchSymbol(entry.page)}
                                                title={entry.title}
                                                path={`设置 > ${SEARCH_GROUP_MAP[entry.page] ?? "系统"} > ${entry.title}`}
                                                onClick={() => navigate(entry.page, entry.tab)}
                                            />
                                        ))
                                    )}
                                </SettingsGroup>
                            </>
                        ) : (
                            SETTINGS_GROUPS.map(group => {
                                const items = group.items.filter(item => !item.adminOnly || isAdmin);
                                if (items.length === 0) return null;
                                return (
                                    <div key={group.id}>
                                        <SettingsSectionTitle>{group.title}</SettingsSectionTitle>
                                        <SettingsGroup>
                                            {items.map(item => (
                                                <SettingsRow
                                                    key={`${item.page}:${item.tab ?? ""}`}
                                                    symbol={item.symbol}
                                                    tone={item.tone ?? "mono"}
                                                    title={item.label}
                                                    sub={item.desc}
                                                    onClick={() => navigate(item.page, item.tab)}
                                                />
                                            ))}
                                        </SettingsGroup>
                                    </div>
                                );
                            })
                        )}

                        {accountSheetOpen && (
                            <div className="modal-overlay modal-overlay-bottom" data-ui="modal" onClick={() => setAccountSheetOpen(false)}>
                                <div className="modal-sheet" data-ui="modal-sheet" onClick={event => event.stopPropagation()}>
                                    <div className="modal-header" data-ui="modal-header">
                                        <button className="modal-header-btn modal-header-btn-muted" onClick={() => setAccountSheetOpen(false)}><X size={18} /></button>
                                        <h3 className="modal-title">账号</h3>
                                        <span style={{ width: 44 }} />
                                    </div>
                                    <div className="modal-body modal-body-tight" data-ui="modal-body">
                                        <div className="menu-group settings-group">
                                            <div className="menu-item settings-cell settings-tools-menu-item">
                                                <span className="card-icon" style={accountIconStyle}>
                                                    <UserCircle size={22} strokeWidth={1.75} />
                                                </span>
                                                <span className="settings-tools-menu-copy">
                                                    <span className="menu-label appearance-menu-item-label">当前账号</span>
                                                    <span className="menu-desc settings-tools-menu-desc">@{account.username}</span>
                                                </span>
                                                <span className="menu-right">
                                                    <button className="ui-btn ui-btn-outline py-1 px-3 ts-12" style={{ whiteSpace: "nowrap" }} onClick={handleCopyUsername}>复制</button>
                                                </span>
                                            </div>
                                            <button type="button" className="menu-item settings-cell settings-tools-menu-item w-full text-left" onClick={() => { setAccountSheetOpen(false); setPwdModalOpen(true); }}>
                                                <span className="card-icon" style={passwordIconStyle}>
                                                    <KeyRound size={22} strokeWidth={1.75} />
                                                </span>
                                                <span className="settings-tools-menu-copy">
                                                    <span className="menu-label appearance-menu-item-label">修改密码</span>
                                                    <span className="menu-desc settings-tools-menu-desc">需验证当前密码</span>
                                                </span>
                                                <span className="menu-right"><PearlSymbol name="chevron" size={17} strokeWidth={2.2} className="ps-row-chevron" /></span>
                                            </button>
                                            <button type="button" className="menu-item settings-cell settings-tools-menu-item w-full text-left" onClick={() => { setAccountSheetOpen(false); setConfirmLogout(true); }}>
                                                <span className="card-icon" style={logoutIconStyle}>
                                                    <LogOut size={22} strokeWidth={1.75} />
                                                </span>
                                                <span className="settings-tools-menu-copy">
                                                    <span className="menu-label appearance-menu-item-label" style={{ color: "var(--c-danger)" }}>退出登录</span>
                                                    <span className="menu-desc settings-tools-menu-desc">退出后需重新输入用户名和密码</span>
                                                </span>
                                                <span className="menu-right"><PearlSymbol name="chevron" size={17} strokeWidth={2.2} className="ps-row-chevron" /></span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {pwdModalOpen && (
                            <div className="modal-overlay modal-overlay-bottom" data-ui="modal" onClick={closePwdModal}>
                                <div className="modal-sheet" data-ui="modal-sheet" onClick={event => event.stopPropagation()}>
                                    <div className="modal-header" data-ui="modal-header">
                                        <button className="modal-header-btn modal-header-btn-muted" onClick={closePwdModal} disabled={pwdBusy}><X size={18} /></button>
                                        <h3 className="modal-title">修改密码</h3>
                                        <button className="modal-header-btn modal-header-btn-action" onClick={() => void handleChangePassword()} disabled={pwdBusy}>
                                            {pwdBusy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                        </button>
                                    </div>
                                    <div className="modal-body" data-ui="modal-body">
                                        <div className="flex flex-col gap-3 px-1">
                                            <input type="password" className="ui-input" placeholder="当前密码" autoComplete="current-password"
                                                value={oldPwd} onChange={event => setOldPwd(event.target.value)} />
                                            <input type="password" className="ui-input" placeholder="新密码（至少 6 位）" autoComplete="new-password"
                                                value={newPwd} onChange={event => setNewPwd(event.target.value)} />
                                            <input type="password" className="ui-input" placeholder="确认新密码" autoComplete="new-password"
                                                value={confirmPwd} onChange={event => setConfirmPwd(event.target.value)} />
                                            {pwdError ? <p className="ts-12" style={{ color: "var(--c-danger)" }}>{pwdError}</p> : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {confirmLogout && (
                            <ConfirmDialog
                                title="退出登录"
                                message={`当前账号 @${account.username}。退出后需要重新输入用户名和密码才能登录，密码无法找回，请确认已牢记。`}
                                icon={LogOut}
                                variant="danger"
                                confirmLabel="退出登录"
                                onConfirm={() => { setConfirmLogout(false); void logout(); }}
                                onCancel={() => setConfirmLogout(false)}
                            />
                        )}
                    </div>
                )}

                {currentPage !== "main" && (
                    // shrink-0：page-body 是 flex 容器，包裹层默认可压缩——内容超一屏时会被压到
                    // 恰好一屏高、卡片从中溢出，底部 padding 落不到内容末尾，最后一张卡贴死滚动边界
                    //（iOS 底部工具栏/安全区一盖就"没放下又滚不动"）。尾部留白 = 原 pb-8 + 安全区。
                    <div className="block min-h-full shrink-0 box-border" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))" }}>
                        {renderSubPage()}
                    </div>
                )}

                {/* 悬浮球 sheet 由首页与「辅助功能」子页共同触发，挂在 PageShell 根部 */}
                {floatingDockSheetOpen && (
                    <div className="modal-overlay modal-overlay-bottom" data-ui="modal" onClick={() => setFloatingDockSheetOpen(false)}>
                        <div className="modal-sheet" data-ui="modal-sheet" onClick={event => event.stopPropagation()}>
                            <div className="modal-header" data-ui="modal-header">
                                <span style={{ width: 44 }} />
                                <h3 className="modal-title">悬浮球设置</h3>
                                <button className="modal-header-btn modal-header-btn-muted" onClick={() => setFloatingDockSheetOpen(false)} aria-label="关闭"><X size={18} /></button>
                            </div>
                            <div className="modal-body modal-body-tight" data-ui="modal-body">
                                <div className="menu-group settings-group">
                                    <div className="menu-item settings-cell settings-tools-menu-item">
                                        <span className="card-icon card-icon-glass">
                                            <PearlSymbol name="general" size={20} strokeWidth={1.8} />
                                        </span>
                                        <span className="settings-tools-menu-copy">
                                            <span className="menu-label appearance-menu-item-label">贴边半透明收拢模式</span>
                                        </span>
                                        <span className="menu-right settings-tools-menu-toggle">
                                            <Toggle checked={floatingDockEnabled} onChange={handleFloatingDockChange} className="settings-toggle-control" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </PageShell>
        </SettingsContext.Provider>
    );
}
