import { useCallback, useEffect, useState } from 'react';
import { getBlogListing } from '../lib/api';
import { supabase } from '../lib/supabase';

export function useBlogListing({ page = 1, pageSize = 9, language = null, category = 'all' } = {}) {
  const [state, setState] = useState({
    posts: [],
    count: 0,
    totalPages: 1,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const result = await getBlogListing({ page, pageSize, language, category });
      setState({ ...result, loading: false, error: null });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  }, [page, pageSize, language, category]);

  useEffect(() => {
    load();
    if (!supabase) return undefined;

    const channel = supabase
      .channel(`blog-list-${language || 'all'}-${category}-${page}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, language, category, page]);

  return { ...state, reload: load };
}
