const LOGIN_SPLASH_KEY = 'japanflow-login-splash-shown';

export function hasShownLoginSplash() {
  if (typeof window === 'undefined') return true;
  return sessionStorage.getItem(LOGIN_SPLASH_KEY) === 'true';
}

export function markLoginSplashAsShown() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LOGIN_SPLASH_KEY, 'true');
}

export function resetLoginSplash() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(LOGIN_SPLASH_KEY);
}
