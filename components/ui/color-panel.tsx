"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import {
  ACCENT_PRESETS,
  hexToHsv,
  hsvToHex,
  hueToPureHex,
  type Hsv,
} from "@/lib/color-utils";

/* ── 手势参数 ── */
const LONG_PRESS_MS = 150;
const DRAG_SLOP_PX = 9;

type PanelMode = "grid" | "spectrum" | "sliders";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function lightVibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}

type Ratios = { x: number; y: number };

/**
 * 通用「按压表面」手势：
 * - 轻点 → onTap(比例)
 * - 长按 150ms 不松手 → 进入连续取色（轻微触觉），随后滑动实时采样
 * - 按住后提前移动超过 slop → 立即进入连续取色
 * - 移出表面按边界钳制，不闪断；Pointer Capture 保证手指移出元素也持续收事件
 * - touch-action: none 由 CSS/调用方保证，彻底杜绝拖动时页面滚动
 */
function useSurfaceDrag(onSample: (ratios: Ratios) => void) {
  const [active, setActive] = useState(false);
  const samplingRef = useRef(false);
  const startPointRef = useRef({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  const sampleFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onSampleRef.current({
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    });
  }, []);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const bind = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      elRef.current = e.currentTarget;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      samplingRef.current = false;
      startPointRef.current = { x: e.clientX, y: e.clientY };
      setActive(true);
      // 长按进入拖动取色
      timerRef.current = window.setTimeout(() => {
        samplingRef.current = true;
        lightVibrate(8);
        sampleFromEvent(e.clientX, e.clientY);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!active) return;
      const moved = Math.hypot(
        e.clientX - startPointRef.current.x,
        e.clientY - startPointRef.current.y
      );
      if (!samplingRef.current && moved > DRAG_SLOP_PX) {
        clearTimer();
        samplingRef.current = true;
      }
      if (samplingRef.current) sampleFromEvent(e.clientX, e.clientY);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      clearTimer();
      // 未进入拖动状态的松手 = 轻点，直接选中该点
      if (!samplingRef.current) sampleFromEvent(e.clientX, e.clientY);
      samplingRef.current = false;
      setActive(false);
    },
    onPointerCancel: () => {
      clearTimer();
      samplingRef.current = false;
      setActive(false);
    },
  };

  useEffect(() => () => clearTimer(), []);

  return { bind, active };
}

/* ── 取色光标：双环（白描边 + 暗外沿）在任何底色上都清晰 ── */
function Cursor({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <span
      className={`cp-cursor ${active ? "is-active" : ""}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      aria-hidden
    />
  );
}

/* ── 一维滑杆（色相/饱和度/明度通用） ── */
function ChannelSlider({
  gradient,
  ratio,
  active,
  bind,
  ariaLabel,
}: {
  gradient: string;
  ratio: number;
  active: boolean;
  bind: ReturnType<typeof useSurfaceDrag>["bind"];
  ariaLabel: string;
}) {
  return (
    <div
      className="cp-strip"
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      style={{ background: gradient }}
      {...bind}
    >
      <span
        className={`cp-strip-thumb ${active ? "is-active" : ""}`}
        style={{ left: `${ratio * 100}%` }}
      />
    </div>
  );
}

const RAINBOW_GRADIENT =
  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";

/**
 * 面板式主色调取色器。
 * value 为 "" 时表示「跟随默认」，面板显示兜底颜色但不代表已选定；
 * 用户一旦在面板/滑杆上操作，立即通过 onChange 下发具体 HEX（实时预览）。
 */
export function ColorPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [mode, setMode] = useState<PanelMode>("grid");
  const [copied, setCopied] = useState(false);
  const isAuto = value === "";

  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value || "#0A84FF") ?? { h: 211, s: 1, v: 1 });

  // 外部值变化（预设色 / 恢复默认 / 首次挂载）时同步内部 HSV，
  // 但拖动过程中自身产出的 HEX 回灌不会造成光标跳动（值相同直接跳过）。
  useEffect(() => {
    if (isAuto) return;
    const next = hexToHsv(value);
    if (!next) return;
    setHsv((prev) => {
      if (hsvToHex(prev) === value.toUpperCase()) return prev;
      return next;
    });
  }, [value, isAuto]);

  const emit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      onChange(hsvToHex(next));
    },
    [onChange]
  );

  /* 格线板：x=饱和度 0→1，y=明度 1→0（上亮下暗） */
  const svDrag = useSurfaceDrag(
    useCallback(
      ({ x, y }) => emit({ ...hsv, s: x, v: 1 - y }),
      [emit, hsv]
    )
  );
  const svBoardBg = [
    "linear-gradient(to top, #000 0%, rgba(0,0,0,0) 100%)",
    `linear-gradient(to right, #fff 0%, ${hueToPureHex(hsv.h)} 100%)`,
  ].join(",");

  /* 光谱板：x=色相 0→360，y=明度（满饱和） */
  const spectrumDrag = useSurfaceDrag(
    useCallback(
      ({ x, y }) => emit({ h: x * 360, s: 1, v: 1 - y }),
      [emit]
    )
  );
  const spectrumBoardBg = [
    "linear-gradient(to top, #000 0%, rgba(0,0,0,0) 100%)",
    RAINBOW_GRADIENT,
  ].join(",");

  /* 色相 / 饱和度 / 明度三条通道（onSampleRef 始终拿到最新 hsv） */
  const hueStripDrag = useSurfaceDrag(
    useCallback(({ x }) => emit({ ...hsv, h: x * 360 }), [emit, hsv])
  );
  const satStripDrag = useSurfaceDrag(
    useCallback(({ x }) => emit({ ...hsv, s: x }), [emit, hsv])
  );
  const valStripDrag = useSurfaceDrag(
    useCallback(({ x }) => emit({ ...hsv, v: x }), [emit, hsv])
  );

  const currentHex = isAuto ? "#0A84FF" : hsvToHex(hsv);

  const handleCopy = async () => {
    if (isAuto) return;
    try {
      await navigator.clipboard.writeText(value.toUpperCase());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // 剪贴板不可用（非安全上下文等）：静默忽略
    }
  };

  return (
    <div className="color-panel">
      {/* 当前色 + HEX */}
      <div className="cp-preview">
        <span
          className={`cp-preview-swatch ${isAuto ? "is-auto" : ""}`}
          style={isAuto ? undefined : { background: currentHex }}
          aria-hidden
        />
        <span className="cp-preview-meta">
          <span className="cp-preview-hex">{isAuto ? "跟随默认" : value.toUpperCase()}</span>
          <span className="cp-preview-sub">
            {isAuto ? "未自定义，使用系统主色" : `H ${Math.round(hsv.h)}° · S ${Math.round(hsv.s * 100)}% · V ${Math.round(hsv.v * 100)}%`}
          </span>
        </span>
        {!isAuto ? (
          <button
            type="button"
            className="cp-copy-btn"
            onClick={handleCopy}
            aria-label={copied ? "已复制" : "复制 HEX"}
          >
            {copied ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={1.8} />}
          </button>
        ) : null}
      </div>

      {/* 模式切换：格线 / 光谱 / 滑杆 */}
      <div className="cp-seg" role="tablist" aria-label="取色模式">
        {([
          { key: "grid", label: "格线" },
          { key: "spectrum", label: "光谱" },
          { key: "sliders", label: "滑杆" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={mode === opt.key}
            className={`cp-seg-btn ${mode === opt.key ? "is-active" : ""}`}
            onClick={() => setMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "grid" ? (
        <div className="cp-board-wrap">
          <div
            className={`cp-board ${svDrag.active ? "is-picking" : ""}`}
            style={{ background: svBoardBg }}
            {...svDrag.bind}
            role="slider"
            aria-label="饱和度与明度面板"
            aria-valuetext={value || "默认"}
          >
            <Cursor x={hsv.s} y={1 - hsv.v} active={svDrag.active} />
          </div>
          <div className="cp-hue-row">
            <ChannelSlider
              gradient={RAINBOW_GRADIENT}
              ratio={hsv.h / 360}
              active={hueStripDrag.active}
              bind={hueStripDrag.bind}
              ariaLabel="色相"
            />
          </div>
        </div>
      ) : null}

      {mode === "spectrum" ? (
        <div className="cp-board-wrap">
          <div
            className={`cp-board cp-board-spectrum ${spectrumDrag.active ? "is-picking" : ""}`}
            style={{ background: spectrumBoardBg }}
            {...spectrumDrag.bind}
            role="slider"
            aria-label="光谱面板"
            aria-valuetext={value || "默认"}
          >
            <Cursor x={hsv.h / 360} y={1 - hsv.v} active={spectrumDrag.active} />
          </div>
          <p className="cp-board-hint">横向选择色相，纵向调整明度；松手即确认</p>
        </div>
      ) : null}

      {mode === "sliders" ? (
        <div className="cp-sliders">
          <div className="cp-slider-row">
            <span className="cp-slider-label">色相</span>
            <ChannelSlider
              gradient={RAINBOW_GRADIENT}
              ratio={hsv.h / 360}
              active={hueStripDrag.active}
              bind={hueStripDrag.bind}
              ariaLabel="色相"
            />
            <span className="cp-slider-value">{Math.round(hsv.h)}°</span>
          </div>
          <div className="cp-slider-row">
            <span className="cp-slider-label">饱和</span>
            <ChannelSlider
              gradient={`linear-gradient(to right, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 1 })})`}
              ratio={hsv.s}
              active={satStripDrag.active}
              bind={satStripDrag.bind}
              ariaLabel="饱和度"
            />
            <span className="cp-slider-value">{Math.round(hsv.s * 100)}%</span>
          </div>
          <div className="cp-slider-row">
            <span className="cp-slider-label">明度</span>
            <ChannelSlider
              gradient={`linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 1 })})`}
              ratio={hsv.v}
              active={valStripDrag.active}
              bind={valStripDrag.bind}
              ariaLabel="明度"
            />
            <span className="cp-slider-value">{Math.round(hsv.v * 100)}%</span>
          </div>
        </div>
      ) : null}

      {/* 快捷预设：辅助入口，小尺寸一行排开 */}
      <div className="cp-presets-head">
        <span>快捷预设</span>
      </div>
      <div className="cp-presets">
        {ACCENT_PRESETS.map((preset) => {
          const selected = isAuto
            ? preset.value === ""
            : preset.value !== "" && preset.value.toUpperCase() === value.toUpperCase();
          return (
            <button
              key={preset.name || "auto"}
              type="button"
              className={`cp-preset ${selected ? "is-selected" : ""} ${preset.value === "" ? "is-auto" : ""}`}
              style={preset.value ? { background: preset.value } : undefined}
              onClick={() => onChange(preset.value)}
              aria-label={preset.name}
              aria-pressed={selected}
              title={preset.name}
            />
          );
        })}
      </div>

    </div>
  );
}
