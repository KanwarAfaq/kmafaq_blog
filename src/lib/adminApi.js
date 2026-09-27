import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

async function adminFetch(path) {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Admin sign-in required.');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Admin request failed.');
  return payload;
}

export async function getAdminPosts() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('posts')
    .select('id,title,slug,content,excerpt,language,cover_image_url,cover_image_public_id,cover_image_asset_id,seo_description,topic_category,status,author_id,created_at,is_ai_generated')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveAdminPost(values, userId) {
  const client = requireSupabase();
  const payload = {
    title: String(values.title || '').trim(),
    slug: String(values.slug || '').trim(),
    content: String(values.content || '').trim(),
    excerpt: String(values.excerpt || '').trim() || null,
    language: values.language === 'ur' ? 'ur' : 'en',
    topic_category: values.topic_category || 'trending',
    status: values.status || 'draft',
    seo_description: String(values.seo_description || '').trim() || null,
    cover_image_url: String(values.cover_image_url || '').trim() || null,
    cover_image_public_id: values.cover_image_public_id || null,
    cover_image_asset_id: values.cover_image_asset_id || null,
  };

  if (values.id) {
    const { data, error } = await client.from('posts').update(payload).eq('id', values.id).select('*').single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await client
    .from('posts')
    .insert({ ...payload, author_id: userId || null, is_ai_generated: false })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdminPost(id) {
  const client = requireSupabase();
  const { error } = await client.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function getAdminHealth() {
  return adminFetch('/api/site-ops?action=health');
}

export async function getAdminGsc() {
  return adminFetch('/api/site-ops?action=gsc');
}
