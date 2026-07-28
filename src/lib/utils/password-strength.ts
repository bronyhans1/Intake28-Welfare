export interface PasswordRequirements {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
}

export type PasswordStrength = "weak" | "medium" | "strong";

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";

  const requirements = getPasswordRequirements(password);
  const metCount = Object.values(requirements).filter(Boolean).length;

  if (metCount === 4 && password.length >= 12) {
    return "strong";
  }

  if (metCount >= 3) {
    return "medium";
  }

  return "weak";
}

export function formatCooldownTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
