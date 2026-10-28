// Client-side checks mirroring the backend User model (backend/models/User.js):
// username required, email required + format, password required + min 6 chars.
// The server still validates everything; these only give faster feedback.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

function checkEmail(email) {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address, like name@company.com.';
  return null;
}

export function validateLogin({ email = '', password = '' }) {
  const errors = {};
  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export function validateSignup({ username = '', email = '', password = '', confirmPassword = '' }) {
  const errors = {};
  if (!username.trim()) errors.username = 'Choose a username.';
  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = 'Create a password.';
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!confirmPassword) errors.confirmPassword = 'Re-enter your password.';
  else if (password && confirmPassword !== password) errors.confirmPassword = 'Passwords don’t match.';
  return errors;
}

// The backend's messages are terse; map the known ones to clearer wording.
const FRIENDLY = {
  'this email is not register': 'No account uses this email. Check it or create an account.',
  'this password is incorrect': 'That password is incorrect.',
  'this email already exist': 'An account with this email already exists. Try logging in instead.',
  'Please enter a valid Email': 'Enter a valid email address, like name@company.com.',
  'Minimum password length should be 6': `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
};

export function friendlyAuthMessage(message) {
  return FRIENDLY[message] ?? message;
}
