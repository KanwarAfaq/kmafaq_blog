import { useEffect, useState } from 'react';
import { FALLBACK_SERVICES } from '../constants/site';
import { getServices } from '../lib/api';

export function useServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getServices()
      .then((data) => {
        if (active) setServices(data.length ? data : FALLBACK_SERVICES);
      })
      .catch(() => {
        if (active) setServices(FALLBACK_SERVICES);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { services, loading };
}
