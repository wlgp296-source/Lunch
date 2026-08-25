export function currentScreen() {
  return window.location.hash.replace('#', '').split('?')[0] || 'home';
}

export function go(screen) {
  window.location.hash = screen;
}

export function routeParams() {
  const query = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(query);
}

function getAppBaseUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : window.location.origin;
}

export function createInviteUrl(code) {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  const path = configuredUrl ? '/' : window.location.pathname;
  return `${getAppBaseUrl()}${path}#team-join?code=${encodeURIComponent(code)}`;
}

export function isLocalAppUrl() {
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(new URL(getAppBaseUrl()).hostname);
  } catch {
    return true;
  }
}
