export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

const COMMON_PASSWORDS = [
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
  "letmein", "trustno1", "dragon", "baseball", "111111", "iloveyou", "master",
  "sunshine", "ashley", "bailey", "passw0rd", "shadow", "123123", "654321",
  "superman", "qazwsx", "michael", "football", "welcome", "jesus", "ninja",
  "mustang", "password123", "admin", "root", "toor", "test", "guest",
];

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password) {
    errors.push("Password is required");
    return { isValid: false, errors };
  }

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&* etc)");
  }

  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push("Password is too common. Please choose a stronger password");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
