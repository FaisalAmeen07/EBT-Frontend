export type ValidationResult = { ok: true } | { ok: false; error: string };

const emailRegex =
  // pragmatic email validation; backend remains source of truth
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const specialRegex = /[^A-Za-z0-9]/;
const upperRegex = /[A-Z]/;
const lowerRegex = /[a-z]/;
const numberRegex = /[0-9]/;

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function validateEmail(email: string): ValidationResult {
  const e = normalizeEmail(email);
  if (!e) return { ok: false, error: 'Email is required.' };
  if (e.length > 254) return { ok: false, error: 'Email is too long.' };
  if (!emailRegex.test(e)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true };
}

export function validateOtp(otp: string): ValidationResult {
  const s = String(otp || '').replace(/\D/g, '');
  if (s.length !== 6) return { ok: false, error: 'OTP must be 6 digits.' };
  return { ok: true };
}

export function normalizePhone(phone: string): string {
  return String(phone || '').trim().replace(/\s+/g, ' ');
}

export function validatePhone(phone: string): ValidationResult {
  const raw = normalizePhone(phone);
  if (!raw) return { ok: false, error: 'Phone is required.' };
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 10) return { ok: false, error: 'Phone number is too short.' };
  if (digits.length > 16) return { ok: false, error: 'Phone number is too long.' };
  if (!/^[+\d][\d\s()-]*$/.test(raw)) return { ok: false, error: 'Enter a valid phone number.' };
  return { ok: true };
}

export function validateName(name: string): ValidationResult {
  const s = String(name || '').trim().replace(/\s+/g, ' ');
  if (!s) return { ok: false, error: 'Name is required.' };
  if (s.length < 2) return { ok: false, error: 'Name is too short.' };
  if (s.length > 80) return { ok: false, error: 'Name is too long.' };
  if (!/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(s)) {
    return { ok: false, error: 'Name must contain English letters only.' };
  }
  return { ok: true };
}

export type PasswordStrength = {
  minLen: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
};

export function passwordStrength(password: string): PasswordStrength {
  const p = String(password || '');
  return {
    minLen: p.length >= 8,
    upper: upperRegex.test(p),
    lower: lowerRegex.test(p),
    number: numberRegex.test(p),
    special: specialRegex.test(p),
  };
}

export function validatePasswordStrong(password: string): ValidationResult {
  const s = passwordStrength(password);
  if (s.minLen && s.upper && s.lower && s.number && s.special) return { ok: true };
  return {
    ok: false,
    error: 'Password must be 8+ chars and include upper, lower, number, and special character.',
  };
}

export function validateDepartment(department: string, allowedDepartments: string[]): ValidationResult {
  const d = String(department || '').trim();
  if (!d) return { ok: false, error: 'Department is required.' };
  if (!Array.isArray(allowedDepartments) || allowedDepartments.length === 0) {
    return { ok: false, error: 'No department is configured. Contact admin.' };
  }
  if (!allowedDepartments.includes(d)) return { ok: false, error: 'Invalid department.' };
  return { ok: true };
}

