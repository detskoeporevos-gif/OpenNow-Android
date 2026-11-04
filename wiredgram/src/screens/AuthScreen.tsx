import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Icon } from "../components/Icon";
import { COUNTRIES, DEMO_CODE, DEMO_PASSWORD, transport } from "../state/auth";
import { signIn, toast } from "../state/store";

type Step = "phone" | "code" | "password";

const CODE_LEN = 5;
const RESEND_SECONDS = 45;

/** 9001234567 → «900 123 45 67» (3-3-2-2, then the rest). */
function formatPhone(digitsValue: string): string {
  const d = digitsValue.slice(0, 12);
  const parts: string[] = [];
  let cursor = 0;
  for (const size of [3, 3, 2, 2]) {
    if (cursor >= d.length) break;
    parts.push(d.slice(cursor, cursor + size));
    cursor += size;
  }
  if (cursor < d.length) parts.push(d.slice(cursor));
  return parts.join(" ");
}

export function AuthScreen(): JSX.Element {
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [resendIn, setResendIn] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const fullPhone = useMemo(() => `${country}${phone.replace(/\D+/g, "")}`, [country, phone]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const fail = useCallback((message: string) => {
    setError(message);
    setShake((s) => s + 1);
  }, []);

  const requestCode = useCallback(async () => {
    setError(null);
    setBusy(true);
    const result = await transport.requestCode(fullPhone);
    setBusy(false);
    if (!result.ok) {
      fail(result.error ?? "Не удалось отправить код.");
      return;
    }
    setStep("code");
    setCode("");
    setResendIn(RESEND_SECONDS);
    toast(`Код отправлен на ${fullPhone}`, "ok");
    window.setTimeout(() => otpRefs.current[0]?.focus(), 60);
  }, [fail, fullPhone]);

  const verifyCode = useCallback(
    async (value: string) => {
      if (busy) return;
      if (value.length < CODE_LEN) {
        fail("Введите все 5 цифр кода.");
        return;
      }
      setBusy(true);
      setError(null);
      const result = await transport.verifyCode(fullPhone, value);
      setBusy(false);
      if (!result.ok) {
        fail(result.error ?? "Неверный код.");
        setCode("");
        otpRefs.current[0]?.focus();
        return;
      }
      setStep("password");
    },
    [busy, fail, fullPhone],
  );

  const verifyPassword = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await transport.verifyPassword(password);
    if (!result.ok) {
      setBusy(false);
      fail(result.error ?? "Неверный пароль.");
      return;
    }
    await signIn({
      userId: `u_${fullPhone.replace(/\D+/g, "")}`,
      name: transport.sessionName(fullPhone),
      phone: fullPhone,
      createdAt: Date.now(),
    });
  }, [busy, fail, fullPhone, password]);

  const guest = useCallback(() => {
    void signIn({
      userId: "u_guest",
      name: "Wired Guest",
      phone: "+7 900 000 00 00",
      createdAt: Date.now(),
    });
  }, []);

  const onOtpChange = (index: number, raw: string): void => {
    const clean = raw.replace(/\D+/g, "");
    if (!clean) {
      const next = code.split("");
      next[index] = "";
      setCode(next.join("").slice(0, CODE_LEN));
      return;
    }
    const chars = code.split("");
    for (let i = 0; i < clean.length && index + i < CODE_LEN; i++) {
      chars[index + i] = clean[i];
    }
    const nextCode = chars.join("").slice(0, CODE_LEN);
    setCode(nextCode);
    const focusIndex = Math.min(index + clean.length, CODE_LEN - 1);
    otpRefs.current[focusIndex]?.focus();
    if (nextCode.length === CODE_LEN) void verifyCode(nextCode);
  };

  const onOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < CODE_LEN - 1) otpRefs.current[index + 1]?.focus();
  };

  const onOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    const clean = e.clipboardData.getData("text").replace(/\D+/g, "").slice(0, CODE_LEN);
    if (!clean) return;
    e.preventDefault();
    setCode(clean);
    if (clean.length === CODE_LEN) void verifyCode(clean);
  };

  const onBack = (): void => {
    setError(null);
    if (step === "code") setStep("phone");
    else if (step === "password") setStep("code");
  };

  return (
    <div className="screen auth" data-anim="fade-in">
      <div className="auth__aurora" />
      <div className="auth__grid" />

      <div className="auth__top">
        <div className="auth__logo">
          <Icon name="wired" size={44} strokeWidth={2.4} />
        </div>
        <h1 className="auth__title">WiredGram</h1>
        <p className="auth__sub">
          {step === "phone" && "Быстрый и лёгкий мессенджер. Войдите по номеру телефона."}
          {step === "code" && "Мы отправили код подтверждения — введите 5 цифр."}
          {step === "password" && "Аккаунт защищён двухфакторной аутентификацией."}
        </p>
      </div>

      <div className="auth__card" key={`card-${step}`} data-shake={shake}>
        <div className="auth__steps">
          <span className="auth__dot" data-active={step === "phone"} />
          <span className="auth__dot" data-active={step === "code"} />
          <span className="auth__dot" data-active={step === "password"} />
        </div>

        {step !== "phone" && (
          <button className="btn btn--ghost" style={{ height: 36, alignSelf: "flex-start", padding: "0 12px", fontSize: "0.8rem" }} onClick={onBack}>
            <Icon name="back" size={16} /> Назад
          </button>
        )}

        {step === "phone" && (
          <>
            <div className="field">
              <span className="label">Номер телефона</span>
              <div className="phone-row">
                <div className="country">
                  <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Код страны">
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-wrap" style={{ flex: 1 }}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="900 123 45 67"
                    value={formatPhone(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D+/g, "").slice(0, 12))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) void requestCode();
                    }}
                  />
                </div>
              </div>
            </div>

            <button className="btn btn--primary btn--block" disabled={busy} onClick={() => void requestCode()}>
              {busy ? "Отправляем…" : "Получить код"}
              {!busy && <Icon name="next" size={18} />}
            </button>

            <button className="btn btn--ghost btn--block" onClick={guest}>
              Войти как гость
            </button>

            <p className="hint" style={{ textAlign: "center" }}>
              Демо-режим: подойдёт любой номер, код <b>12345</b>, пароль 2FA <b>wiredgram</b>.
            </p>
          </>
        )}

        {step === "code" && (
          <>
            <div className="field">
              <span className="label">Код из сообщения</span>
              <div className="otp">
                {Array.from({ length: CODE_LEN }).map((_, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={code[index] ?? ""}
                    onChange={(e) => onOtpChange(index, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(index, e)}
                    onPaste={onOtpPaste}
                    aria-label={`Цифра ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <span className="code-hint">
              <Icon name="shield" size={14} /> Демо-код: {DEMO_CODE}
            </span>

            <button className="btn btn--primary btn--block" disabled={busy || code.length < CODE_LEN} onClick={() => void verifyCode(code)}>
              {busy ? "Проверяем…" : "Подтвердить"}
            </button>

            <button
              className="btn btn--ghost btn--block"
              disabled={resendIn > 0 || busy}
              onClick={() => void requestCode()}
            >
              {resendIn > 0 ? `Отправить снова через ${resendIn} с` : "Отправить код снова"}
            </button>
          </>
        )}

        {step === "password" && (
          <>
            <div className="field">
              <span className="label">Пароль двухфакторной аутентификации</span>
              <div className="input-wrap">
                <Icon name="lock" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void verifyPassword();
                  }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 32, height: 32 }}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </div>

            <span className="code-hint">
              <Icon name="shield" size={14} /> Демо-пароль: {DEMO_PASSWORD}
            </span>

            <button className="btn btn--primary btn--block" disabled={busy || password.length < 4} onClick={() => void verifyPassword()}>
              {busy ? "Входим…" : "Войти в аккаунт"}
              {!busy && <Icon name="check" size={18} />}
            </button>
          </>
        )}

        {error && (
          <div className="hint" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}
      </div>

      <p className="auth__foot">
        WiredGram · демо-клиент · данные хранятся только на этом устройстве
      </p>
    </div>
  );
}
