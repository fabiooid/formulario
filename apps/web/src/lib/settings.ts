const AUTH_PATHS = new Set(['/login', '/register', '/password'])

let returnPath = '/'

export function isSettingsPath(pathname: string) {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}

export function trackSettingsReturnPath(pathname: string) {
  if (isSettingsPath(pathname) || AUTH_PATHS.has(pathname)) return
  returnPath = pathname
}

export function getSettingsReturnPath() {
  return returnPath
}
