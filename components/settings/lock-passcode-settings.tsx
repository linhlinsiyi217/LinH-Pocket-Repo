"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, LockKeyhole, ShieldCheck } from "lucide-react";

import { Toggle } from "../ui/form";
import { PasscodeEntryPanel } from "../passcode-screen";
import {
  clearPasscode,
  getPasscodeLength,
  isPasscodeEnabled,
  savePasscode,
  subscribePasscodeChanges,
  verifyPasscode,
  type PasscodeLength,
} from "@/lib/passcode-service";

type FlowView = "menu" | "selectLength" | "enterNew" | "confirm" | "verifyCurrent";
type FlowAction = "enable" | "change" | "disable" | "switchLength";

type Props = {
  onNotice: (message: string) => void;
};

const FLOW_TITLE: Record<Exclude<FlowView, "menu">, string> = {
  selectLength: "选择密码位数",
  enterNew: "设置新密码",
  confirm: "确认新密码",
  verifyCurrent: "输入当前密码",
};

export function LockPasscodeSettings({ onNotice }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [currentLength, setCurrentLength] = useState<PasscodeLength>(4);
  const [view, setView] = useState<FlowView>("menu");
  const [action, setAction] = useState<FlowAction>("enable");
  const [draftLength, setDraftLength] = useState<PasscodeLength>(4);
  const [firstCode, setFirstCode] = useState("");
  // 每次进入输入视图自增，强制面板重置内部输入
  const [flowAttempt, setFlowAttempt] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setEnabled(isPasscodeEnabled());
      setCurrentLength(getPasscodeLength());
    };
    refresh();
    return subscribePasscodeChanges(refresh);
  }, []);

  const gotoMenu = () => {
    setView("menu");
    setFirstCode("");
  };

  const startFlow = (nextAction: FlowAction, nextView: FlowView) => {
    setAction(nextAction);
    if (nextAction === "change") setDraftLength(currentLength);
    else if (nextAction === "enable") setDraftLength(currentLength);
    setFlowAttempt((n) => n + 1);
    setView(nextView);
  };

  const handleSwitch = (next: boolean) => {
    if (next) {
      startFlow("enable", "selectLength");
    } else {
      // 关闭必须先验证当前密码，不能一键取消保护
      startFlow("disable", "verifyCurrent");
    }
  };

  const handleVerifyCurrent = async (digits: string): Promise<string | null> => {
    const ok = await verifyPasscode(digits);
    if (!ok) return "密码错误，请再试一次";

    if (action === "disable") {
      clearPasscode();
      onNotice("已关闭锁屏密码");
      gotoMenu();
      return null;
    }
    if (action === "change") {
      setDraftLength(currentLength);
      setFlowAttempt((n) => n + 1);
      setView("enterNew");
      return null;
    }
    // switchLength：验证通过后选择新位数
    setView("selectLength");
    return null;
  };

  const handleEnterNew = (digits: string): string | null => {
    setFirstCode(digits);
    setFlowAttempt((n) => n + 1);
    setView("confirm");
    return null;
  };

  const handleConfirm = async (digits: string): Promise<string | null> => {
    if (digits !== firstCode) {
      // 保留第一次输入，面板自行 shake + 清空确认码，要求重新输入
      return "两次输入的密码不一致，请重新输入";
    }
    await savePasscode(digits, draftLength);
    onNotice(action === "change" ? "锁屏密码已更新" : "已开启锁屏密码");
    gotoMenu();
    return null;
  };

  if (view === "menu") {
    return (
      <div className="lock-passcode-settings">
        <div className="menu-group settings-group">
          <div className="menu-item settings-cell settings-tools-menu-item">
            <span className="card-icon card-icon-glass">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </span>
            <span className="settings-tools-menu-copy">
              <span className="menu-label appearance-menu-item-label">开启密码</span>
              <span className="menu-desc settings-tools-menu-desc">
                上滑锁屏后需输入数字密码
              </span>
            </span>
            <span className="menu-right settings-tools-menu-toggle">
              <Toggle checked={enabled} onChange={handleSwitch} className="settings-toggle-control" />
            </span>
          </div>
        </div>

        {enabled ? (
          <>
            <div className="menu-group settings-group">
              <button
                type="button"
                className="menu-item settings-cell settings-tools-menu-item w-full text-left"
                onClick={() => startFlow("switchLength", "verifyCurrent")}
              >
                <span className="card-icon card-icon-glass">
                  <ShieldCheck size={20} strokeWidth={1.8} />
                </span>
                <span className="settings-tools-menu-copy">
                  <span className="menu-label appearance-menu-item-label">密码位数</span>
                  <span className="menu-desc settings-tools-menu-desc">切换 4 位 / 6 位需验证当前密码</span>
                </span>
                <span className="menu-right settings-update-row-right">
                  <span className="lock-passcode-length-value">{currentLength} 位</span>
                  <ChevronRight size={17} className="settings-account-chevron" />
                </span>
              </button>

              <button
                type="button"
                className="menu-item settings-cell settings-tools-menu-item w-full text-left"
                onClick={() => startFlow("change", "verifyCurrent")}
              >
                <span className="card-icon card-icon-glass">
                  <LockKeyhole size={20} strokeWidth={1.8} />
                </span>
                <span className="settings-tools-menu-copy">
                  <span className="menu-label appearance-menu-item-label">修改密码</span>
                  <span className="menu-desc settings-tools-menu-desc">先验证当前密码，再设置新密码</span>
                </span>
                <span className="menu-right settings-update-row-right">
                  <ChevronRight size={17} className="settings-account-chevron" />
                </span>
              </button>

              <button
                type="button"
                className="menu-item settings-cell settings-tools-menu-item w-full text-left"
                onClick={() => startFlow("disable", "verifyCurrent")}
              >
                <span className="card-icon card-icon-glass">
                  <LockKeyhole size={20} strokeWidth={1.8} />
                </span>
                <span className="settings-tools-menu-copy">
                  <span className="menu-label appearance-menu-item-label" style={{ color: "var(--c-danger, #ff3b30)" }}>
                    关闭密码
                  </span>
                  <span className="menu-desc settings-tools-menu-desc">需验证当前密码</span>
                </span>
                <span className="menu-right settings-update-row-right">
                  <ChevronRight size={17} className="settings-account-chevron" />
                </span>
              </button>
            </div>

            <p className="lock-passcode-note">
              密码以随机盐 + SHA-256 摘要保存在本机，不存明文；这是模拟手机的锁屏体验，并非设备级安全。
            </p>
          </>
        ) : (
          <p className="lock-passcode-note">
            开启后，上滑锁屏需输入 4 位或 6 位数字密码才能进入。
          </p>
        )}
      </div>
    );
  }

  if (view === "selectLength") {
    return (
      <div className="lock-passcode-settings">
        <div className="menu-group settings-group lock-passcode-length-group">
          {([4, 6] as PasscodeLength[]).map((value) => (
            <button
              key={value}
              type="button"
              className="menu-item settings-cell settings-tools-menu-item w-full text-left"
              onClick={() => setDraftLength(value)}
              aria-pressed={draftLength === value}
            >
              <span className="settings-tools-menu-copy">
                <span className="menu-label appearance-menu-item-label">{value} 位密码</span>
              </span>
              <span className="menu-right settings-update-row-right">
                {draftLength === value ? (
                  <Check size={18} style={{ color: "var(--c-accent, var(--c-action-blue, #0a84ff))" }} />
                ) : null}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="lock-passcode-primary"
          onClick={() => {
            setFlowAttempt((n) => n + 1);
            setView("enterNew");
          }}
        >
          下一步
        </button>
      </div>
    );
  }

  const subtitleMap: Partial<Record<FlowView, string>> = {
    enterNew: `请输入 ${draftLength} 位数字`,
    confirm: `请再次输入 ${draftLength} 位数字`,
    verifyCurrent: `请输入当前的 ${currentLength} 位密码`,
  };

  return (
    <PasscodeEntryPanel
      key={`${view}-${flowAttempt}`}
      title={FLOW_TITLE[view as Exclude<FlowView, "menu" | "selectLength">] ?? "输入密码"}
      subtitle={subtitleMap[view]}
      length={view === "verifyCurrent" ? currentLength : draftLength}
      onCancel={gotoMenu}
      onComplete={
        view === "verifyCurrent"
          ? handleVerifyCurrent
          : view === "enterNew"
            ? handleEnterNew
            : handleConfirm
      }
    />
  );
}
