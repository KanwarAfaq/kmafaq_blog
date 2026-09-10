import { ArrowLeft, CalendarDays, Clock3, Share2, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useParams } from 'react-router-dom';
import BlogCard from '../components/BlogCard';
import LikeButton from '../components/LikeButton';
import CommentsSection from '../components/CommentsSection';
import Loader from '../components/Loader';
import SEO from '../components/SEO';
import { getPostBySlug, getRelatedPosts } from '../lib/api';
import { normalizeArticleMarkdown } from '../lib/markdown';
import { topicLabel } from '../lib/topics';

function estimateReadMinutes(content = '') {
  const words = String(content).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function RelatedSidebar({ posts, language }) {
  const isUrdu = language === 'ur';
  if (!posts.length) return null;
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{isUrdu ? 'مزید پڑھیں' : 'Keep reading'}</p>
        <h2 className="mt-2 text-xl font-black text-ink">{isUrdu ? 'متعلقہ مضامین' : 'Related articles'}</h2>
        <div className="mt-5 space-y-5 divide-y divide-gray-100 [&>article:not(:first-child)]:pt-5">
          {posts.slice(0, 4).map((post) => <BlogCard key={post.id} post={post} compact />)}
        </div>
      </div>
    </aside>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getPostBySlug(slug)
      .then(async (data) => {
        if (!active) return;
        setPost(data);
        if (data) {
          try {
            const rows = await getRelatedPosts(data, 7);
            if (active) setRelated(rows);
          } catch {
            if (active) setRelated([]);
          }
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(available > 0 ? Math.min(100, Math.max(0, (window.scrollY / available) * 100)) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const markdown = useMemo(() => normalizeArticleMarkdown(post?.content || ''), [post?.content]);

  if (loading) return <Loader label="Loading article..." />;

  if (error || !post) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <SEO title="Post not found" path={`/blog/${slug}`} noIndex />
        <h1 className="text-3xl font-bold text-ink">Post not found</h1>
        <p className="mt-3 text-gray-600">This article may have been removed, unpublished, or the URL may be incorrect.</p>
        <Link className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline" to="/blog">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to blog
        </Link>
      </section>
    );
  }

  const isUrdu = post.language !== 'en';
  const language = isUrdu ? 'ur' : 'en';
  const blogPath = isUrdu ? '/blog/urdu' : '/blog/english';
  const readMinutes = estimateReadMinutes(post.content);
  const bottomRelated = related.slice(4, 7).length ? related.slice(4, 7) : related.slice(0, 3);

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    inLanguage: language,
    headline: post.title,
    description: post.seo_description || post.excerpt || post.title,
    image: post.cover_image_url || undefined,
    datePublished: post.created_at,
    dateModified: post.created_at,
    author: { '@type': 'Person', name: 'KM Afaq' },
    publisher: { '@type': 'Organization', name: 'KM Afaq', url: 'https://kmafaq.online' },
    mainEntityOfPage: `https://kmafaq.online/blog/${post.slug}`,
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: post.title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  return (
    <>
      <SEO
        title={post.title}
        description={post.seo_description || post.excerpt || post.title}
        path={`/blog/${post.slug}`}
        image={post.cover_image_url}
        type="article"
        language={language}
        schema={[blogPostingSchema]}
      />

      <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-transparent" aria-hidden="true">
        <div className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      <article className="pb-20 pt-8 sm:pt-12" lang={language} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Link className="inline-flex items-center gap-2 text-sm font-black text-primary hover:underline" to={blogPath}>
              <ArrowLeft className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} aria-hidden="true" />
              {isUrdu ? 'اردو بلاگ پر واپس جائیں' : 'Back to English blog'}
            </Link>

            <header className="mt-7 text-start">
              <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-primary"><Tag className="h-3.5 w-3.5" aria-hidden="true" /> {topicLabel(post.topic_category, language)}</span>{post.is_sponsored ? <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">Sponsored{post.sponsor_name ? ` by ${post.sponsor_name}` : ''}</span> : null}</div>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">{post.title}</h1>
              {post.excerpt ? <p className="mt-5 text-lg leading-8 text-gray-600 sm:text-xl">{post.excerpt}</p> : null}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <time dateTime={post.created_at}>{new Intl.DateTimeFormat(isUrdu ? 'ur-PK' : 'en', { dateStyle: 'long' }).format(new Date(post.created_at))}</time>
                </span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> {readMinutes} {isUrdu ? 'منٹ کا مطالعہ' : 'min read'}</span>
                <button type="button" onClick={share} className="inline-flex items-center gap-2 transition hover:text-primary"><Share2 className="h-4 w-4" /> {isUrdu ? 'شیئر' : 'Share'}</button>
              </div>
            </header>

            {post.is_sponsored && post.sponsor_url ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-start"><p className="text-xs font-black uppercase tracking-wide text-amber-700">Sponsored partner</p><p className="mt-1 text-sm text-amber-900">This article contains paid sponsorship. Sponsored content is clearly labeled.</p><a href={post.sponsor_url} target="_blank" rel="noreferrer sponsored" className="mt-3 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-amber-950">{post.sponsor_cta || 'Visit sponsor'}</a></div> : null}

            {post.cover_video_url ? (
              <video className="mt-8 aspect-video w-full rounded-[2rem] bg-black object-cover shadow-[0_22px_60px_rgba(15,23,42,.15)]" controls preload="metadata" poster={post.cover_image_url || undefined} aria-label={`${post.title} video`}>
                <source src={post.cover_video_url} />
                Your browser does not support embedded video.
              </video>
            ) : post.cover_image_url ? (
              <img src={post.cover_image_url} alt={post.title} loading="eager" decoding="async" className="mt-8 aspect-[16/9] w-full rounded-[2rem] object-cover shadow-[0_22px_60px_rgba(15,23,42,.15)]" />
            ) : null}

            {post.cover_image_source_url && post.cover_image_attribution ? (
              <p className="mt-2 px-1 text-xs text-gray-400">
                <a href={post.cover_image_source_url} target="_blank" rel="noreferrer" className="underline hover:text-primary">{post.cover_image_attribution}</a>
                {post.cover_image_license ? ` · ${post.cover_image_license}` : ''}
              </p>
            ) : null}
          </div>

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 rounded-[2rem] border border-gray-200 bg-white px-5 py-7 shadow-[0_10px_35px_rgba(15,23,42,.04)] sm:px-8 sm:py-10 lg:px-10">
              <div className="article-prose text-base leading-8 text-gray-700 sm:text-[1.08rem] sm:leading-9">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node: _node, ...props }) => <h2 {...props} />,
                    a: ({ node: _node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
                    table: ({ node: _node, ...props }) => <div className="article-table-wrap"><table {...props} /></div>,
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>

            <RelatedSidebar posts={related} language={language} />
          </div>

          <div className="mx-auto mt-10 max-w-4xl space-y-6" dir="ltr">
            <LikeButton postId={post.id} />
            <CommentsSection postId={post.id} />
          </div>

          {bottomRelated.length ? (
            <section className="mt-14 border-t border-gray-200 pt-10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-primary">{isUrdu ? 'اگلا مطالعہ' : 'Next reads'}</p>
                  <h2 className="mt-1 text-2xl font-black text-ink sm:text-3xl">{isUrdu ? 'آپ کے لیے مزید مضامین' : 'More stories you may like'}</h2>
                </div>
                <Link to={blogPath} className="hidden text-sm font-black text-primary hover:underline sm:block">{isUrdu ? 'تمام مضامین' : 'All articles'}</Link>
              </div>
              <div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {bottomRelated.map((item) => <BlogCard key={item.id} post={item} />)}
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </>
  );
}
