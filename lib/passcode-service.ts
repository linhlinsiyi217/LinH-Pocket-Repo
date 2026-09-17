"use client";

/**
 * 锁屏密码服务（模拟手机内部的锁屏体验，非设备级安全）。
 *
 * 设计约束：
 * - 全 App 唯一的密码读写入口，组件里不允许各自持久化/校验；
 * - 只持久化「是否启用 / 位数 / 随机盐 + SHA-256 摘要」，localStorage 中没有明文；
 * - 不 console.log 密码、不把明文写进任何调试字段；
 * - SHA-256 + 每设备随机盐只防「随手翻本地存储读到明文」，
 *   拿到本机控制权的攻击者仍可破解，不宣称等同真实设备安全。
 */

const STORAGE_KEY = "ai_phone_lock_passcode_v1";
export const PASSCODE_CHANGED_EVENT = "ai-phone-passcode-changed";

/** 切到后台超过该时长再回来 → 重新锁屏。集中配置，方便以后调整。 */
export const LOCK_RELOCK_GRACE_MS = 30_000;

export type PasscodeLength = 4 | 6;

type StoredPasscode = {
  v: 1;
  alg: "sha-256";
  salt: string;
  hash: string;
  length: PasscodeLength;
};

function readRecord(): StoredPasscode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPasscode>;
    if (
      parsed.v === 1
      && parsed.alg === "sha-256"
      && typeof parsed.salt === "string"
      && typeof parsed.hash === "string"
      && (parsed.length === 4 || parsed.length === 6)
    ) {
      return parsed as StoredPasscode;
    }
    return null;
  } catch {
    return null;
  }
}

function writeRecord(record: StoredPasscode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent(PASSCODE_CHANGED_EVENT));
  } catch {
    // 存储不可用（隐私模式等）：静默失败，设置页会表现为未启用，不影响其它功能。
  }
}

export function isPasscodeEnabled(): boolean {
  return readRecord() !== null;
}

export function getPasscodeLength(): PasscodeLength {
  return readRecord()?.length ?? 4;
}

/** 订阅密码配置变化（设置页保存/关闭后即时刷新菜单）。返回退订函数。 */
export function subscribePasscodeChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(PASSCODE_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PASSCODE_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** 只允许 4/6 位纯数字，其余一律拒绝。 */
export function normalizeDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

async function digest(digits: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`passcode:${salt}:${digits}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toBase64(hash);
}

/** 定长比较，尽量避免提前返回造成的计时差异。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyPasscode(digits: string): Promise<boolean> {
  const record = readRecord();
  if (!record) return false;
  const normalized = normalizeDigits(digits);
  if (normalized.length !== record.length) return false;
  try {
    const candidate = await digest(normalized, record.salt);
    return timingSafeEqual(candidate, record.hash);
  } catch {
    return false;
  }
}

export async function savePasscode(digits: string, length: PasscodeLength): Promise<void> {
  const normalized = normalizeDigits(digits);
  if (normalized.length !== length) {
    throw new Error("passcode length mismatch");
  }
  const salt = randomSalt();
  const hash = await digest(normalized, salt);
  writeRecord({ v: 1, alg: "sha-256", salt, hash, length });
}

export function clearPasscode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(PASSCODE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** 极轻触觉反馈；不支持的平台静默忽略。 */
export function lightHaptic(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}
