/**
 * Auth transport.
 *
 * The UI talks to this small interface only. `demoTransport` runs entirely on
 * the device (that is what ships in this prototype). To go live you implement
 * the same three methods on top of MTProto (TDLib / GramJS / a native bridge)
 * and swap the export — nothing in the screens has to change.
 */

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** Demo builds show the expected code/password so the flow can be exercised. */
  hint?: string;
}

export interface AuthTransport {
  requestCode(phone: string): Promise<AuthResult>;
  verifyCode(phone: string, code: string): Promise<AuthResult>;
  verifyPassword(password: string): Promise<{ ok: boolean; error?: string; hint?: string }>;
  sessionName(phone: string): string;
}

export const DEMO_CODE = "12345";
export const DEMO_PASSWORD = "wiredgram";

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const digits = (value: string): string => value.replace(/\D+/g, "");

export const demoTransport: AuthTransport = {
  async requestCode(phone) {
    await wait(520);
    if (digits(phone).length < 8) {
      return { ok: false, error: "Слишком короткий номер — нужно минимум 8 цифр." };
    }
    return { ok: true, hint: DEMO_CODE };
  },

  async verifyCode(_phone, code) {
    await wait(650);
    if (digits(code) !== DEMO_CODE) {
      return { ok: false, error: "Неверный код. Подсказка: 12345", hint: DEMO_CODE };
    }
    return { ok: true };
  },

  async verifyPassword(password) {
    await wait(650);
    if (password.trim().toLowerCase() !== DEMO_PASSWORD) {
      return { ok: false, error: "Неверный пароль. Подсказка: wiredgram", hint: DEMO_PASSWORD };
    }
    return { ok: true };
  },

  sessionName(phone) {
    const last = digits(phone).slice(-4);
    return `Wired User ${last}`;
  },
};

/** The one place to swap transports. */
export const transport: AuthTransport = demoTransport;

export const COUNTRIES = [
  { code: "+7", label: "🇷🇺 +7" },
  { code: "+380", label: "🇺🇦 +380" },
  { code: "+375", label: "🇧🇾 +375" },
  { code: "+77", label: "🇰🇿 +77" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+48", label: "🇵🇱 +48" },
  { code: "+90", label: "🇹🇷 +90" },
  { code: "+995", label: "🇬🇪 +995" },
];
