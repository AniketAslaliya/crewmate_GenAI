import { useEffect, useState } from 'react';

// Simple hook to detect mobile using CSS media query (max-width: 768px)
export default function useIsMobile() {
  const getInitial = () => {
    if (typeof window === 'undefined') return false;
    try {
      return window.matchMedia('(max-width: 768px)').matches;
    } catch (e) {
      return false;
    }
  };

  const [isMobile, setIsMobile] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    // modern browsers
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);

    // cleanup
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  return isMobile;
}
