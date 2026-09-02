import { useEffect, useRef } from 'react';

const BASE_TITLE = 'JapanFlow — Japan Imports';

/**
 * Updates the browser tab title to indicate unread notifications when the
 * tab is not focused, so users on other tabs can see new activity.
 */
export function useTabTitleNotifications(unreadCount: number) {
  const flashRef = useRef<number | null>(null);
  const altRef = useRef(false);

  useEffect(() => {
    const clearFlash = () => {
      if (flashRef.current !== null) {
        window.clearInterval(flashRef.current);
        flashRef.current = null;
      }
      altRef.current = false;
    };

    const apply = () => {
      const hidden = document.hidden;
      if (unreadCount > 0 && hidden) {
        if (flashRef.current === null) {
          const update = () => {
            altRef.current = !altRef.current;
            document.title = altRef.current
              ? `🔔 (${unreadCount}) Nova notificação`
              : `(${unreadCount}) ${BASE_TITLE}`;
          };
          update();
          flashRef.current = window.setInterval(update, 1500);
        }
      } else {
        clearFlash();
        document.title = BASE_TITLE;
      }
    };

    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      clearFlash();
      document.title = BASE_TITLE;
    };
  }, [unreadCount]);
}
