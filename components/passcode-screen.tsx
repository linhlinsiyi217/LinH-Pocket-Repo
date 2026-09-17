"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, Delete } from "lucide-react";

import { LockStatusBar } from "./ios-korean-lock-screen";
import {
  getPasscodeLength,
  lightHaptic,
  normalizeDigits,
  verifyPasscode,
  type PasscodeLength,
} from "@/lib/passcode-service";

/* ── 密码圆点 ── */
export function PasscodeDots({
  length,
  filled,
  shake,
}: {
  length: PasscodeLength;
  filled: number;
  shake?: boolean;
}) {
  return (
    <div className={`passcode-dots ${shake ? "is-shake" : ""}`} aria-hidden>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`passcode-dot ${i < filled ? "is-filled" : ""}`} />
      ))}
    </div>
  );
}

type KeypadKey = {
  digit: string;
  letters?: string;
};

const KEYPAD_KEYS: KeypadKey[] = [
  { digit: "1" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
];

/* ── iOS 风格数字键盘（锁屏全屏 / 设置内嵌两种尺寸） ── */
export function PasscodeKeypad({
  onDigit,
  onDelete,
  onCancel,
}: {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="passcode-keypad" role="group" aria-label="密码键盘">
      {KEYPAD_KEYS.map((key) => (
        <button
          key={key.digit}
          type="button"
          className="passcode-key"
          onClick={() => {
            lightHaptic(8);
            onDigit(key.digit);
          }}
          aria-label={key.digit}
        >
          <span className="passcode-key-num">{key.digit}</span>
          {key.letters ? <span className="passcode-key-letters">{key.letters}</span> : null}
        </button>
      ))}

      <button
        type="button"
        className="passcode-key passcode-key-side"
        onClick={onCancel}
        aria-label="取消"
      >
        {onCancel ? <span className="passcode-key-side-label">取消</span> : null}
      </button>

      <button
        type="button"
        className="passcode-key"
        onClick={() => {
          lightHaptic(8);
          onDigit("0");
        }}
        aria-label="0"
      >
        <span className="passcode-key-num">0</span>
      </button>

      <button
        type="button"
        className="passcode-key passcode-key-side"
        onClick={onDelete}
        aria-label="删除"
      >
        <Delete size={26} strokeWidth={1.8} />
      </button>
    </div>
  );
}

/**
 * 嵌入式密码输入面板（设置页的开启/验证/确认流程共用）。
 * 填满 length 位时回调 onComplete；返回字符串错误信息则 shake + 清空，
 * 返回 null 表示成功（由父组件切流程）。
 */
export function PasscodeEntryPanel({
  title,
  subtitle,
  length,
  onComplete,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  length: PasscodeLength;
  onComplete: (digits: string) => Promise<string | null> | string | null;
  onCancel: () => void;
}) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const reset = useCallback((message?: string) => {
    setEntered("");
    setShake(true);
    setError(message ?? null);
    window.setTimeout(() => setShake(false), 460);
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      if (busyRef.current) return;
      setError(null);
      setEntered((prev) => {
        if (prev.length >= length) return prev;
        return prev + digit;
      });
    },
    [length]
  );

  const handleDelete = useCallback(() => {
    if (busyRef.current) return;
    setEntered((prev) => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    if (entered.length !== length || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const digits = entered;
    // 短延迟让最后一个圆点先填上，给一个「确认中」的视觉节奏
    const timer = window.setTimeout(() => {
      Promise.resolve(onComplete(digits))
        .then((message) => {
          busyRef.current = false;
          setBusy(false);
          if (message !== null) reset(message);
        })
        .catch(() => {
          busyRef.current = false;
          setBusy(false);
          reset("操作失败，请重试");
        });
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, length]);

  // 物理键盘：数字 / 退格 / Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
      else if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit, handleDelete, onCancel]);

  return (
    <div className="passcode-panel">
      <h4 className="passcode-panel-title">{title}</h4>
      {subtitle ? <p className="passcode-panel-subtitle">{subtitle}</p> : null}
      <div className="passcode-panel-message" aria-live="polite">
        {error ?? "\u00A0"}
      </div>
      <PasscodeDots length={length} filled={entered.length} shake={shake} />
      <PasscodeKeypad onDigit={handleDigit} onDelete={handleDelete} onCancel={onCancel} />
      {busy ? <span className="passcode-panel-busy" aria-label="校验中" /> : null}
    </div>
  );
}

/* ── 锁屏密码全屏页（LOCKED 上滑后、进入主页前） ── */
type ScreenStatus = "idle" | "checking" | "error" | "success" | "exiting";

export function PasscodeScreen({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
  const [length, setLength] = useState<PasscodeLength>(() => getPasscodeLength());
  const [entered, setEntered] = useState("");
  const [status, setStatus] = useState<ScreenStatus>("idle");
  const statusRef = useRef<ScreenStatus>("idle");
  const enteredRef = useRef("");

  useEffect(() => {
    setLength(getPasscodeLength());
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const setStatusBoth = (next: ScreenStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const triggerError = useCallback(() => {
    lightHaptic(60);
    setStatusBoth("error");
    window.setTimeout(() => {
      enteredRef.current = "";
      setEntered("");
      setStatusBoth("idle");
    }, 520);
  }, []);

  const finishSuccess = useCallback(() => {
    setStatusBoth("exiting");
    window.setTimeout(() => onSuccess(), 300);
  }, [onSuccess]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (statusRef.current !== "idle") return;
      const next = (enteredRef.current + digit).slice(0, length);
      enteredRef.current = next;
      setEntered(next);
      if (next.length !== length) return;

      setStatusBoth("checking");
      // 短确认反馈：圆点填满后停一下再校验
      window.setTimeout(() => {
        void verifyPasscode(next).then((ok) => {
          if (!ok) {
            triggerError();
            return;
          }
          lightHaptic(10);
          setStatusBoth("success");
          window.setTimeout(finishSuccess, 220);
        });
      }, 120);
    },
    [finishSuccess, length, triggerError]
  );

  const handleDelete = useCallback(() => {
    if (statusRef.current !== "idle") return;
    const next = enteredRef.current.slice(0, -1);
    enteredRef.current = next;
    setEntered(next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
      else if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit, handleDelete, onCancel]);

  const busy = status === "checking" || status === "success";

  return (
    <main className="ios-lock-root passcode-root min-h-screen bg-[#edf0f4] flex items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className={`ios-lock-card passcode-card ${status === "exiting" ? "is-exiting" : ""}`}
      >
        <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(145deg,#f8fafc_0%,#e9edf2_38%,#d5dbe3_100%)]" />
        <LockStatusBar time={time} />

        <div className="passcode-screen-body">
          <div className="passcode-lock-glyph" aria-hidden>
            <LockKeyhole size={22} strokeWidth={2} />
          </div>
          <h2 className="passcode-title">输入密码</h2>
          <p className={`passcode-message ${status === "error" ? "is-error" : ""}`} aria-live="polite">
            {status === "error" ? "密码错误，请再试一次" : "\u00A0"}
          </p>
          <PasscodeDots
            length={length}
            filled={entered.length}
            shake={status === "error"}
          />
        </div>

        <div className="passcode-screen-keypad">
          <PasscodeKeypad
            onDigit={handleDigit}
            onDelete={handleDelete}
            onCancel={busy ? undefined : onCancel}
          />
        </div>
      </div>
    </main>
  );
}
