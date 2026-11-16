/** Lets stores outside React navigate (for example a toast action). AppShell registers the router's navigate. */
let navigator: (path: string) => void = (path) => window.location.assign(path);

export function setNavigator(fn: (path: string) => void): void {
  navigator = fn;
}

export function go(path: string): void {
  navigator(path);
}

export function currentPath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}
