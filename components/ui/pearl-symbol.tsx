"use client";

/* ═══════════════════════════════════════════════════════════
   Pearl Symbol Registry（T6.5 全局统一图标体系）

   设计语言（参考 SF Symbols 视觉重量，不复制其资源）：
   - 统一 24×24 viewBox；
   - 统一 stroke-width（默认 1.7）、round linecap / round linejoin；
   - 单色 currentColor：颜色由外层 UI（PearlSymbolTile / 文本色）决定，
     SVG 自身不烘色、不写阴影；
   - 矢量基础来自项目已引入的 lucide-react（ISC 授权），在此做统一封装
     与命名收口；后续桌面 / Dock / 锁屏 / 控制中心 / 通知全部消费本注册表，
     禁止各页面继续自挑图标风格。
   ═══════════════════════════════════════════════════════════ */

import {
  Accessibility,
  Archive,
  ArrowLeftRight,
  BatteryMedium,
  Bell,
  Bluetooth,
  BookOpen,
  Box,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  Download,
  Ellipsis,
  Eye,
  Film,
  Flashlight,
  Folder,
  Globe,
  HardDrive,
  Info,
  Link as LinkIcon,
  Lock,
  MessageCircle,
  MessageSquare,
  Mic,
  Moon,
  Palette,
  PanelTop,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsGear,
  SignalHigh,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  Vibrate,
  Volume2,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

export type PearlSymbolName =
  // ── Settings / 系统 ──
  | "settings" | "appearance" | "brightness" | "lock" | "bell"
  | "sound" | "notification-settings" | "banner" | "vibrate"
  // ── 角色与世界 ──
  | "character" | "characters" | "world" | "book" | "archive"
  | "resources" | "memory"
  // ── 连接与模型 ──
  | "api" | "voice" | "vision" | "wechat" | "background-notifications"
  // ── 数据 ──
  | "storage" | "import-export" | "cloud"
  // ── 系统 ──
  | "accessibility" | "general" | "about" | "user"
  // ── 控制中心 / 状态栏 ──
  | "wifi" | "bluetooth" | "cellular" | "flashlight" | "focus"
  | "battery"
  // ── 通用导航与操作 ──
  | "search" | "back" | "chevron" | "more" | "edit" | "close"
  | "check" | "warning" | "sparkles" | "plus"
  | "update" | "download" | "wifi-off" | "clock"
  // ── 通知媒体（G2-G6） ──
  | "message" | "video" | "link" | "upload" | "folder-open"
  | "play" | "stop" | "trash";

const REGISTRY: Record<PearlSymbolName, LucideIcon> = {
  settings: SettingsGear,
  appearance: Palette,
  brightness: Sun,
  lock: Lock,
  bell: Bell,
  sound: Volume2,
  "notification-settings": Bell,
  banner: PanelTop,
  vibrate: Vibrate,
  character: User,
  characters: Users,
  world: Globe,
  book: BookOpen,
  archive: Archive,
  resources: Box,
  memory: Brain,
  api: Cpu,
  voice: Mic,
  vision: Eye,
  wechat: MessageCircle,
  "background-notifications": Bell,
  storage: HardDrive,
  "import-export": ArrowLeftRight,
  cloud: Cloud,
  accessibility: Accessibility,
  general: SlidersHorizontal,
  about: Info,
  user: User,
  wifi: Wifi,
  bluetooth: Bluetooth,
  cellular: SignalHigh,
  flashlight: Flashlight,
  focus: Moon,
  battery: BatteryMedium,
  search: Search,
  back: ChevronLeft,
  chevron: ChevronRight,
  more: Ellipsis,
  edit: Pencil,
  close: X,
  check: Check,
  warning: TriangleAlert,
  sparkles: Sparkles,
  plus: Plus,
  update: RefreshCw,
  download: Download,
  "wifi-off": WifiOff,
  clock: Clock,
  message: MessageSquare,
  video: Film,
  link: LinkIcon,
  upload: Upload,
  "folder-open": Folder,
  play: Play,
  stop: Square,
  trash: Trash2,
};

export type PearlSymbolProps = {
  name: PearlSymbolName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** 无障碍标签；装饰性图标留空（aria-hidden）。 */
  label?: string;
};

export function PearlSymbol({
  name,
  size = 24,
  strokeWidth = 1.7,
  className,
  style,
  label,
}: PearlSymbolProps) {
  const Icon = REGISTRY[name] ?? SettingsGear;
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

/**
 * Symbol tile外底色策略。
 * - mono：黑白灰 Pearl 灰（默认，所有设置入口）
 * - wechat：品牌绿（唯一保留的品牌色入口）
 * - danger / success / warning：状态语义色（仅删除、成功、警告等）
 */
export type PearlSymbolTone = "mono" | "wechat" | "danger" | "success" | "warning";

export type PearlSymbolTileProps = {
  name: PearlSymbolName;
  tone?: PearlSymbolTone;
  /** 视觉边长（默认 30px，对齐 iOS Settings row icon 28~32）。 */
  size?: number;
  className?: string;
};

export function PearlSymbolTile({
  name,
  tone = "mono",
  size = 30,
  className,
}: PearlSymbolTileProps) {
  return (
    <span
      className={`ps-symbol-tile ps-symbol-tile--${tone}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
      aria-hidden="true"
    >
      <PearlSymbol name={name} size={Math.round(size * 0.62)} strokeWidth={1.8} />
    </span>
  );
}
