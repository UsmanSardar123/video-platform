import { Platform } from 'react-native';

export interface TabRouteItem {
  readonly name: string;
  readonly path: string;
}

// Exact bottom navbar screen order
export const TAB_ORDER: readonly TabRouteItem[] = [
  { name: 'index', path: '/main' },
  { name: 'subscriptions', path: '/main/subscriptions' },
  { name: 'explore', path: '/main/explore' },
  { name: 'profile', path: '/main/profile' },
] as const;

export const SWIPE_MIN_DX = 40;
export const SWIPE_MIN_VELOCITY = 0.25;
export const SWIPE_DIRECTION_RATIO = 1.5;

/**
 * Returns the index of the main navbar tab (0 to 3) for the given pathname.
 * Returns -1 for non-navbar screens such as /main/edit-profile.
 */
export function getTabIndexFromPathname(pathname: string): number {
  if (!pathname) return 0;
  const pathWithoutQuery = pathname.split('?')[0];
  const clean = pathWithoutQuery.replace(/\/$/, '') || '/main';
  if (clean === '/main' || clean === '') return 0;
  if (clean === '/main/subscriptions') return 1;
  if (clean === '/main/explore') return 2;
  if (clean.startsWith('/main/profile')) return 3;
  return -1;
}

/**
 * Determines whether a gesture should be recognized as a horizontal tab swipe.
 */
export function shouldSwipeTrigger(params: {
  pathname: string;
  dx: number;
  dy: number;
  isKeyboardOpen?: boolean;
  isInsideHorizontalElement?: boolean;
}): boolean {
  const { pathname, dx, dy, isKeyboardOpen = false, isInsideHorizontalElement = false } = params;

  // Disable swipes when keyboard is open or user is typing in inputs
  if (isKeyboardOpen) return false;

  // Disable swipes inside horizontal scrollable containers (e.g. category chip bar)
  if (isInsideHorizontalElement) return false;

  const currentIndex = getTabIndexFromPathname(pathname);
  if (currentIndex < 0) return false;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Must be a deliberate, predominantly horizontal motion
  if (absDx < SWIPE_MIN_DX || absDx <= absDy * SWIPE_DIRECTION_RATIO) {
    return false;
  }

  // Boundary check: cannot swipe right past first tab (Home)
  if (dx > 0 && currentIndex <= 0) {
    return false;
  }

  // Boundary check: cannot swipe left past last tab (Profile)
  if (dx < 0 && currentIndex >= TAB_ORDER.length - 1) {
    return false;
  }

  return true;
}

/**
 * Calculates the target tab route when a swipe gesture is released.
 * Returns null if the gesture does not meet threshold or hits a boundary.
 */
export function calculateNextTab(
  currentIndex: number,
  dx: number,
  vx: number = 0
): string | null {
  if (currentIndex < 0 || currentIndex >= TAB_ORDER.length) return null;

  const absDx = Math.abs(dx);
  const absVx = Math.abs(vx);

  // Must satisfy distance or velocity threshold
  const isSufficientMovement = absDx >= SWIPE_MIN_DX || (absDx >= 20 && absVx >= SWIPE_MIN_VELOCITY);
  if (!isSufficientMovement) return null;

  // Swiping left (dx < 0): navigate to next navbar screen
  if (dx < 0 && currentIndex < TAB_ORDER.length - 1) {
    return TAB_ORDER[currentIndex + 1].path;
  }

  // Swiping right (dx > 0): navigate to previous navbar screen
  if (dx > 0 && currentIndex > 0) {
    return TAB_ORDER[currentIndex - 1].path;
  }

  return null;
}

/**
 * Inspects whether a DOM target is inside a horizontally scrollable container on Web.
 */
export function isInsideHorizontalScroll(target: unknown): boolean {
  if (Platform.OS !== 'web' || !target) return false;
  try {
    let el = target as HTMLElement | null;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const isScrollable =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        el.scrollWidth > el.clientWidth;
      if (isScrollable) return true;
      el = el.parentElement;
    }
  } catch {
    // Ignore DOM inspection failures in non-DOM environments
  }
  return false;
}
