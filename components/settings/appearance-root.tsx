/* ═══════════════════════════════════════════════════════════
   外观与主题 · 共享根组件（v0.8.0 T5）
   设置→外观与主题 与 phone-theme-app 兼容薄壳 渲染的同一个组件。
   信息架构（Task 5）：
   - 主区 8 磁贴：浅色/深色、主题色、壁纸、图标、Widget、桌面、字体、玻璃风格
   - 高级外观 8 行：全局 CSS、CSS Variables、Pearl Glass 强度、
     边框、阴影、导入主题、导出主题、恢复默认
   storage key / cssOverrides / globalCustomCSS / 主题包格式一律不动。
   ═══════════════════════════════════════════════════════════ */
"use client";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Box,
  Download,
  Gauge,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import { GlassIcon } from "@/components/ui/glass-icon";
import { PageShell } from "@/components/ui/page-shell";
import { readPwaDisplayPreference, writePwaDisplayPreference } from "@/lib/pwa-display-mode";
import { normalizeThemeProfile } from "@/lib/theme-types";
import { BINDING_ACCENTS } from "@/lib/ui-accent-colors";
import { ConfirmDialog, ContentDialog } from "@/components/ui/modal";
import {
  createThemePackageBlob,
  installThemePackageFile,
  resetThemePackageState,
} from "@/lib/theme-package";
import {
  type AppearanceRootProps,
  type AppearanceSection,
} from "./appearance-shared";
import { DisplayColorPage } from "./appearance-display-page";
import { PalettePresetPage } from "./appearance-palette-page";
import { TextScalePage } from "./appearance-text-page";
import { GlobalCSSPage } from "./appearance-global-css-page";
import { IconSkinPage } from "./appearance-icon-page";
import { WallpaperPage } from "./appearance-wallpaper-page";
import { WidgetManagerPage } from "./appearance-widget-page";
import { GlassStylePage } from "./appearance-glass-page";

const SECTION_TITLES: Record<Exclude<AppearanceSection, "menu">, string> = {
  display: "显示与颜色",
  palette: "CSS Variables",
  wallpaper: "壁纸",
  icons: "图标",
  widgets: "桌面组件",
  case: "桌面",
  text: "字体",
  css: "全局 CSS",
  glass: "玻璃风格",
};

const THEME_SECTIONS = new Set<string>([
  "menu", "display", "palette", "wallpaper", "icons", "widgets", "glass", "case", "text", "css",
]);

function isThemeSection(value: string): value is AppearanceSection {
  return THEME_SECTIONS.has(value);
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const menuIconStyle = (color?: string): CSSProperties => ({
  "--icon-color": color ?? "var(--c-icon)",
} as CSSProperties);

/** 外观主磁贴定义（点击行为在 AppearanceRoot 内分派）。 */
type MainTileKey =
  | "display"
  | "accent"
  | "wallpaper"
  | "icons"
  | "widgets"
  | "case"
  | "text"
  | "glass";

const MAIN_TILES: Array<{
  key: MainTileKey;
  label: string;
  desc: string;
  glass?: string;
}> = [
  { key: "display", label: "浅色 / 深色", desc: "日间 · 夜间模式", glass: "time-aware" },
  { key: "accent", label: "主题色", desc: "全局主色调", glass: "palette" },
  { key: "wallpaper", label: "壁纸", desc: "桌面背景", glass: "wallpaper" },
  { key: "icons", label: "图标", desc: "应用图标 · Dock", glass: "icons" },
  { key: "widgets", label: "Widget", desc: "桌面小组件", glass: "widgets" },
  { key: "case", label: "桌面", desc: "状态栏 · 灵动岛", glass: "status-bar" },
  { key: "text", label: "字体", desc: "字号 · 自定义字体", glass: "text" },
  { key: "glass", label: "玻璃风格", desc: "玻璃强度 · 图标材质" },
];

/** 菜单行内 iOS 风格开关（与原外观菜单开关同款，不引入新色彩）。 */
function RowSwitch({ checked, onChange, ariaLabel }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label
      className="block w-10 h-[22px] cursor-pointer relative shrink-0 ml-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-full h-full rounded-[11px] m-0 outline-none"
        style={{
          appearance: "none",
          backgroundColor: checked ? "var(--c-success)" : "var(--c-page-body-bg)",
          transition: "0.2s",
        }}
      />
      <div className="absolute w-[18px] h-[18px] bg-white rounded-full top-[2px] pointer-events-none" style={{
        left: checked ? 20 : 2,
        transition: "0.2s",
        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
      }} />
    </label>
  );
}

export function AppearanceRoot({
  draft,
  onDraftChange,
  onApply,
  onClose,
  onNotice,
  widgets,
  onWidgetsChange,
  onDesktopThemeChange,
  pageIcons,
  iconSkins,
  wallpaperStyle,
}: AppearanceRootProps) {
  const [section, setSection] = useState<AppearanceSection>(() => {
    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem("mascot-theme-section");
      if (pending) {
        sessionStorage.removeItem("mascot-theme-section");
        return isThemeSection(pending) ? pending : "menu";
      }
    }
    return "menu";
  });
  // 从「主题色」磁贴进入显示页时，聚焦主色调面板
  const [accentFocus, setAccentFocus] = useState(false);
  const [showStatusBarAdjust, setShowStatusBarAdjust] = useState(false);
  const [systemBarShown, setSystemBarShown] = useState<boolean>(() => (typeof document !== "undefined" && readPwaDisplayPreference(document.cookie) === "standalone") || true);
  const [showTextAdjust, setShowTextAdjust] = useState(false);
  const [showThemeTransfer, setShowThemeTransfer] = useState(false);
  const [themeTransferBusy, setThemeTransferBusy] = useState(false);
  const [confirmThemeReset, setConfirmThemeReset] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const statusBarTop = Number(draft.cssOverrides["--status-bar-top"]?.replace("px", "") || "12");
  const islandHidden = draft.cssOverrides["--status-island-visibility"] === "hidden";

  const goSection = (next: AppearanceSection, focus = false) => {
    setAccentFocus(focus);
    setSection(next);
  };

  const handleMainTile = (key: MainTileKey) => {
    switch (key) {
      case "display": goSection("display"); break;
      case "accent": goSection("display", true); break;
      case "wallpaper": goSection("wallpaper"); break;
      case "icons": goSection("icons"); break;
      case "widgets": goSection("widgets"); break;
      case "glass": goSection("glass"); break;
      case "case": setShowStatusBarAdjust(true); break;
      case "text": setShowTextAdjust(true); break;
    }
  };

  const handleExportTheme = useCallback(async () => {
    setThemeTransferBusy(true);
    try {
      const result = await createThemePackageBlob({
        themeProfile: draft,
        iconLayout: pageIcons,
        widgets
      });
      const { downloadFile } = await import("@/lib/download-utils");
      await downloadFile(result.blob, result.fileName);
      setShowThemeTransfer(false);
      onNotice(`已导出主题包：${result.summary.assetCount} 个资源，${result.summary.widgetCount} 个桌面组件。`);
    } catch (error) {
      console.error(error);
      onNotice(error instanceof Error ? error.message : "主题导出失败");
    } finally {
      setThemeTransferBusy(false);
    }
  }, [draft, onNotice, pageIcons, widgets]);

  const handleImportFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setThemeTransferBusy(true);
    try {
      const result = await installThemePackageFile(file);
      onDesktopThemeChange({ widgets: result.widgets, iconLayout: result.iconLayout, dock: result.dock, folders: result.folders });
      await onApply(result.themeProfile);
      onDraftChange(result.themeProfile);
      setShowThemeTransfer(false);
      onNotice(`已导入主题包：${result.summary.assetCount} 个资源，${result.summary.widgetCount} 个桌面组件。`);
    } catch (error) {
      console.error(error);
      onNotice(error instanceof Error ? error.message : "主题导入失败");
    } finally {
      setThemeTransferBusy(false);
    }
  }, [onApply, onDesktopThemeChange, onDraftChange, onNotice]);

  const handleResetTheme = useCallback(async () => {
    setThemeTransferBusy(true);
    try {
      const result = await resetThemePackageState();
      onDesktopThemeChange({ widgets: result.widgets, iconLayout: result.iconLayout, dock: result.dock, folders: result.folders });
      await onApply(result.themeProfile);
      onDraftChange(result.themeProfile);
      setConfirmThemeReset(false);
      onNotice("已恢复默认外观，壁纸库、自定义组件和自定义 App 已保留。");
    } catch (error) {
      console.error(error);
      onNotice(error instanceof Error ? error.message : "恢复默认失败");
    } finally {
      setThemeTransferBusy(false);
    }
  }, [onApply, onDesktopThemeChange, onDraftChange, onNotice]);

  // 高级外观：边框 / 阴影（data-borders / data-shadows + --desktop-shadow-strength 实时生效）
  const handleToggleBorder = useCallback((on: boolean) => {
    const next = normalizeThemeProfile({ ...draft, enableGlobalBorder: on });
    onDraftChange(next);
    onApply(next);
  }, [draft, onDraftChange, onApply]);

  const handleToggleShadows = useCallback((on: boolean) => {
    const next = normalizeThemeProfile({
      ...draft,
      enableGlobalShadows: on,
      cssOverrides: { ...draft.cssOverrides, "--desktop-global-shadow": on ? "0.5" : "0" },
    });
    onDraftChange(next);
    onApply(next);
  }, [draft, onDraftChange, onApply]);

  function handleBack() {
    if (section === "menu") {
      onClose();
    } else {
      setAccentFocus(false);
      setSection("menu");
    }
  }

  const title = section === "menu" ? "外观" : SECTION_TITLES[section];
  const glassStrengthPct = Math.round(draft.pearlGlassStrength * 100);

  return (
    <PageShell title={title} onBack={handleBack}>
        {section === "menu" ? (
          <div className="page-menu appearance-main-menu">
            {/* 主区：8 磁贴 */}
            <div>
              <h3 className="appearance-menu-section-title">Appearance</h3>
              <div className="card-grid mt-2.5">
                {MAIN_TILES.map((item) => (
                  <button
                    key={item.key}
                    className="app-card card-card"
                    type="button"
                    onClick={() => handleMainTile(item.key)}
                  >
                    {item.glass ? (
                      <span className="card-icon card-icon-glass">
                        <GlassIcon name={item.glass} />
                      </span>
                    ) : (
                      <span className="card-icon" style={menuIconStyle()}>
                        <Sparkles size={20} strokeWidth={1.75} />
                      </span>
                    )}
                    <span className="card-card-body">
                      <span className="card-label">{item.label}</span>
                      <span className="card-desc">{item.desc}</span>
                    </span>
                    <span className="card-card-chevron" aria-hidden="true"><IconChevronRight /></span>
                  </button>
                ))}
              </div>
            </div>

            {/* 高级外观 */}
            <div>
              <h3 className="appearance-menu-section-title">Advanced</h3>
              <div className="menu-group mt-2.5">
                <button className="menu-item" type="button" onClick={() => goSection("css")}>
                  <span className="card-icon card-icon-glass"><GlassIcon name="css" /></span>
                  <span className="menu-label appearance-menu-item-label">全局 CSS</span>
                  <span className="menu-right"><IconChevronRight /></span>
                </button>
                <button className="menu-item" type="button" onClick={() => goSection("palette")}>
                  <span className="card-icon card-icon-glass"><GlassIcon name="palette" /></span>
                  <span className="menu-label appearance-menu-item-label">CSS Variables</span>
                  <span className="menu-right"><IconChevronRight /></span>
                </button>
                <button className="menu-item" type="button" onClick={() => goSection("glass")}>
                  <span className="card-icon" style={menuIconStyle()}>
                    <Gauge size={20} strokeWidth={1.75} />
                  </span>
                  <span className="menu-label appearance-menu-item-label">Pearl Glass 强度</span>
                  <span className="menu-right" style={{ gap: 4 }}>
                    <span className="ts-11" style={{ color: "var(--c-icon)" }}>{glassStrengthPct}%</span>
                    <IconChevronRight />
                  </span>
                </button>
                <div className="menu-item cursor-pointer">
                  <span className="card-icon" style={menuIconStyle()}>
                    <Square size={20} strokeWidth={1.75} />
                  </span>
                  <span className="menu-label appearance-menu-item-label">边框</span>
                  <RowSwitch
                    ariaLabel="全局边框"
                    checked={draft.enableGlobalBorder}
                    onChange={handleToggleBorder}
                  />
                </div>
                <div className="menu-item cursor-pointer">
                  <span className="card-icon" style={menuIconStyle()}>
                    <Box size={20} strokeWidth={1.75} />
                  </span>
                  <span className="menu-label appearance-menu-item-label">阴影</span>
                  <RowSwitch
                    ariaLabel="全局阴影"
                    checked={
                      draft.enableGlobalShadows &&
                      Number(draft.cssOverrides["--desktop-global-shadow"] ?? "0.5") > 0
                    }
                    onChange={handleToggleShadows}
                  />
                </div>
                <button
                  className="menu-item disabled:opacity-40"
                  type="button"
                  onClick={() => setShowThemeTransfer(true)}
                  disabled={themeTransferBusy}
                >
                  <span className="card-icon card-icon-glass"><GlassIcon name="theme-transfer" /></span>
                  <span className="menu-label appearance-menu-item-label">导入主题</span>
                  <span className="menu-right"><IconChevronRight /></span>
                </button>
                <button
                  className="menu-item disabled:opacity-40"
                  type="button"
                  onClick={handleExportTheme}
                  disabled={themeTransferBusy}
                >
                  <span className="card-icon" style={menuIconStyle(BINDING_ACCENTS.api)}>
                    <Download size={20} strokeWidth={1.75} />
                  </span>
                  <span className="menu-label appearance-menu-item-label">
                    {themeTransferBusy ? "导出中…" : "导出主题"}
                  </span>
                  <span className="menu-right"><IconChevronRight /></span>
                </button>
                <button
                  className="menu-item disabled:opacity-40"
                  type="button"
                  onClick={() => setConfirmThemeReset(true)}
                  disabled={themeTransferBusy}
                >
                  <span className="card-icon card-icon-glass"><GlassIcon name="theme-reset" /></span>
                  <span className="menu-label appearance-menu-item-label">恢复默认</span>
                  <span className="menu-right"><IconChevronRight /></span>
                </button>
              </div>
            </div>
          </div>
        ) : section === "wallpaper" ? (
          <WallpaperPage
            draft={draft}
            onDraftChange={onDraftChange}
            onApply={onApply}
            onNotice={onNotice}
          />
        ) : section === "widgets" ? (
          <WidgetManagerPage
            widgets={widgets}
            onWidgetsChange={onWidgetsChange}
            pageIcons={pageIcons}
            iconSkins={iconSkins}
            wallpaperStyle={wallpaperStyle}
          />
        ) : section === "display" ? (
          <DisplayColorPage
            draft={draft}
            onDraftChange={onDraftChange}
            onApply={onApply}
            onNotice={onNotice}
            focusAccent={accentFocus}
          />
        ) : section === "palette" ? (
          <PalettePresetPage draft={draft} onDraftChange={onDraftChange} onApply={onApply} onNotice={onNotice} />
        ) : section === "css" ? (
          <GlobalCSSPage draft={draft} onDraftChange={onDraftChange} onApply={onApply} onNotice={onNotice} />
        ) : section === "icons" ? (
          <IconSkinPage draft={draft} onDraftChange={onDraftChange} onApply={onApply} onNotice={onNotice} />
        ) : section === "glass" ? (
          <GlassStylePage draft={draft} onDraftChange={onDraftChange} onApply={onApply} onNotice={onNotice} />
        ) : (
          <div className="flex-1 overflow-y-auto items-start justify-center flex">
            <p className="ts-14 text-[var(--c-icon)]">{"「"}{SECTION_TITLES[section]}{"」功能开发中…"}</p>
          </div>
        )}
      {/* 不限定 accept：.ai-theme 是自定义后缀，iOS「文件」选择器会把
          没有注册 UTI 的类型置灰导致选不中。放开后由 installThemePackageFile
          校验包内 manifest.json，非法文件照样会被拒。 */}
      <input
        ref={importFileRef}
        type="file"
        className="hidden"
        onChange={handleImportFileChange}
      />
      {showThemeTransfer && createPortal(
        <ContentDialog
          title="主题导入 / 导出"
          confirmLabel={undefined}
          cancelLabel="关闭"
          onConfirm={() => setShowThemeTransfer(false)}
          onCancel={() => {
            if (!themeTransferBusy) setShowThemeTransfer(false);
          }}
        >
          <div className="flex flex-col gap-4">
            <p className="ts-13 leading-relaxed text-[var(--c-text)]">
              主题包会包含主题色、壁纸、图标、桌面组件、自定义组件，以及桌面图标和组件位置。
            </p>
            <div className="grid grid-cols-2 gap-8 py-1">
              <button
                type="button"
                className="inline-flex min-h-[74px] flex-col items-center justify-center gap-2 bg-transparent px-2 text-xs font-bold text-[var(--c-text-title)] transition-all active:scale-95 disabled:opacity-40"
                onClick={() => importFileRef.current?.click()}
                disabled={themeTransferBusy}
              >
                <span className="card-icon" style={menuIconStyle(BINDING_ACCENTS.api)}>
                  <Upload size={20} strokeWidth={1.75} />
                </span>
                <span>导入</span>
              </button>
              <button
                type="button"
                className="inline-flex min-h-[74px] flex-col items-center justify-center gap-2 bg-transparent px-2 text-xs font-bold text-[var(--c-text-title)] transition-all active:scale-95 disabled:opacity-40"
                onClick={handleExportTheme}
                disabled={themeTransferBusy}
              >
                <span className="card-icon" style={menuIconStyle(BINDING_ACCENTS.embedding)}>
                  <Download size={20} strokeWidth={1.75} />
                </span>
                <span>导出</span>
              </button>
            </div>
          </div>
        </ContentDialog>,
        document.querySelector(".phone-shell") ?? document.body
      )}
      {confirmThemeReset && (
        <ConfirmDialog
          title="恢复默认外观？"
          message="将恢复默认主题色、当前壁纸、图标、桌面组件和桌面位置；已导入的壁纸库和自定义组件会保留，但不会继续应用在桌面上。已安装的自定义 App 图标会自动排回桌面空位。"
          icon={AlertCircle}
          variant="danger"
          confirmLabel={themeTransferBusy ? "恢复中" : "恢复默认"}
          cancelLabel="取消"
          onConfirm={themeTransferBusy ? () => {} : handleResetTheme}
          onCancel={() => {
            if (!themeTransferBusy) setConfirmThemeReset(false);
          }}
        />
      )}
      {showStatusBarAdjust && createPortal(
        <ContentDialog
          title={"桌面与状态栏"}
          confirmLabel={"确定"}
          cancelLabel={"重置"}
          onConfirm={() => setShowStatusBarAdjust(false)}
          onCancel={() => {
            const next = { ...draft, cssOverrides: { ...draft.cssOverrides } };
            delete next.cssOverrides["--status-bar-top"];
            onDraftChange(next);
            onApply(next);
            setShowStatusBarAdjust(false);
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 应用内虚拟状态栏开关（原外观首页行内开关，T5 随「桌面」磁贴迁入本弹窗） */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text)" }}>{"显示应用内状态栏"}</span>
              <RowSwitch
                ariaLabel="显示应用内状态栏"
                checked={!draft.hideTopBar}
                onChange={(checked) => {
                  // 4.5.x：拨动开关即记录「用户显式选择」，此后迁移不再改写
                  const next = { ...draft, hideTopBar: !checked, hideTopBarExplicit: true };
                  onDraftChange(next);
                  onApply(next);
                }}
              />
            </div>
            <p style={{ fontSize: "calc(11px*var(--app-text-scale,1))", color: "var(--c-icon)", lineHeight: 1.4, marginTop: -4 }}>
              {"控制 App 桌面顶部的模拟状态栏（时间 / 信号 / 电量）。关闭后顶部内容上移。"}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text)" }}>{"显示系统状态栏"}</span>
              <label className="block w-10 h-[22px] cursor-pointer relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={systemBarShown}
                  onChange={(e) => {
                    const shown = e.target.checked;
                    setSystemBarShown(shown);
                    writePwaDisplayPreference(shown ? "standalone" : "fullscreen");
                    if (shown && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
                    onNotice(shown ? "已开启系统状态栏，重新添加到桌面后完全生效" : "已恢复沉浸全屏，重新添加到桌面后完全生效");
                  }}
                  className="w-full h-full rounded-[11px] m-0 outline-none"
                  style={{ appearance: "none", backgroundColor: systemBarShown ? "var(--c-success)" : "var(--c-page-body-bg)", border: systemBarShown ? "none" : "1px solid var(--c-input-border)", transition: "0.2s" }}
                />
                <div className="absolute w-[18px] h-[18px] bg-white rounded-full top-[2px] pointer-events-none" style={{ left: systemBarShown ? 20 : 2, transition: "0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }} />
              </label>
            </div>
            <p style={{ fontSize: "calc(11px*var(--app-text-scale,1))", color: "var(--c-icon)", lineHeight: 1.4 }}>
              {"显示手机系统自己的状态栏（时间/电量/通知），退出沉浸全屏，安卓不再反复弹全屏提示。开启后本页的虚拟状态栏不再显示；已装到桌面的需删除后重新「添加到主屏幕」才完全生效。"}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text)" }}>{"顶部偏移"}</span>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text-title)", fontWeight: 600 }}>{statusBarTop}px</span>
            </div>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={statusBarTop}
              onChange={(e) => {
                const val = Number(e.target.value);
                const next = { ...draft, cssOverrides: { ...draft.cssOverrides, "--status-bar-top": `${val}px` } };
                onDraftChange(next);
                onApply(next);
              }}
              className="ui-slider"
              data-ui="slider"
            />
            <p style={{ fontSize: "calc(11px*var(--app-text-scale,1))", color: "var(--c-icon)", lineHeight: 1.4 }}>
              {"调节状态栏文字和图标的垂直位置，适配不同设备。可设为负值上移（顶部空间偏大的浏览器如 Edge 适用）。点「重置」恢复默认值。"}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text)" }}>{"隐藏灵动岛"}</span>
              <label
                className="block w-10 h-[22px] cursor-pointer relative shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={islandHidden}
                  onChange={(e) => {
                    const next = { ...draft, cssOverrides: { ...draft.cssOverrides, "--status-island-visibility": e.target.checked ? "hidden" : "visible" } };
                    onDraftChange(next);
                    onApply(next);
                  }}
                  className="w-full h-full rounded-[11px] m-0 outline-none"
                  style={{ appearance: "none", backgroundColor: islandHidden ? "var(--c-success)" : "var(--c-page-body-bg)", border: islandHidden ? "none" : "1px solid var(--c-input-border)", transition: "0.2s" }}
                />
                <div className="absolute w-[18px] h-[18px] bg-white rounded-full top-[2px] pointer-events-none" style={{ left: islandHidden ? 20 : 2, transition: "0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text)" }}>{"状态栏占位上移"}</span>
              <span style={{ fontSize: "calc(13px*var(--app-text-scale,1))", color: "var(--c-text-title)", fontWeight: 600 }}>{draft.statusBarDropPx ?? 0}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={120}
              step={1}
              value={draft.statusBarDropPx ?? 0}
              onChange={(e) => {
                const next = { ...draft, statusBarDropPx: Number(e.target.value) };
                onDraftChange(next);
                onApply(next);
              }}
              className="ui-slider"
              data-ui="slider"
            />
            <p style={{ fontSize: "calc(11px*var(--app-text-scale,1))", color: "var(--c-icon)", lineHeight: 1.4 }}>
              {"安卓部分浏览器不能全屏（底部被真实状态栏顶出屏幕）时调大：把整块画面上移、裁掉顶部状态栏占位，让底部栏回到屏幕内。调到刚好铺满即可（约等于真实状态栏高度）。iOS 能正常全屏，保持 0。"}
            </p>
          </div>
        </ContentDialog>,
        document.querySelector(".phone-shell") ?? document.body
      )}
      {showTextAdjust && createPortal(
        <ContentDialog
          title={"字体"}
          confirmLabel={"确定"}
          cancelLabel={undefined}
          onConfirm={() => setShowTextAdjust(false)}
          onCancel={() => setShowTextAdjust(false)}
        >
          <TextScalePage
            draft={draft}
            onDraftChange={onDraftChange}
            onApply={onApply}
            onNotice={onNotice}
            compact
          />
        </ContentDialog>,
        document.querySelector(".phone-shell") ?? document.body
      )}
    </PageShell>
  );
}
