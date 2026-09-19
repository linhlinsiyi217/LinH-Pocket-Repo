/* ══════════════════════════════════════════
   外观 · 壁纸页（v0.8.0 T5 等价抽离）
   壁纸库 / 上传 / 选用 / 删除；透明度·模糊·缩放·XY 滑杆（rAF 合帧预览，松手提交）。
   ══════════════════════════════════════════ */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { normalizeThemeProfile, type ThemeProfile } from "@/lib/theme-types";
import {
  saveThemeAssetFromBlob,
  deleteThemeAsset,
  getThemeAssetMap,
  describeAssetSaveError,
} from "@/lib/theme-storage";
import { ConfirmDialog } from "@/components/ui/modal";
import type { AppearanceDraftPageProps, WallpaperSliderField } from "./appearance-shared";

export function WallpaperPage({
  draft,
  onDraftChange,
  onApply,
  onNotice,
}: AppearanceDraftPageProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [sliderDraft, setSliderDraft] = useState<ThemeProfile>(draft);
  const sliderDraftRef = useRef<ThemeProfile>(draft);
  const sliderFrameRef = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }, []);

  const library = draft.wallpaperLibrary;
  const hasWallpaper = !!draft.wallpaperAssetId;

  useEffect(() => {
    sliderDraftRef.current = draft;
    setSliderDraft(draft);
  }, [
    draft.wallpaperAssetId,
    draft.wallpaperOpacity,
    draft.wallpaperBlur,
    draft.wallpaperScale,
    draft.wallpaperX,
    draft.wallpaperY,
  ]);

  useEffect(() => {
    return () => {
      if (sliderFrameRef.current !== null) cancelAnimationFrame(sliderFrameRef.current);
    };
  }, []);

  const scheduleSliderPreview = useCallback(() => {
    if (sliderFrameRef.current !== null) return;
    sliderFrameRef.current = requestAnimationFrame(() => {
      sliderFrameRef.current = null;
      onDraftChange(sliderDraftRef.current);
    });
  }, [onDraftChange]);

  // Load thumbnails when library contents change (join for stable dep)
  useEffect(() => {
    if (library.length === 0) {
      setThumbs({});
      return;
    }
    let cancelled = false;
    getThemeAssetMap(library).then((map) => {
      if (!cancelled) setThumbs(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.join(",")]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    try {
      const assetId = await saveThemeAssetFromBlob(file, "wallpaper");
      const updatedLibrary = [...draft.wallpaperLibrary, assetId];
      const next = normalizeThemeProfile({
        ...draft,
        wallpaperAssetId: assetId,
        wallpaperLibrary: updatedLibrary,
      });
      onDraftChange(next);
      await onApply(next);
      // Reload thumbnails for the new asset
      const map = await getThemeAssetMap(next.wallpaperLibrary);
      setThumbs(map);
    } catch (error) {
      onNotice(describeAssetSaveError(error));
    }
  }, [draft, onDraftChange, onApply, onNotice]);

  const handleSelect = useCallback(async (assetId: string) => {
    if (draft.wallpaperAssetId === assetId) {
      const next = normalizeThemeProfile({ ...draft, wallpaperAssetId: null });
      onDraftChange(next);
      await onApply(next);
      showToast("已取消应用壁纸");
      return;
    }
    const next = normalizeThemeProfile({
      ...draft,
      wallpaperAssetId: assetId,
    });
    onDraftChange(next);
    await onApply(next);
    showToast("已切换壁纸");
  }, [draft, onDraftChange, onApply, showToast]);

  const handleDeleteClick = useCallback((assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(assetId);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteId) return;
    await deleteThemeAsset(confirmDeleteId);
    const updatedLibrary = draft.wallpaperLibrary.filter((id) => id !== confirmDeleteId);
    const next = normalizeThemeProfile({
      ...draft,
      wallpaperAssetId: draft.wallpaperAssetId === confirmDeleteId ? null : draft.wallpaperAssetId,
      wallpaperLibrary: updatedLibrary,
    });
    setConfirmDeleteId(null);
    onDraftChange(next);
    await onApply(next);
  }, [confirmDeleteId, draft, onDraftChange, onApply]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleSliderChange = useCallback((field: WallpaperSliderField, value: number) => {
    const next = normalizeThemeProfile({ ...sliderDraftRef.current, [field]: value });
    sliderDraftRef.current = next;
    setSliderDraft(next);
    scheduleSliderPreview();
  }, [scheduleSliderPreview]);

  const handleSliderCommit = useCallback(() => {
    if (sliderFrameRef.current !== null) {
      cancelAnimationFrame(sliderFrameRef.current);
      sliderFrameRef.current = null;
    }
    const next = sliderDraftRef.current;
    onDraftChange(next);
    onApply(next);
  }, [onApply, onDraftChange]);

  return (
    <div className="theme-section-page" data-bottom-reserve style={{ gap: 14 }}>
      {/* Upload button */}
      <div className="flex flex-col items-center justify-center pt-2 pb-4 border-b border-black/5">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-[20px] bg-black px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-95 focus:outline-none"
          onClick={() => fileRef.current?.click()}
        >
          <Plus size={15} strokeWidth={1.8} />
          {"添加壁纸"}
        </button>
        <p className="mt-3 text-[calc(11px*var(--app-text-scale,1))] font-medium text-gray-400">上传并管理个性化桌面壁纸</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Sliders — only when a wallpaper is active */}
      {hasWallpaper && (
        <div className="g-card wp-sliders">
          <div className="wp-slider-row">
            <label>{"透明度"}</label>
            <input
              className="ui-slider"
              type="range"
              min={0}
              max={100}
              step="any"
              value={sliderDraft.wallpaperOpacity * 100}
              onChange={(e) => handleSliderChange("wallpaperOpacity", Number(e.target.value) / 100)}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
            />
            <span className="wp-slider-value">{Math.round(sliderDraft.wallpaperOpacity * 100)}</span>
          </div>
          <div className="wp-slider-row">
            <label>{"模糊度"}</label>
            <input
              className="ui-slider"
              type="range"
              min={0}
              max={24}
              step="any"
              value={sliderDraft.wallpaperBlur}
              onChange={(e) => handleSliderChange("wallpaperBlur", Number(e.target.value))}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
            />
            <span className="wp-slider-value">{Math.round(sliderDraft.wallpaperBlur)}</span>
          </div>
          <div className="wp-slider-row">
            <label>{"缩放度"}</label>
            <input
              className="ui-slider"
              type="range"
              min={10}
              max={200}
              step="any"
              value={sliderDraft.wallpaperScale}
              onChange={(e) => handleSliderChange("wallpaperScale", Number(e.target.value))}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
            />
            <span className="wp-slider-value">{Math.round(sliderDraft.wallpaperScale)}%</span>
          </div>
          <div className="wp-slider-row">
            <label>{"X 偏移"}</label>
            <input
              className="ui-slider"
              type="range"
              min={0}
              max={100}
              step="any"
              value={sliderDraft.wallpaperX}
              onChange={(e) => handleSliderChange("wallpaperX", Number(e.target.value))}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
            />
            <span className="wp-slider-value">{Math.round(sliderDraft.wallpaperX)}%</span>
          </div>
          <div className="wp-slider-row">
            <label>{"Y 偏移"}</label>
            <input
              className="ui-slider"
              type="range"
              min={0}
              max={100}
              step="any"
              value={sliderDraft.wallpaperY}
              onChange={(e) => handleSliderChange("wallpaperY", Number(e.target.value))}
              onMouseUp={handleSliderCommit}
              onTouchEnd={handleSliderCommit}
            />
            <span className="wp-slider-value">{Math.round(sliderDraft.wallpaperY)}%</span>
          </div>
        </div>
      )}

      {/* Wallpaper library grid */}
      {library.length > 0 ? (
        <div className="wp-grid">
          {library.map((assetId) => {
            const isActive = draft.wallpaperAssetId === assetId;
            const src = thumbs[assetId];
            return (
              <div
                key={assetId}
                className={`wp-card${isActive ? " wp-card-active" : ""}`}
                onClick={() => handleSelect(assetId)}
                role="button"
                tabIndex={0}
              >
                {src ? (
                  <img className="wp-card-img" src={src} alt="" />
                ) : (
                  <div className="wp-card-img bg-[var(--c-page-body-bg)]" />
                )}
                {isActive && <span className="wp-card-badge">{"使用中"}</span>}
                <button
                  type="button"
                  className="ui-card-delete"
                  onClick={(e) => handleDeleteClick(assetId, e)}
                  aria-label={"删除"}
                >
                  {"×"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="wp-empty">{"还没有壁纸，点击上方添加"}</p>
      )}

      {/* Bottom toast */}
      {toast && <div className="wp-toast">{toast}</div>}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="确定要删除这张壁纸吗？"
          message="删除壁纸后无法恢复。是否继续？"
          icon={AlertCircle}
          variant="danger"
          confirmLabel="删除"
          cancelLabel="取消"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  );
}
