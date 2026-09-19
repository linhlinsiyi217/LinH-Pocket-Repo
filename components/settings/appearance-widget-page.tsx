/* ══════════════════════════════════════════
   外观 · 桌面组件管理页（v0.8.0 T5 等价抽离）
   组件仓库预览 + DIY 组件创建/编辑/删除。
   ══════════════════════════════════════════ */
"use client";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  WIDGET_CATALOG,
  type WidgetInstance,
  type WidgetType,
} from "@/lib/widget-types";
import { loadDIYTemplates, saveDIYTemplates } from "@/lib/widget-storage";
import { WidgetRenderer } from "@/components/widgets/widget-renderer";
import type { DIYWidgetTemplate } from "@/lib/widget-types";
import { DIYWidgetEditor } from "@/components/widgets/diy-widget-editor";

export function WidgetManagerPage({
  widgets,
  onWidgetsChange,
  pageIcons,
  iconSkins,
  wallpaperStyle,
}: {
  widgets: WidgetInstance[];
  onWidgetsChange: (next: WidgetInstance[]) => void;
  pageIcons: import("@/lib/desktop-layout-storage").DesktopIconLayout;
  iconSkins: Record<string, string | null>;
  wallpaperStyle?: CSSProperties;
}) {
  const [diyTemplates, setDiyTemplates] = useState<DIYWidgetTemplate[]>([]);
  const [showStudio, setShowStudio] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<DIYWidgetTemplate | undefined>(undefined);

  useEffect(() => {
    setDiyTemplates(loadDIYTemplates());
  }, []);

  const mergedCatalog = useMemo(() => {
    const diyEntries = diyTemplates.map(t => ({
      type: t.id as WidgetType,
      name: t.name || "DIY组件",
      desc: t.mode === "image" ? "图片贴纸" : "自定义代码",
      size: t.size,
      track: "freestyle" as const
    }));
    return [...WIDGET_CATALOG, ...diyEntries];
  }, [diyTemplates]);

  return (
    <div className="theme-section-page flex flex-col gap-6" data-bottom-reserve style={{ padding: "16px 20px 0" }}>
      
      {/* Studio Header Toggle */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center pt-2 pb-4 border-b border-black/5">
          <button
             className={`px-6 py-2.5 rounded-[20px] text-sm font-bold shadow-sm transition-all focus:outline-none ${(showStudio && !editingTemplate) ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-black text-white hover:bg-gray-800 hover:shadow-md active:scale-95'}`}
             onClick={() => {
               if (showStudio && !editingTemplate) {
                 setShowStudio(false);
               } else {
                 setEditingTemplate(undefined);
                 setShowStudio(true);
               }
             }}
          >
            {(showStudio && !editingTemplate) ? "收起面板" : "➕ 创建新组件"}
          </button>
          <p className="text-[calc(11px*var(--app-text-scale,1))] text-gray-400 font-medium mt-3">创建和管理个性化桌面组件</p>
        </div>
        
        {/* 新建面板（顶部）。编辑已有组件改为在该组件下方就地展开。 */}
        {showStudio && !editingTemplate && (
          <div className="rounded-[32px] w-full">
             <DIYWidgetEditor
               template={undefined}
               onClose={() => setShowStudio(false)}
               onSave={(newTemplate) => {
                 const updated = [...diyTemplates, newTemplate];
                 saveDIYTemplates(updated);
                 setDiyTemplates(updated);
                 setShowStudio(false);
               }}
             />
          </div>
        )}
      </div>

      {/* Widget catalog */}
      <div className="wm-catalog" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 className="wm-catalog-title" style={{ margin: 0 }}>{"组件仓库"}</h3>
          <span className="text-[calc(11px*var(--app-text-scale,1))] text-gray-400 font-medium">长按手机桌面的空白处即可将组件添加到主屏幕</span>
        </div>
        <div className="wm-catalog-list">
          {mergedCatalog.map((entry) => {
            const sizeClass = `wm-cat-size-${entry.size}`;
            const dummyWidget: WidgetInstance = {
              id: `cat-${entry.type}`,
              type: entry.type,
              size: entry.size,
              page: 1,
              row: 1,
              col: 1,
            };
            const isDIY = entry.type.startsWith("diy-");
            const isEditingThis = isDIY && showStudio && editingTemplate?.id === entry.type;
            return (
              <Fragment key={entry.type}>
              <div
                className={`wm-cat-item ${sizeClass} relative group ${isEditingThis ? "wm-cat-active" : ""}`}
                style={{ overflow: "visible" }}
              >
                {isDIY && (
                  <button
                    className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 z-20 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform active:scale-95"
                    title="删除自制组件"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("确定要删除这个自制组件吗？桌面上已添加的相关组件可能也会丢失界面。")) {
                         const updated = diyTemplates.filter(t => t.id !== entry.type);
                         saveDIYTemplates(updated);
                         setDiyTemplates(updated);
                         if (editingTemplate?.id === entry.type) { setShowStudio(false); setEditingTemplate(undefined); }
                      }
                    }}
                  >
                   <span className="mb-[2px] leading-none text-sm font-bold">×</span>
                  </button>
                )}
                <div role="button" tabIndex={0} onClick={() => {
                    if(isDIY) {
                      if (isEditingThis) {
                        setShowStudio(false);
                        setEditingTemplate(undefined);
                      } else {
                        const template = diyTemplates.find(t => t.id === entry.type);
                        setEditingTemplate(template);
                        setShowStudio(true);
                      }
                    }
                  }} className="w-full h-full flex flex-col items-center gap-2">
                  <WidgetRenderer widget={dummyWidget} preview />
                  <span className="wm-cat-name">{entry.name}</span>
                </div>
              </div>
              {isEditingThis && (
                <div style={{ flexBasis: "100%", width: "100%" }} className="rounded-[32px]">
                  <DIYWidgetEditor
                    template={editingTemplate}
                    onClose={() => { setShowStudio(false); setEditingTemplate(undefined); }}
                    onSave={(newTemplate) => {
                      const updated = diyTemplates.map(t => t.id === newTemplate.id ? newTemplate : t);
                      saveDIYTemplates(updated);
                      setDiyTemplates(updated);
                      setShowStudio(false);
                      setEditingTemplate(undefined);
                    }}
                  />
                </div>
              )}
              </Fragment>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
