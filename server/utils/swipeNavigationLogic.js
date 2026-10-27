// Pure logic mirroring video-platform/src/lib/swipe-navigation.ts for automated test verification

const TAB_ORDER = [
  { name: 'index', path: '/main' },
  { name: 'subscriptions', path: '/main/subscriptions' },
  { name: 'explore', path: '/main/explore' },
  { name: 'profile', path: '/main/profile' },
];

const SWIPE_MIN_DX = 40;
const SWIPE_MIN_VELOCITY = 0.25;
const SWIPE_DIRECTION_RATIO = 1.5;

function getTabIndexFromPathname(pathname) {
  if (!pathname) return 0;
  const pathWithoutQuery = pathname.split('?')[0];
  const clean = pathWithoutQuery.replace(/\/$/, '') || '/main';
  if (clean === '/main' || clean === '') return 0;
  if (clean === '/main/subscriptions') return 1;
  if (clean === '/main/explore') return 2;
  if (clean.startsWith('/main/profile')) return 3;
  return -1;
}

function shouldSwipeTrigger({
  pathname,
  dx,
  dy,
  isKeyboardOpen = false,
  isInsideHorizontalElement = false,
}) {
  if (isKeyboardOpen) return false;
  if (isInsideHorizontalElement) return false;

  const currentIndex = getTabIndexFromPathname(pathname);
  if (currentIndex < 0) return false;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

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

function calculateNextTab(currentIndex, dx, vx = 0) {
  if (currentIndex < 0 || currentIndex >= TAB_ORDER.length) return null;

  const absDx = Math.abs(dx);
  const absVx = Math.abs(vx);

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

module.exports = {
  TAB_ORDER,
  SWIPE_MIN_DX,
  SWIPE_MIN_VELOCITY,
  SWIPE_DIRECTION_RATIO,
  getTabIndexFromPathname,
  shouldSwipeTrigger,
  calculateNextTab,
};
