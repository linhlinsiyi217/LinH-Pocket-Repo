"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, createContext, type CSSProperties, type ReactNode } from "react";
import { Accessibility, ArrowLeftRight, Bell, Check, ChevronRight, CloudUpload, Eye, HardDrive, KeyRound, Loader2, LockKeyhole, LogOut, Palette, Search, SlidersHorizontal, Sparkles, SunMedium, UserCircle, Users, Volume2, X } from "lucide-react";
import { ConfirmDialog } from "./ui/modal";
import { OPEN_CHANGELOG_EVENT, useUpdateUnread } from "./update-notice";
import { APP_VERSION } from "@/lib/version-info";
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
import { GlassIcon } from "./ui/glass-icon";
import { Toggle } from "./ui/form";
import { loadChatAppSettings, saveChatAppSettings } from "@/lib/chat-storage";
import { loadKeepAlive, saveKeepAlive } from "@/lib/weixin-storage";
import { BINDING_ACCENTS, CONTENT_APP_ACCENTS } from "@/lib/ui-accent-colors";
import { SETTINGS_DEEP_LINK_EVENT, type SettingsDeepLink } from "./settings/settings-deep-link";
import { searchSettings } from "./settings/settings-search";

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
    | "apiHub"           // 角色与创作 → API 与模型（二级聚合页）
    | "appearance"       // 外观与主题（T4 legacy slot，T5 替换）
    | "worldCharacters"  // 角色与世界（T4 legacy slot，T6 替换）
    | "worldResources"   // 资源库（T4 legacy slot，T7 替换；tab=memory/vn_assets）
    | "vision"           // 视觉识别（T10 落地）
    | "lock"             // 锁屏与状态栏（T12 落地，T4 内含密码入口）
    | "notifications"    // 通知与后台（T12 落地，T4 含后台保活）
    | "display"          // 显示与亮度（规划中占位）
    | "sound"            // 声音与触感（规划中占位）
    | "mascot"           // AI 与全局助手（T8/T9 落地）
    | "accessibility"    // 辅助功能（真实开关页）
    | "general";         // 通用（更新日志等）

/** 旧独立 App 全屏兼容槽页 id（不包设置 PageShell，由旧组件自带壳）。 */
const LEGACY_SLOT_PAGES = new Set<string>(["appearance", "worldCharacters", "worldResources"]);

type GroupItem = {
    page: SubPage;
    tab?: string;
    label: string;
    desc: string;
    iconColor: string;
    glass?: string;
    lucide?: typeof Palette;
    adminOnly?: boolean;
};

type SettingsGroup = {
    id: string;
    title: string;
    items: GroupItem[];
};

// ── 5 大分组（FR-5）────────────────────────────────────────────
const SETTINGS_GROUPS: SettingsGroup[] = [
    {
        id: "appearance",
        title: "外观",
        items: [
            { page: "appearance", label: "外观与主题", desc: "深浅色 · 壁纸 · 图标 · 字体", iconColor: BINDING_ACCENTS.preset, glass: "palette" },
            { page: "lock", label: "锁屏与状态栏", desc: "锁屏壁纸、组件与密码", iconColor: BINDING_ACCENTS.api, glass: "status-bar" },
            { page: "display", label: "显示与亮度", desc: "亮度与显示偏好", iconColor: "#F59E0B", lucide: SunMedium },
            { page: "sound", label: "声音与触感", desc: "提示音与震动", iconColor: BINDING_ACCENTS.voice, lucide: Volume2 },
        ],
    },
    {
        id: "create",
        title: "角色与创作",
        items: [
            { page: "worldCharacters", label: "角色与世界", desc: "角色档案与世界卷宗", iconColor: BINDING_ACCENTS.memory, lucide: Users },
            { page: "worldResources", label: "资源库", desc: "记忆库 · 漫卷场景与立绘", iconColor: CONTENT_APP_ACCENTS.vn, glass: "vn-assets" },
            { page: "worldResources", tab: "memory", label: "记忆与上下文", desc: "角色记忆档案", iconColor: BINDING_ACCENTS.memory, glass: "memory" },
            { page: "mascot", label: "AI 与全局助手", desc: "小淮宝与工坊助手能力", iconColor: BINDING_ACCENTS.preset, lucide: Sparkles },
            { page: "apiHub", label: "API 与模型", desc: "对话 · 语音 · 图像 · 视觉", iconColor: BINDING_ACCENTS.api, glass: "api" },
            { page: "agentComputer", label: "角色电脑", desc: "云端小电脑（自部署）", iconColor: BINDING_ACCENTS.memory, glass: "agent-computer" },
        ],
    },
    {
        id: "rules",
        title: "AI 与规则",
        items: [
            { page: "presets", label: "预设", desc: "角色预设", iconColor: BINDING_ACCENTS.preset, glass: "presets" },
            { page: "worldbook", label: "世界书", desc: "触发式设定与上下文", iconColor: BINDING_ACCENTS.worldBook, glass: "worldbook" },
            { page: "regex", label: "正则规则", desc: "文本替换", iconColor: BINDING_ACCENTS.regex, glass: "regex" },
            { page: "binding", label: "配置绑定", desc: "默认、角色与应用绑定", iconColor: BINDING_ACCENTS.identity, glass: "binding" },
        ],
    },
    {
        id: "data",
        title: "数据",
        items: [
            { page: "data", label: "数据与存储", desc: "本地数据管理", iconColor: BINDING_ACCENTS.api, glass: "data" },
            { page: "data", tab: "export", label: "导入与导出", desc: "备份、迁移与恢复", iconColor: BINDING_ACCENTS.worldBook, lucide: ArrowLeftRight },
            { page: "cloud", label: "云服务与备份", desc: "备份 / 微信 / 推送", iconColor: BINDING_ACCENTS.api, lucide: CloudUpload },
        ],
    },
    {
        id: "system",
        title: "系统",
        items: [
            { page: "weixin", label: "微信接入", desc: "iLink Bot", iconColor: CONTENT_APP_ACCENTS.chat, glass: "weixin" },
            { page: "notifications", label: "通知与后台", desc: "通知、保活与推送", iconColor: CONTENT_APP_ACCENTS.chat, lucide: Bell },
            { page: "toolbox", label: "工具箱", desc: "聊天外部工具调用", iconColor: BINDING_ACCENTS.voice, glass: "toolbox" },
            { page: "accessibility", label: "辅助功能", desc: "时间感知 · 悬浮球 · 快捷操作", iconColor: BINDING_ACCENTS.identity, lucide: Accessibility },
            { page: "general", label: "通用", desc: "更新日志与版本", iconColor: BINDING_ACCENTS.memory, lucide: SlidersHorizontal },
            { page: "identity", label: "用户身份", desc: "个人信息", iconColor: BINDING_ACCENTS.identity, glass: "identity" },
            { page: "about", label: "关于与声明", desc: "版本与协议", iconColor: BINDING_ACCENTS.memory, glass: "about" },
            { page: "moderation", label: "管理中心", desc: "举报 · 审核 · 封禁", iconColor: BINDING_ACCENTS.regex, glass: "moderation", adminOnly: true },
        ],
    },
];

const ALL_GROUP_ITEMS: GroupItem[] = SETTINGS_GROUPS.flatMap(g => g.items);

/**
 * 搜索命中但首页分组里没有独立卡片的子页（它们挂在聚合页内，如 API 与模型下的
 * api/voice/imageGeneration/vision），搜索结果仍展示对应真实图标。
 */
const SEARCH_ICON_FALLBACK: Partial<Record<string, Pick<GroupItem, "glass" | "lucide" | "iconColor">>> = {
    api: { glass: "api", iconColor: BINDING_ACCENTS.api },
    voice: { glass: "voice", iconColor: BINDING_ACCENTS.voice },
    imageGeneration: { glass: "image-generation", iconColor: BINDING_ACCENTS.api },
    vision: { lucide: Eye, iconColor: BINDING_ACCENTS.memory },
};

const accountIconStyle = {
    "--icon-color": BINDING_ACCENTS.identity,
} as CSSProperties;

const passwordIconStyle = {
    "--icon-color": BINDING_ACCENTS.api,
} as CSSProperties;

const logoutIconStyle = {
    "--icon-color": "var(--c-danger)",
} as CSSProperties;

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 设备卡片：只展示可真实读取的信息，不仿 Apple ID 造假。 */
function DeviceInfoCard() {
    const [info, setInfo] = useState<{ platform: string; viewport: string; mode: string; storage: string }>({
        platform: "—",
        viewport: "—",
        mode: "—",
        storage: "—",
    });

    useEffect(() => {
        const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
        const platform = nav.userAgentData?.platform || nav.platform || "未知设备";
        const viewport = `${window.innerWidth} × ${window.innerHeight}`;
        const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
        const mode = standalone ? "PWA 独立应用" : "浏览器中运行";
        setInfo(prev => ({ ...prev, platform, viewport, mode }));

        let cancelled = false;
        void navigator.storage?.estimate?.().then(est => {
            if (cancelled || !est) return;
            const used = est.usage ?? 0;
            const quota = est.quota ?? 0;
            setInfo(prev => ({
                ...prev,
                storage: quota > 0 ? `${formatBytes(used)} / ${formatBytes(quota)}` : formatBytes(used),
            }));
        }).catch(() => { /* 隐私模式等场景可能拒绝，保持 "—" */ });
        return () => { cancelled = true; };
    }, []);

    const rows: Array<[string, string]> = [
        ["设备", info.platform],
        ["屏幕", info.viewport],
        ["运行方式", info.mode],
        ["本机存储", info.storage],
        ["系统版本", `LinH Pocket v${APP_VERSION}`],
    ];

    return (
        <div className="settings-device-card app-card">
            <div className="settings-device-head">
                <span className="settings-device-avatar"><HardDrive size={20} strokeWidth={1.8} /></span>
                <span className="settings-device-copy">
                    <span className="settings-device-name">本机</span>
                    <span className="settings-device-sub">设备与运行环境</span>
                </span>
            </div>
            <dl className="settings-device-rows">
                {rows.map(([k, v]) => (
                    <div className="settings-device-row" key={k}>
                        <dt>{k}</dt>
                        <dd title={v}>{v}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

/** 诚实占位页：后续模块才落地的能力，明确标注，不放假开关。 */
function ComingSoonPage({ title, lines }: { title: string; lines: string[] }) {
    return (
        <div className="settings-soon">
            <div className="settings-soon-icon"><Sparkles size={22} strokeWidth={1.6} /></div>
            <div className="settings-soon-title">{title}</div>
            {lines.map(line => <p className="settings-soon-desc" key={line}>{line}</p>)}
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

    // ── 开关行（辅助功能 / 通知与后台共用）──
    const toggleRow = (icon: ReactNode, label: string, desc: string, checked: boolean, onChange: (next: boolean) => void) => (
        <div className="app-card card-featured settings-toggle-card" key={label}>
            <span className="card-icon card-icon-glass">{icon}</span>
            <div className="card-featured-body">
                <div className="card-featured-label">{label}</div>
                <div className="card-featured-desc">{desc}</div>
            </div>
            <Toggle checked={checked} onChange={onChange} className="settings-toggle-control" />
        </div>
    );

    const renderApiHub = () => (
        <div className="page-menu" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="app-card card-featured" onClick={() => navigate("api")}>
                <span className="card-icon card-icon-glass"><GlassIcon name="api" /></span>
                <div className="card-featured-body">
                    <div className="card-featured-label">API 设置</div>
                    <div className="card-featured-desc">大模型对话接口</div>
                </div>
                <ChevronRight size={18} className="settings-account-chevron" />
            </button>
            <button type="button" className="app-card card-featured" onClick={() => navigate("voice")}>
                <span className="card-icon card-icon-glass"><GlassIcon name="voice" /></span>
                <div className="card-featured-body">
                    <div className="card-featured-label">语音 API</div>
                    <div className="card-featured-desc">语音合成</div>
                </div>
                <ChevronRight size={18} className="settings-account-chevron" />
            </button>
            <button type="button" className="app-card card-featured" onClick={() => navigate("imageGeneration")}>
                <span className="card-icon card-icon-glass"><GlassIcon name="image-generation" /></span>
                <div className="card-featured-body">
                    <div className="card-featured-label">图像生成 API</div>
                    <div className="card-featured-desc">模型、参考图与提示词</div>
                </div>
                <ChevronRight size={18} className="settings-account-chevron" />
            </button>
            <button type="button" className="app-card card-featured" onClick={() => navigate("vision")}>
                <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.memory } as CSSProperties}><Eye size={22} strokeWidth={1.75} /></span>
                <div className="card-featured-body">
                    <div className="card-featured-label">视觉识别</div>
                    <div className="card-featured-desc">图片与文件的 AI 视觉识别</div>
                </div>
                <ChevronRight size={18} className="settings-account-chevron" />
            </button>
        </div>
    );

    const renderAccessibility = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {toggleRow(<GlassIcon name="time-aware" />, "真实时间感知", "控制全局历史事件流中是否注入时间戳", timeAware, handleTimeAwareChange)}
            {toggleRow(<GlassIcon name="prompt-viewer" />, "提示词查看器", "开启后显示悬浮按钮，可查看当前提示词", promptViewerEnabled, handlePromptViewerChange)}
            {toggleRow(<GlassIcon name="quick-action" />, "快捷操作", "快速切换 API 与世界书", quickActionEnabled, handleQuickActionChange)}
            <button type="button" className="app-card card-featured" onClick={() => setFloatingDockSheetOpen(true)}>
                <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.worldBook } as CSSProperties}><SlidersHorizontal size={20} strokeWidth={1.8} /></span>
                <div className="card-featured-body">
                    <div className="card-featured-label">悬浮球偏好设置</div>
                    <div className="card-featured-desc">贴边半透明收拢模式{floatingDockEnabled ? "（已开启）" : ""}</div>
                </div>
                <ChevronRight size={18} className="settings-account-chevron" />
            </button>
        </div>
    );

    const renderNotifications = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {toggleRow(<GlassIcon name="keep-alive" />, "后台保活", "切到后台时尽量保持网页运行，主动消息与轮询不中断", keepAlive, handleKeepAliveChange)}
            <div className="settings-soon settings-soon-inline">
                <div className="settings-soon-title">锁屏通知中心</div>
                <p className="settings-soon-desc">锁屏 AI 消息通知、通知中心与离线推送状态展示将在后续版本的锁屏模块中开放。云推送部署仍可在「数据 → 云服务与备份」完成。</p>
            </div>
        </div>
    );

    const renderGeneral = () => (
        <div className="menu-group settings-group">
            <button
                type="button"
                className="menu-item settings-cell settings-tools-menu-item w-full text-left"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHANGELOG_EVENT))}
            >
                <span className="card-icon card-icon-glass">
                    <Sparkles size={22} strokeWidth={1.75} />
                </span>
                <span className="settings-tools-menu-copy">
                    <span className="menu-label appearance-menu-item-label">更新日志</span>
                    <span className="menu-desc settings-tools-menu-desc">版本 v{APP_VERSION}</span>
                </span>
                <span className="menu-right settings-update-row-right">
                    {updateUnread ? <span className="update-dot update-dot-row" aria-label="有新版本" /> : null}
                    <ChevronRight size={17} className="settings-account-chevron" />
                </span>
            </button>
        </div>
    );

    const renderLock = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
                type="button"
                className="menu-item settings-cell settings-tools-menu-item w-full text-left"
                onClick={() => navigate("lockPasscode")}
            >
                <span className="card-icon card-icon-glass">
                    <LockKeyhole size={20} strokeWidth={1.8} />
                </span>
                <span className="settings-tools-menu-copy">
                    <span className="menu-label appearance-menu-item-label">锁屏密码</span>
                    <span className="menu-desc settings-tools-menu-desc">4 位 / 6 位数字密码，上滑解锁保护</span>
                </span>
                <span className="menu-right settings-update-row-right">
                    <ChevronRight size={17} className="settings-account-chevron" />
                </span>
            </button>
            <div className="settings-soon settings-soon-inline">
                <div className="settings-soon-title">锁屏壁纸与锁屏组件</div>
                <p className="settings-soon-desc">跟随桌面壁纸 / 自定义壁纸、锁屏 Widget 与状态栏细项将在后续版本的锁屏模块中开放。</p>
            </div>
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
                return <DataManagement onNotice={onNotice} />;
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
            case "general":
                return renderGeneral();
            case "lock":
                return renderLock();
            case "vision":
                return <ComingSoonPage title="视觉识别" lines={["文件智能层与视觉识别 Provider 将在后续版本开放，用于图片理解、截图文字识别与扫描件解析。"]} />;
            case "mascot":
                return <ComingSoonPage title="AI 与全局助手" lines={["小淮宝的全局助手能力与系统动作设置将在后续版本开放。工坊仍可从桌面图标直接进入。"]} />;
            case "display":
                return <ComingSoonPage title="显示与亮度" lines={["深浅色模式与壁纸当前可在「外观 → 外观与主题」中调整，独立的亮度偏好规划在后续版本提供。"]} />;
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

    const renderGroupItemIcon = (item: GroupItem) => {
        if (item.glass) return <GlassIcon name={item.glass} />;
        const LucideIcon = item.lucide ?? Palette;
        return <LucideIcon size={22} strokeWidth={1.75} />;
    };

    const searchResults = searchQuery.trim() ? searchSettings(searchQuery) : [];

    return (
        <SettingsContext.Provider value={{ setSubpageTitle, setOverrideBack, setSubpageRightAction }}>
            <PageShell title={title} onBack={handleBack} rightAction={currentPage !== "main" ? subpageRightActions[currentPage] : undefined} bodyRef={pageBodyRef}>
                {currentPage === "main" && (
                    <div className="page-menu settings-main-menu">
                        {!selfHostedMode && (
                            <button type="button" className="settings-account-card" onClick={() => setAccountSheetOpen(true)}>
                                <span className="settings-account-avatar"><GlassIcon name="account" /></span>
                                <span className="settings-account-copy">
                                    <span className="settings-account-name">{account.displayName || account.username}</span>
                                    <span className="settings-account-sub">账号、密码与登录</span>
                                </span>
                                <ChevronRight size={18} className="settings-account-chevron" />
                            </button>
                        )}
                        <DeviceInfoCard />

                        {/* 顶部搜索：本地索引，标题/副标题/关键词匹配 */}
                        <div className="settings-search-wrap">
                            <Search size={16} strokeWidth={1.8} className="settings-search-icon" aria-hidden="true" />
                            <input
                                type="search"
                                className="ui-input settings-search-input"
                                placeholder="搜索设置（外观、锁屏、世界书、API、推送…）"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoComplete="off"
                            />
                            {searchQuery && (
                                <button type="button" className="settings-search-clear" aria-label="清除搜索" onClick={() => setSearchQuery("")}>
                                    <X size={14} strokeWidth={2} />
                                </button>
                            )}
                        </div>

                        {searchQuery.trim() ? (
                            <div className="settings-search-results">
                                {searchResults.length === 0 ? (
                                    <p className="settings-search-empty">没有找到与「{searchQuery.trim()}」相关的设置</p>
                                ) : (
                                    <div className="card-grid" style={{ marginTop: 10 }}>
                                        {searchResults.map(entry => {
                                            const iconSpec = ALL_GROUP_ITEMS.find(i => i.page === entry.page && i.tab === entry.tab)
                                                ?? SEARCH_ICON_FALLBACK[entry.page]
                                                ?? { iconColor: BINDING_ACCENTS.api, lucide: Sparkles };
                                            const LucideIcon = iconSpec.lucide;
                                            return (
                                                <button
                                                    type="button"
                                                    className="app-card card-card"
                                                    key={`${entry.page}:${entry.tab ?? ""}`}
                                                    onClick={() => navigate(entry.page, entry.tab)}
                                                >
                                                    <span
                                                        className={`card-icon${iconSpec.glass ? " card-icon-glass" : ""}`}
                                                        style={iconSpec.glass ? undefined : { "--icon-color": iconSpec.iconColor } as CSSProperties}
                                                    >
                                                        {iconSpec.glass
                                                            ? <GlassIcon name={iconSpec.glass} />
                                                            : LucideIcon
                                                                ? <LucideIcon size={22} strokeWidth={1.75} />
                                                                : <Sparkles size={22} strokeWidth={1.75} />}
                                                    </span>
                                                    <span className="card-card-body">
                                                        <span className="card-label">{entry.title}</span>
                                                        <span className="card-desc">{entry.desc}</span>
                                                    </span>
                                                    <ChevronRight size={16} strokeWidth={1.5} className="card-card-chevron" aria-hidden="true" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            SETTINGS_GROUPS.map(group => {
                                const items = group.items.filter(item => !item.adminOnly || isAdmin);
                                if (items.length === 0) return null;
                                return (
                                    <div key={group.id} className="settings-group-section">
                                        <h3 className="settings-menu-section-title text-label">{group.title}</h3>
                                        <div className="card-grid" style={{ marginTop: 10 }}>
                                            {items.map(item => (
                                                <button
                                                    type="button"
                                                    className="app-card card-card"
                                                    key={`${item.page}:${item.tab ?? ""}`}
                                                    onClick={() => navigate(item.page, item.tab)}
                                                >
                                                    <span
                                                        className={`card-icon${item.glass ? " card-icon-glass" : ""}`}
                                                        style={item.glass ? undefined : { "--icon-color": item.iconColor } as CSSProperties}
                                                    >
                                                        {renderGroupItemIcon(item)}
                                                    </span>
                                                    <span className="card-card-body">
                                                        <span className="card-label">{item.label}</span>
                                                        <span className="card-desc">{item.desc}</span>
                                                    </span>
                                                    <ChevronRight size={16} strokeWidth={1.5} className="card-card-chevron" aria-hidden="true" />
                                                </button>
                                            ))}
                                        </div>
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
                                                <span className="menu-right"><ChevronRight size={17} className="settings-account-chevron" /></span>
                                            </button>
                                            <button type="button" className="menu-item settings-cell settings-tools-menu-item w-full text-left" onClick={() => { setAccountSheetOpen(false); setConfirmLogout(true); }}>
                                                <span className="card-icon" style={logoutIconStyle}>
                                                    <LogOut size={22} strokeWidth={1.75} />
                                                </span>
                                                <span className="settings-tools-menu-copy">
                                                    <span className="menu-label appearance-menu-item-label" style={{ color: "var(--c-danger)" }}>退出登录</span>
                                                    <span className="menu-desc settings-tools-menu-desc">退出后需重新输入用户名和密码</span>
                                                </span>
                                                <span className="menu-right"><ChevronRight size={17} className="settings-account-chevron" /></span>
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
                    <div className="block min-h-full shrink-0 p-4 box-border" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))" }}>
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
                                            <SlidersHorizontal size={20} strokeWidth={1.8} />
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
