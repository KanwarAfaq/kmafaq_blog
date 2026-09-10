import { useCallback, useEffect, useState } from 'react';
import { getPublishedPosts } from '../lib/api';
import { supabase } from '../lib/supabase';

export function usePublishedPosts(limit = 24, language = null) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPosts = useCallback(async () => {
    try {
      const data = await getPublishedPosts(limit, language);
      setPosts(data);
      setError(null);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [limit, language]);

  useEffect(() => {
    loadPosts();

    if (!supabase) return undefined;

    const channel = supabase
      .channel(`published-posts-${language || 'all'}-${limit}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => loadPosts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, language, loadPosts]);

  return { posts, loading, error, reload: loadPosts };
}
