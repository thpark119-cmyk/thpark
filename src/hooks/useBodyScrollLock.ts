import { useEffect } from 'react';

// Global variables to track state across multiple hook instances (for nested modals)
let activeLocksCount = 0;
let savedScrollY = 0;
let originalPosition = '';
let originalTop = '';
let originalLeft = '';
let originalWidth = '';
let originalHeight = '';
let originalOverflow = '';
let originalHtmlOverflow = '';

export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    // Increment active locks count when a modal opens
    activeLocksCount++;

    const body = document.body;
    const html = document.documentElement;

    // Only apply the lock styles on the first active lock
    if (activeLocksCount === 1) {
      savedScrollY = window.scrollY;

      // Store original styles
      originalPosition = body.style.position;
      originalTop = body.style.top;
      originalLeft = body.style.left;
      originalWidth = body.style.width;
      originalHeight = body.style.height;
      originalOverflow = body.style.overflow;
      originalHtmlOverflow = html.style.overflow;

      // Lock scroll by making body fixed at current scroll position
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
    }

    // Cleanup function when the component unmounts or isOpen becomes false
    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);

      // Only restore styles when all locks are released
      if (activeLocksCount === 0) {
        body.style.position = originalPosition;
        body.style.top = originalTop;
        body.style.left = originalLeft;
        body.style.width = originalWidth;
        body.style.height = originalHeight;
        body.style.overflow = originalOverflow;
        html.style.overflow = originalHtmlOverflow;

        // Restore scroll position
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [isOpen]);
}
