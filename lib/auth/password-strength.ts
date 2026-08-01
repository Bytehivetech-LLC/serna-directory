export type PasswordStrength = {
  /** 0 (empty) … 4 (strong) */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** 0–100 for the meter width. */
  percent: number;
};

const LABELS: Record<number, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

/**
 * Lightweight password strength estimate for the register meter. Shared, pure,
 * client-safe. The server still enforces the real minimum (8+ chars) via Zod;
 * this only guides the user toward something stronger.
 */
export function scorePassword(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", percent: 0 };

  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;

  // Anything under the 8-char minimum can never read above "Weak".
  const score = (password.length < 8
    ? 1
    : Math.min(4, Math.max(1, points - 1))) as PasswordStrength["score"];

  return { score, label: LABELS[score], percent: (score / 4) * 100 };
}
