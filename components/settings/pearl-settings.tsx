"use client";

/* ═══════════════════════════════════════════════════════════
   Pearl Settings 共享原语(preview + production 共用)
   - 由 T6.5 Preview 确认通过后迁移自 components/settings-preview/
   - 供设置首页 / 搜索 / 通知与提醒 / 显示与亮度 / 二级聚合页复用

   结构契约(验收点 R6):
   .ps-scroll
     .ps-section-title(可选)
     .ps-group                 ← 一个 section 才是一块 Pearl Glass 容器
       .ps-account / .ps-row  ← section 内连续标准 row(不独立浮起)
   ═══════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from "react";
import { PearlSymbol, PearlSymbolTile, type PearlSymbolName, type PearlSymbolTone } from "@/components/ui/pearl-symbol";

/* ── 设备外框 / 屏幕 / 状态栏(preview 专用,production 用 .page-shell token scope) ── */

export function PearlScreen({
  colorMode,
  children,
  screenStyle,
  enterKey,
}: {
  colorMode: "light" | "dark";
  children: ReactNode;
  /** 本地外观令牌演示(preview 滑杆写入;production 由 Bridge 提供) */
  screenStyle?: CSSProperties;
  enterKey?: string;
}) {
  return (
    <div className="ps-device">
      <div data-color-mode={colorMode} style={{ height: "100%" }}>
        <div
          className={`phone-shell ps-screen${enterKey ? " ps-screen-enter" : ""}`}
          style={screenStyle}
          key={enterKey}
        >
          <PearlStatusBar />
          {children}
        </div>
      </div>
    </div>
  );
}

export function PearlStatusBar() {
  return (
    <div className="ps-status-bar">
      <span className="ps-status-time">9:41</span>
      <span className="ps-dynamic-island" aria-hidden="true" />
      <span className="ps-status-icons" aria-hidden="true">
        <PearlSymbol name="cellular" size={17} strokeWidth={2} />
        <PearlSymbol name="wifi" size={17} strokeWidth={2} />
        <PearlSymbol name="battery" size={20} strokeWidth={1.6} />
      </span>
    </div>
  );
}

/* ── section / group / row ── */

export function SettingsSectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="ps-section-title">{children}</h3>;
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  return <div className="ps-group">{children}</div>;
}

export function SettingsRow({
  symbol,
  tone = "mono",
  title,
  sub,
  value,
  showChevron = true,
  onClick,
  static: isStatic,
  trailing,
}: {
  symbol: PearlSymbolName;
  tone?: PearlSymbolTone;
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  static?: boolean;
  /** 右侧自定义内容(优先于 value/chevron),如开关 */
  trailing?: ReactNode;
}) {
  const content = (
    <>
      <PearlSymbolTile name={symbol} tone={tone} />
      <span className="ps-row-copy">
        <span className="ps-row-title">{title}</span>
        {sub ? <span className="ps-row-sub">{sub}</span> : null}
      </span>
      {trailing ?? (
        <>
          {value ? <span className="ps-row-value">{value}</span> : null}
          {showChevron ? <PearlSymbol name="chevron" size={17} strokeWidth={2.2} className="ps-row-chevron" /> : null}
        </>
      )}
    </>
  );
  if (isStatic && !onClick) {
    return <div className="ps-row ps-row--static">{content}</div>;
  }
  return (
    <button type="button" className="ps-row" onClick={onClick}>
      {content}
    </button>
  );
}

/* ── iOS 单色开关 ── */

export function SettingsToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="ps-switch"
      data-checked={checked ? "true" : "false"}
      onClick={() => onChange(!checked)}
    >
      <span className="ps-switch-knob" />
    </button>
  );
}

export function SettingsToggleRow({
  symbol,
  tone = "mono",
  title,
  sub,
  checked,
  onChange,
}: {
  symbol: PearlSymbolName;
  tone?: PearlSymbolTone;
  title: ReactNode;
  sub?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <SettingsRow
      symbol={symbol}
      tone={tone}
      title={title}
      sub={sub}
      showChevron={false}
      static
      trailing={<SettingsSwitch checked={checked} onChange={onChange} label={String(title)} />}
    />
  );
}

function SettingsSwitch(props: { checked: boolean; onChange: (n: boolean) => void; label: string }) {
  return <SettingsToggle {...props} />;
}

/* ── account row ── */

export function AccountRow({ name, sub, onClick }: { name: string; sub: string; onClick?: () => void }) {
  return (
    <button type="button" className="ps-account" onClick={onClick}>
      <span className="ps-account-avatar" aria-hidden="true">
        <PearlSymbol name="user" size={30} strokeWidth={1.6} />
      </span>
      <span className="ps-row-copy">
        <span className="ps-account-name">{name}</span>
        <span className="ps-account-sub">{sub}</span>
      </span>
      <PearlSymbol name="chevron" size={18} strokeWidth={2.2} className="ps-row-chevron" />
    </button>
  );
}

/* ── 大标题 + iOS 搜索框 ── */

export function SettingsLargeTitle({ children }: { children: ReactNode }) {
  return <h1 className="ps-large-title">{children}</h1>;
}

export function SettingsSearchBar({
  value,
  onChange,
  placeholder = "搜索",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="ps-search">
      <PearlSymbol name="search" size={16} strokeWidth={2} />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="清除搜索"
          onClick={() => onChange("")}
          style={{ display: "inline-flex", color: "inherit" }}
        >
          <PearlSymbol name="close" size={15} strokeWidth={2.2} />
        </button>
      ) : null}
    </label>
  );
}

/* ── 二级页导航栏(preview 用;production 用 PageShell) ── */

export function SettingsNavBar({
  title,
  backLabel = "设置",
  onBack,
  right,
}: {
  title: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="ps-navbar">
      <button type="button" className="ps-navbar-back" onClick={onBack} aria-label={`返回${backLabel}`}>
        <PearlSymbol name="back" size={20} strokeWidth={2.2} />
        <span>{backLabel}</span>
      </button>
      <span className="ps-navbar-title">{title}</span>
      <span className="ps-navbar-right">{right}</span>
    </div>
  );
}

/* ── 搜索结果 row(symbol + 标题 + 路径副标题 + chevron) ── */

export function SettingsSearchRow({
  symbol,
  title,
  path,
  onClick,
}: {
  symbol: PearlSymbolName;
  title: ReactNode;
  path: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="ps-row" onClick={onClick}>
      <PearlSymbol name={symbol} size={22} strokeWidth={1.7} style={{ color: "var(--ps-fg-secondary)", flexShrink: 0 }} />
      <span className="ps-row-copy">
        <span className="ps-row-title">{title}</span>
        <span className="ps-search-path">{path}</span>
      </span>
      <PearlSymbol name="chevron" size={17} strokeWidth={2.2} className="ps-row-chevron" />
    </button>
  );
}
