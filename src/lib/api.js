import { supabase } from './supabase';

const POST_CARD_FIELDS = [
  'id',
  'title',
  'slug',
  'excerpt',
  'language',
  'topic_category',
  'source_topic',
  'cover_image_url',
  'cover_image_public_id',
  'cover_image_asset_id',
  'cover_video_url',
  'cover_video_public_id',
  'cover_video_asset_id',
  'author_id',
  'created_at',
  'status',
  'is_sponsored',
  'sponsor_name',
  'sponsor_url',
  'sponsor_cta',
].join(',');

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Copy .env.example to .env and add your project credentials.');
  }
  return supabase;
}

export async function getPublishedPosts(limit = 24, language = null) {
  const client = requireSupabase();
  let query = client
    .from('posts')
    .select(POST_CARD_FIELDS)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (language) query = query.eq('language', language);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getBlogListing({ page = 1, pageSize = 9, language = null, category = 'all' } = {}) {
  const client = requireSupabase();
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(24, Number(pageSize) || 9));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  let query = client
    .from('posts')
    .select(POST_CARD_FIELDS, { count: 'exact' })
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (language) query = query.eq('language', language);
  if (category && category !== 'all') query = query.eq('topic_category', category);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    posts: data ?? [],
    count: count ?? 0,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / safeSize)),
  };
}

export async function getPostBySlug(slug) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRelatedPosts(post, limit = 7) {
  if (!post?.id) return [];
  const client = requireSupabase();
  const language = post.language || 'ur';
  const category = post.topic_category || 'trending';
  const primaryLimit = Math.min(limit, 4);

  const { data: categoryRows, error: categoryError } = await client
    .from('posts')
    .select(POST_CARD_FIELDS)
    .eq('status', 'published')
    .eq('language', language)
    .eq('topic_category', category)
    .neq('id', post.id)
    .order('created_at', { ascending: false })
    .limit(primaryLimit);

  if (categoryError) throw categoryError;

  const selected = [...(categoryRows ?? [])];
  if (selected.length >= limit) return selected.slice(0, limit);

  const excludedIds = [post.id, ...selected.map((row) => row.id)];
  let fallbackQuery = client
    .from('posts')
    .select(POST_CARD_FIELDS)
    .eq('status', 'published')
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(limit + excludedIds.length);

  const { data: fallbackRows, error: fallbackError } = await fallbackQuery;
  if (fallbackError) throw fallbackError;

  for (const row of fallbackRows ?? []) {
    if (excludedIds.includes(row.id)) continue;
    selected.push(row);
    if (selected.length >= limit) break;
  }
  return selected;
}

export async function getServices() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('services')
    .select('id,name,description,price,image_url,image_public_id,image_asset_id')
    .limit(12);

  if (error) throw error;
  return data ?? [];
}

export async function getLikeCount(postId) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_post_like_count', { target_post_id: postId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getMyLike(postId, userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function addLike(postId, userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('post_likes')
    .insert({ post_id: postId, user_id: userId })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function removeLike(likeId) {
  const client = requireSupabase();
  const { error } = await client.from('post_likes').delete().eq('id', likeId);
  if (error) throw error;
}

export async function getMyProfile(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveMyProfile(userId, values) {
  const client = requireSupabase();
  const payload = {
    user_id: userId,
    username: values.username || null,
    full_name: values.full_name || null,
    display_name: values.display_name || null,
    bio: values.bio || null,
    avatar_url: values.avatar_url || null,
    avatar_public_id: values.avatar_public_id || null,
    avatar_asset_id: values.avatar_asset_id || null,
    phone: values.phone || null,
    country: values.country || null,
    city: values.city || null,
    timezone: values.timezone || 'Asia/Karachi',
    preferred_language: values.preferred_language || 'both',
    website_url: values.website_url || null,
  };
  const { data, error } = await client
    .from('user_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getNotificationPreferences(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNotificationPreferences(userId, values) {
  const client = requireSupabase();
  const payload = {
    user_id: userId,
    active: Boolean(values.active),
    email_enabled: Boolean(values.email_enabled),
    line_enabled: Boolean(values.line_enabled),
    topics: values.topics,
    languages: values.languages,
    frequency: values.frequency,
    weekly_day: Number(values.weekly_day ?? 1),
    custom_weekdays: values.custom_weekdays ?? [],
    preferred_time: values.preferred_time || '09:00',
    timezone: values.timezone || 'Asia/Karachi',
    next_digest_at: null,
  };
  const { data, error } = await client
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function disconnectLine(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notification_preferences')
    .update({
      line_enabled: false,
      line_user_id: null,
      line_display_name: null,
      line_picture_url: null,
      line_friend: false,
      line_connected_at: null,
      next_digest_at: null,
    })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getMyDeliveryLog(userId, limit = 8) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notification_delivery_log')
    .select('id,channel,period_key,status,post_count,error_message,created_at,sent_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}


export async function getMyPremiumAlerts(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('premium_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function savePremiumAlert(userId, values) {
  const client = requireSupabase();
  const payload = {
    user_id: userId,
    name: String(values.name || '').trim(),
    keywords: (values.keywords || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 20),
    topics: values.topics || [],
    languages: values.languages?.length ? values.languages : ['ur', 'en'],
    channels: values.channels?.length ? values.channels : ['email'],
    active: values.active !== false,
  };
  let query = client.from('premium_alerts');
  query = values.id ? query.update(payload).eq('id', values.id).eq('user_id', userId) : query.insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

export async function deletePremiumAlert(userId, alertId) {
  const client = requireSupabase();
  const { error } = await client.from('premium_alerts').delete().eq('id', alertId).eq('user_id', userId);
  if (error) throw error;
}

export async function getBusinessListings() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('business_listings')
    .select('id,name,slug,short_description,category,website_url,logo_url,city,country,plan,featured,click_count,lead_count,created_at')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBusinessBySlug(slug) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('business_listings')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAffiliateTools() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('affiliate_tools')
    .select('id,name,slug,description,category,pricing_label,website_url,logo_url,badge,featured,click_count')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitBusinessLead(values) {
  const response = await fetch('/api/business-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not submit your request.');
  return payload;
}

export async function submitMonetizationRequest(values) {
  const response = await fetch('/api/monetization-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not submit your request.');
  return payload;
}

export async function getRevenueDashboardData() {
  const client = requireSupabase();
  const [sales, leads, listings, tools, lineSubscribers, productOrders, jobs, jobSubmissions, sponsors, commentReports] = await Promise.all([
    client.from('monetization_requests').select('*').order('created_at', { ascending: false }).limit(100),
    client.from('business_leads').select('*,business_listings(name,slug)').order('created_at', { ascending: false }).limit(100),
    client.from('business_listings').select('id,name,slug,plan,featured,status,click_count,lead_count,created_at').order('created_at', { ascending: false }),
    client.from('affiliate_tools').select('id,name,slug,status,featured,click_count,created_at').order('click_count', { ascending: false }),
    client.from('line_subscribers').select('id,line_display_name,line_friend,active,created_at:followed_at,next_digest_at').order('followed_at', { ascending: false }).limit(100),
    client.from('digital_product_orders').select('*,digital_products(name,slug)').order('created_at', { ascending: false }).limit(100),
    client.from('job_listings').select('id,title,slug,company_name,plan,featured,status,click_count,created_at,expires_at').order('created_at', { ascending: false }).limit(100),
    client.from('job_submissions').select('*,job_listings(title,slug,company_name,plan,status,featured)').order('created_at', { ascending: false }).limit(100),
    client.from('digest_sponsor_campaigns').select('*').order('created_at', { ascending: false }).limit(100),
    client.from('comment_reports').select('*,post_comments(id,body,author_name,status,post_id)').order('created_at', { ascending: false }).limit(100),
  ]);
  for (const result of [sales, leads, listings, tools, lineSubscribers, productOrders, jobs, jobSubmissions, sponsors, commentReports]) {
    if (result.error) throw result.error;
  }
  return {
    sales: sales.data ?? [],
    leads: leads.data ?? [],
    listings: listings.data ?? [],
    tools: tools.data ?? [],
    lineSubscribers: lineSubscribers.data ?? [],
    productOrders: productOrders.data ?? [],
    jobs: jobs.data ?? [],
    jobSubmissions: jobSubmissions.data ?? [],
    sponsors: sponsors.data ?? [],
    commentReports: commentReports.data ?? [],
  };
}

export async function updateRevenueItem(table, id, values) {
  const allowed = new Set(['monetization_requests', 'business_leads', 'digital_product_orders', 'job_submissions']);
  if (!allowed.has(table)) throw new Error('Unsupported revenue table.');
  const client = requireSupabase();
  const { data, error } = await client.from(table).update(values).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Post reactions
// ---------------------------------------------------------------------------
export async function getReactionSummary(postId) {
  const client = requireSupabase();
  const { data, error } = await client.from('post_reactions').select('reaction').eq('post_id', postId);
  if (error) throw error;
  const counts = { like: 0, happy: 0, sad: 0, bad: 0, excited: 0 };
  for (const row of data ?? []) {
    if (Object.hasOwn(counts, row.reaction)) counts[row.reaction] += 1;
  }
  return counts;
}

export async function getMyReaction(postId, userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('post_reactions')
    .select('id,reaction')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setMyReaction(postId, userId, reaction) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('post_reactions')
    .upsert({ post_id: postId, user_id: userId, reaction }, { onConflict: 'post_id,user_id' })
    .select('id,reaction')
    .single();
  if (error) throw error;
  return data;
}

export async function removeMyReaction(postId, userId) {
  const client = requireSupabase();
  const { error } = await client.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Comments / replies / reports
// ---------------------------------------------------------------------------
export async function getPostComments(postId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('post_comments')
    .select('id,post_id,user_id,parent_id,body,author_name,author_avatar_url,status,created_at,updated_at')
    .eq('post_id', postId)
    .eq('status', 'published')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addPostComment(postId, userId, body, parentId = null) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, body: String(body || '').trim(), parent_id: parentId })
    .select('id,post_id,user_id,parent_id,body,author_name,author_avatar_url,status,created_at,updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function editPostComment(commentId, body) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('edit_own_comment', {
    target_comment_id: commentId,
    new_body: String(body || '').trim(),
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function deletePostComment(commentId, userId) {
  const client = requireSupabase();
  const { error } = await client.from('post_comments').delete().eq('id', commentId).eq('user_id', userId);
  if (error) throw error;
}

export async function reportPostComment(commentId, userId, reason) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('comment_reports')
    .insert({ comment_id: commentId, reporter_id: userId, reason: String(reason || '').trim() })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Digital products
// ---------------------------------------------------------------------------
export async function getDigitalProducts() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('digital_products')
    .select('id,name,slug,short_description,description,category,price,currency,cover_url,preview_url,featured,created_at')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDigitalProductBySlug(slug) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('digital_products')
    .select('id,name,slug,short_description,description,category,price,currency,cover_url,preview_url,featured,created_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitDigitalProductOrder(values) {
  const headers = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch('/api/product-order', {
    method: 'POST',
    headers,
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not submit product order.');
  return payload;
}

// ---------------------------------------------------------------------------
// Jobs / freelance board
// ---------------------------------------------------------------------------
export async function getJobListings() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('job_listings')
    .select('id,title,slug,company_name,description,location,work_mode,employment_type,salary_text,logo_url,plan,featured,expires_at,click_count,created_at')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getJobBySlug(slug) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('job_listings')
    .select('id,title,slug,company_name,description,location,work_mode,employment_type,salary_text,logo_url,plan,featured,expires_at,click_count,created_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitJobListing(values) {
  const response = await fetch('/api/job-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not submit job listing.');
  return payload;
}

// ---------------------------------------------------------------------------
// Admin management for new monetization/community features
// ---------------------------------------------------------------------------
export async function createDigitalProduct(values) {
  const client = requireSupabase();
  const { data, error } = await client.from('digital_products').insert(values).select('*').single();
  if (error) throw error;
  return data;
}

export async function createDigestSponsor(values) {
  const client = requireSupabase();
  const rawUrl = String(values.cta_url || '').trim();
  const normalizedUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  try { new URL(normalizedUrl); } catch { throw new Error('Enter a valid sponsor website.'); }
  const { data, error } = await client.from('digest_sponsor_campaigns').insert({ ...values, cta_url: normalizedUrl }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateJobListing(id, values) {
  const client = requireSupabase();
  const { data, error } = await client.from('job_listings').update(values).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateCommentModeration(id, values) {
  const client = requireSupabase();
  const { data, error } = await client.from('post_comments').update(values).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateCommentReport(id, values) {
  const client = requireSupabase();
  const { data, error } = await client.from('comment_reports').update(values).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Custom 4-digit email OTP authentication
// ---------------------------------------------------------------------------
export async function requestAuthOtp(email, purpose) {
  const response = await fetch('/api/auth-request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not send verification code.');
  return payload;
}

export async function verifyAuthOtp(values) {
  const response = await fetch('/api/auth-verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not verify code.');
  return payload;
}
