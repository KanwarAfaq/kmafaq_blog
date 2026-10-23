import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const MEASUREMENT_ID = 'G-22DQ6CNMHF';

function getPagePath(location) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export default function GoogleAnalytics() {
  const location = useLocation();
  const lastTrackedPath = useRef('');

  useEffect(() => {
    const pagePath = getPagePath(location);

    // The gtag bootstrap in index.html queues calls until the script loads.
    // The ref also prevents duplicate page_view events during React StrictMode
    // effect replays in development.
    if (typeof window.gtag !== 'function' || lastTrackedPath.current === pagePath) {
      return;
    }

    lastTrackedPath.current = pagePath;
    window.gtag('event', 'page_view', {
      send_to: MEASUREMENT_ID,
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    });
  }, [location]);

  return null;
}
