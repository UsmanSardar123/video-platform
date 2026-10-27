const {
  TAB_ORDER,
  SWIPE_MIN_DX,
  SWIPE_MIN_VELOCITY,
  SWIPE_DIRECTION_RATIO,
  getTabIndexFromPathname,
  shouldSwipeTrigger,
  calculateNextTab,
} = require('../../utils/swipeNavigationLogic');

describe('Swipe Navigation between Main App Screens', () => {
  describe('Navbar Tab Order and Index Resolution', () => {
    it('has exactly 4 main screens in the exact navbar order', () => {
      expect(TAB_ORDER).toHaveLength(4);
      expect(TAB_ORDER[0]).toEqual({ name: 'index', path: '/main' });
      expect(TAB_ORDER[1]).toEqual({ name: 'subscriptions', path: '/main/subscriptions' });
      expect(TAB_ORDER[2]).toEqual({ name: 'explore', path: '/main/explore' });
      expect(TAB_ORDER[3]).toEqual({ name: 'profile', path: '/main/profile' });
    });

    it('resolves correct tab index for each main screen', () => {
      expect(getTabIndexFromPathname('/main')).toBe(0);
      expect(getTabIndexFromPathname('/main/')).toBe(0);
      expect(getTabIndexFromPathname('')).toBe(0);
      expect(getTabIndexFromPathname('/main/subscriptions')).toBe(1);
      expect(getTabIndexFromPathname('/main/subscriptions/')).toBe(1);
      expect(getTabIndexFromPathname('/main/explore')).toBe(2);
      expect(getTabIndexFromPathname('/main/explore/')).toBe(2);
      expect(getTabIndexFromPathname('/main/profile')).toBe(3);
      expect(getTabIndexFromPathname('/main/profile/')).toBe(3);
      expect(getTabIndexFromPathname('/main/profile?userId=123')).toBe(3);
    });

    it('returns -1 for non-navbar screens like edit-profile', () => {
      expect(getTabIndexFromPathname('/main/edit-profile')).toBe(-1);
      expect(getTabIndexFromPathname('/auth')).toBe(-1);
      expect(getTabIndexFromPathname('/watch')).toBe(-1);
    });
  });

  describe('Boundary Protections (No Out-of-Bounds Navigation)', () => {
    it('does not trigger or navigate right beyond the first screen (Home)', () => {
      // On Home (tab index 0), swiping right (dx > 0)
      const trigger = shouldSwipeTrigger({
        pathname: '/main',
        dx: 60,
        dy: 5,
      });
      expect(trigger).toBe(false);

      const next = calculateNextTab(0, 60, 0.4);
      expect(next).toBeNull();
    });

    it('does not trigger or navigate left beyond the last screen (Profile)', () => {
      // On Profile (tab index 3), swiping left (dx < 0)
      const trigger = shouldSwipeTrigger({
        pathname: '/main/profile',
        dx: -60,
        dy: 5,
      });
      expect(trigger).toBe(false);

      const next = calculateNextTab(3, -60, -0.4);
      expect(next).toBeNull();
    });
  });

  describe('Swiping Left (Navigating to Next Navbar Screen)', () => {
    it('swipes left from Home (0) to Subscriptions (1)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main',
        dx: -50,
        dy: 10,
      });
      expect(trigger).toBe(true);

      const next = calculateNextTab(0, -50, -0.3);
      expect(next).toBe('/main/subscriptions');
    });

    it('swipes left from Subscriptions (1) to Explore (2)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main/subscriptions',
        dx: -50,
        dy: 10,
      });
      expect(trigger).toBe(true);

      const next = calculateNextTab(1, -50, -0.3);
      expect(next).toBe('/main/explore');
    });

    it('swipes left from Explore (2) to Profile (3)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main/explore',
        dx: -50,
        dy: 10,
      });
      expect(trigger).toBe(true);

      const next = calculateNextTab(2, -50, -0.3);
      expect(next).toBe('/main/profile');
    });
  });

  describe('Swiping Right (Navigating to Previous Navbar Screen)', () => {
    it('swipes right from Profile (3) to Explore (2)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main/profile',
        dx: 50,
        dy: 10,
      });
      expect(trigger).toBe(true);

      const next = calculateNextTab(3, 50, 0.3);
      expect(next).toBe('/main/explore');
    });

    it('swipes right from Explore (2) to Subscriptions (1)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main/explore',
        dx: 50,
        dy: 10,
      });
      expect(trigger).toBe(true);

      const next = calculateNextTab(2, 50, 0.3);
      expect(next).toBe('/main/subscriptions');
    });

    it('swipes right from Subscriptions (1) to Home (0)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main/subscriptions',
        dx: 50,
        dy: 10,
      });
      expect(trigger).toBe(true);

      const next = calculateNextTab(1, 50, 0.3);
      expect(next).toBe('/main');
    });
  });

  describe('Gesture Conflict Prevention', () => {
    it('does not trigger on vertical scrolling', () => {
      // Pure vertical scroll
      expect(shouldSwipeTrigger({ pathname: '/main', dx: 5, dy: 60 })).toBe(false);
      // Diagonal scroll dominated by vertical
      expect(shouldSwipeTrigger({ pathname: '/main', dx: -30, dy: 40 })).toBe(false);
      // Equal horizontal and vertical
      expect(shouldSwipeTrigger({ pathname: '/main', dx: -45, dy: 45 })).toBe(false);
      // Not enough horizontal dominance (ratio < 1.5)
      expect(shouldSwipeTrigger({ pathname: '/main', dx: -50, dy: 40 })).toBe(false);
    });

    it('does not trigger on small taps and micro-movements', () => {
      expect(shouldSwipeTrigger({ pathname: '/main', dx: 10, dy: 5 })).toBe(false);
      expect(shouldSwipeTrigger({ pathname: '/main', dx: -25, dy: 5 })).toBe(false);
      expect(calculateNextTab(1, -15, 0.05)).toBeNull();
    });

    it('does not trigger when keyboard is open (e.g. typing in search bar)', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main/explore',
        dx: -60,
        dy: 0,
        isKeyboardOpen: true,
      });
      expect(trigger).toBe(false);
    });

    it('does not trigger when touch is inside a horizontal scroll element', () => {
      const trigger = shouldSwipeTrigger({
        pathname: '/main',
        dx: -60,
        dy: 0,
        isInsideHorizontalElement: true,
      });
      expect(trigger).toBe(false);
    });

    it('supports quick flick gestures meeting velocity threshold', () => {
      // Moderate distance (25px >= 20px) but high flick velocity (vx = -0.3 >= 0.25)
      const next = calculateNextTab(0, -25, -0.3);
      expect(next).toBe('/main/subscriptions');
    });
  });
});
