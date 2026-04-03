import React, { useState } from "react";
import { Lock, AlertCircle, Loader2, LogIn } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { storageService } from "../../services/storage";
import { useViewportScale } from "../../hooks/useViewportScale";
import { getIconSize } from "../../utils/favicon";

interface AuthScreenProps {
  onAuthenticated: () => void;
  onCancel: () => void;
  isDefaultCode: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  onCancel,
  isDefaultCode,
}) => {
  const { t } = useLanguage();
  const viewportScale = useViewportScale();
  const s = (n: number) => getIconSize(n, viewportScale);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError("");

    try {
      const success = await storageService.login(authInput);
      if (success) {
        onAuthenticated();
      } else {
        setAuthError(t("incorrect_code"));
      }
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMITED") {
        setAuthError(t("login_rate_limited"));
      } else {
        setAuthError(t("incorrect_code"));
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="p-12 h-full flex flex-col items-center justify-center text-center space-y-6"
      style={{ backgroundColor: "var(--modal-surface)" }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-2 border shadow-inner"
        style={{ backgroundColor: "var(--modal-surface-alt)", borderColor: "var(--modal-border)" }}
      >
        <Lock size={s(40)} style={{ color: "var(--modal-text-secondary)" }} />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--modal-text)" }}>
          {t("admin_access")}
        </h2>
        <p className="text-sm" style={{ color: "var(--modal-text-secondary)" }}>
          {t("enter_code_msg")}
        </p>
        {isDefaultCode && (
          <p className="text-emerald-400/90 text-xs mt-3 font-mono bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3 rounded-md inline-block">
            {t("default_code")}
          </p>
        )}
      </div>
      <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
        <input
          type="password"
          value={authInput}
          onChange={(e) => setAuthInput(e.target.value)}
          className="input-primary py-3 px-4 text-center tracking-widest text-lg"
          placeholder="••••"
          autoFocus
        />
        {authError && (
          <div className="text-red-400 text-sm animate-pulse flex items-center justify-center gap-1">
            <AlertCircle size={s(14)} /> {authError}
          </div>
        )}
        <button type="submit" className="btn-primary w-full py-3 rounded-xl text-base">
          {isVerifying ? <Loader2 className="animate-spin" size={s(18)} /> : <LogIn size={s(18)} />}{" "}
          {t("unlock_btn")}
        </button>
      </form>
      <button
        onClick={onCancel}
        className="text-slate-500 hover:text-slate-300 text-sm mt-4 transition-colors"
      >
        {t("cancel")}
      </button>
    </div>
  );
};
