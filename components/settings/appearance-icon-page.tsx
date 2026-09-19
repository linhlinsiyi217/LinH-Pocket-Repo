/* ══════════════════════════════════════════
   外观 · 图标皮肤页（v0.8.0 T5 等价抽离）
   内置图标 + 自定义 App 图标皮肤网格、Dock 皮肤、多方案同步。
   ══════════════════════════════════════════ */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { resolveActiveIconSkins, normalizeThemeProfile, type ThemeProfile } from "@/lib/theme-types";
import type { DesktopIconId } from "@/lib/desktop-config";
import { ICONS } from "@/lib/desktop-config";
import { CUSTOM_APPS_UPDATED_EVENT, loadInstalledCustomApps } from "@/lib/custom-app-storage";
import { toCustomAppIconId, type InstalledCustomApp } from "@/lib/custom-app-types";
import { IconGlyph } from "@/components/icon-glyph";
import {
  saveThemeAssetFromBlob,
  deleteThemeAsset,
  getThemeAssetMap,
  describeAssetSaveError,
} from "@/lib/theme-storage";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  BUILTIN_ICON_SKIN_IDS,
  updateIconSkin,
  type AppearanceDraftPageProps,
  type IconSkinItem,
} from "./appearance-shared";

export function IconSkinPage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
}: AppearanceDraftPageProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dockFileRef = useRef<HTMLInputElement>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dockThumbUrl, setDockThumbUrl] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<DesktopIconId | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ iconId: DesktopIconId; assetId: string } | null>(null);
  const [confirmDeleteDock, setConfirmDeleteDock] = useState(false);
  const [customApps, setCustomApps] = useState<InstalledCustomApp[]>(() => (
    typeof window === "undefined" ? [] : loadInstalledCustomApps()
  ));

  const activeSkins = resolveActiveIconSkins(draft);
  const allAssetIds = Object.values(activeSkins).filter(Boolean) as string[];
  const iconSkinItems = useMemo<IconSkinItem[]>(() => [
    ...BUILTIN_ICON_SKIN_IDS.map((id) => ({
      id,
      label: ICONS[id].label,
      builtinId: id,
    })),
    ...customApps.map((app) => ({
      id: toCustomAppIconId(app.id),
      label: app.name,
      builtinId: null,
      iconDataUrl: app.iconDataUrl,
    })),
  ], [customApps]);

  useEffect(() => {
    const refreshCustomApps = () => setCustomApps(loadInstalledCustomApps());
    refreshCustomApps();
    window.addEventListener(CUSTOM_APPS_UPDATED_EVENT, refreshCustomApps);
    return () => window.removeEventListener(CUSTOM_APPS_UPDATED_EVENT, refreshCustomApps);
  }, []);

  useEffect(() => {
    const idsToLoad = [...allAssetIds];
    if (draft.dockSkinAssetId) idsToLoad.push(draft.dockSkinAssetId);
    if (idsToLoad.length === 0) {
      setThumbs({});
      setDockThumbUrl(null);
      return;
    }
    let cancelled = false;
    getThemeAssetMap(idsToLoad).then((map) => {
      if (cancelled) return;
      setThumbs(map);
      setDockThumbUrl(draft.dockSkinAssetId ? map[draft.dockSkinAssetId] ?? null : null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAssetIds.join(","), draft.dockSkinAssetId]);

  const triggerUpload = useCallback((iconId: DesktopIconId) => {
    setUploadTarget(iconId);
    fileRef.current?.click();
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    e.target.value = "";

    try {
      const assetId = await saveThemeAssetFromBlob(file, "icon_skin");
      const next = updateIconSkin(draft, uploadTarget, assetId);
      onDraftChange(next);
      await onApply(next);
      const map = await getThemeAssetMap(
        (Object.values(resolveActiveIconSkins(next)).filter(Boolean) as string[])
      );
      setThumbs(map);
    } catch (error) {
      onNotice(describeAssetSaveError(error));
    }
    setUploadTarget(null);
  }, [draft, uploadTarget, onDraftChange, onApply, onNotice]);

  const handleDeleteClick = useCallback((iconId: DesktopIconId, assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId({ iconId, assetId });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteId) return;
    const { iconId, assetId } = confirmDeleteId;
    setConfirmDeleteId(null);
    await deleteThemeAsset(assetId);
    const next = updateIconSkin(draft, iconId, null);
    onDraftChange(next);
    await onApply(next);
    onNotice("已还原默认图标");
  }, [confirmDeleteId, draft, onDraftChange, onApply, onNotice]);

  const triggerDockUpload = useCallback(() => {
    dockFileRef.current?.click();
  }, []);

  const handleDockUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const assetId = await saveThemeAssetFromBlob(file, "dock_skin");
      const next = normalizeThemeProfile({ ...draft, dockSkinAssetId: assetId });
      onDraftChange(next);
      await onApply(next);
      const map = await getThemeAssetMap([assetId]);
      setDockThumbUrl(map[assetId] ?? null);
    } catch (error) {
      onNotice(describeAssetSaveError(error));
    }
  }, [draft, onDraftChange, onApply, onNotice]);

  const handleDockDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteDock(true);
  }, []);

  const handleDockDeleteConfirm = useCallback(async () => {
    setConfirmDeleteDock(false);
    if (draft.dockSkinAssetId) {
      await deleteThemeAsset(draft.dockSkinAssetId);
    }
    const next = normalizeThemeProfile({ ...draft, dockSkinAssetId: null });
    onDraftChange(next);
    await onApply(next);
    setDockThumbUrl(null);
    onNotice("已还原 DOCK 栏背景");
  }, [draft, onDraftChange, onApply, onNotice]);

  const handleResetAll = useCallback(async () => {
    const ids = Object.values(activeSkins).filter(Boolean) as string[];
    if (draft.dockSkinAssetId) ids.push(draft.dockSkinAssetId);
    await Promise.all(ids.map(id => deleteThemeAsset(id)));
    const cleared: ThemeProfile = {
      ...draft,
      iconSkins: {},
      iconSchemes: draft.iconSchemes.map(s =>
        s.id === draft.activeIconSchemeId
          ? { ...s, iconSkins: {}, updatedAt: new Date().toISOString() }
          : s
      ),
      dockSkinAssetId: null,
    };
    const next = normalizeThemeProfile(cleared);
    onDraftChange(next);
    await onApply(next);
    setThumbs({});
    setDockThumbUrl(null);
    onNotice("已还原全部图标");
  }, [activeSkins, draft, onDraftChange, onApply, onNotice]);

  return (
    <div className="theme-section-page" data-bottom-reserve style={{ gap: 14 }}>
      <h3 className="appearance-menu-section-title">Icons</h3>
      <div className="is-grid">
        {iconSkinItems.map(item => {
          const skinAssetId = activeSkins[item.id];
          const skinUrl = skinAssetId ? thumbs[skinAssetId] : null;
          const previewUrl = skinUrl ?? item.iconDataUrl ?? null;
          return (
            <div key={item.id} className="is-cell" onClick={() => triggerUpload(item.id)}>
              <div className="is-frame" {...(previewUrl ? { "data-skinned": "" } : {})}>
                {previewUrl ? (
                  <img className="is-frame-img" src={previewUrl} alt="" />
                ) : item.builtinId ? (
                  <IconGlyph id={item.builtinId} className="is-frame-glyph" />
                ) : (
                  <IconGlyph id="appmarket" className="is-frame-glyph" />
                )}
                {skinAssetId && (
                  <button className="ui-card-delete" onClick={e => handleDeleteClick(item.id, skinAssetId, e)}>×</button>
                )}
              </div>
              <span className="is-label">{item.label}</span>
            </div>
          );
        })}
      </div>

      <p className="is-empty-hint">点击图标上传自定义图片</p>

      <h3 className="appearance-menu-section-title">Dock</h3>
      <div
        className="is-dock-preview"
        onClick={triggerDockUpload}
        {...(dockThumbUrl ? { "data-skinned": "" } : {})}
      >
        {dockThumbUrl ? (
          <>
            <img className="is-dock-preview-img" src={dockThumbUrl} alt="" />
            <button className="ui-card-delete" onClick={handleDockDeleteClick}>×</button>
          </>
        ) : (
          <span className="is-empty-hint">点击上传 DOCK 栏背景</span>
        )}
      </div>

      {(Object.keys(activeSkins).length > 0 || draft.dockSkinAssetId) && (
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] border border-black/10 bg-white px-4 text-xs font-bold text-gray-800 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-95 focus:outline-none"
          onClick={handleResetAll}
        >
          <RotateCcw size={15} strokeWidth={1.8} />
          <span>全部还原</span>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <input ref={dockFileRef} type="file" accept="image/*" className="hidden" onChange={handleDockUpload} />

      {confirmDeleteId && (
        <ConfirmDialog
          title="确定要还原这个图标吗？"
          message="将恢复为默认图标样式。"
          icon={AlertCircle}
          variant="danger"
          confirmLabel="还原"
          cancelLabel="取消"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {confirmDeleteDock && (
        <ConfirmDialog
          title="确定要还原 DOCK 栏背景吗？"
          message="将恢复为默认毛玻璃效果。"
          icon={AlertCircle}
          variant="danger"
          confirmLabel="还原"
          cancelLabel="取消"
          onConfirm={handleDockDeleteConfirm}
          onCancel={() => setConfirmDeleteDock(false)}
        />
      )}
    </div>
  );
}
