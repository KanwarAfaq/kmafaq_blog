import { Languages, Newspaper, Search, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import BlogCard from '../components/BlogCard';
import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import SEO from '../components/SEO';
import { useBlogListing } from '../hooks/useBlogListing';
import { usePublishedPosts } from '../hooks/usePublishedPosts';
import { TOPIC_OPTIONS } from '../lib/topics';

const LANGUAGE_META = {
  ur: {
    label: 'اردو بلاگ',
    title: 'اردو میں تازہ خبریں، ٹیک اور مفید رہنمائی',
    description: 'اے آئی، ٹیکنالوجی، کاروبار، سیاست، کھیل، دنیا، سائنس اور صحت پر تازہ اور مفید اردو مضامین۔',
    path: '/blog/urdu',
    dir: 'rtl',
    lang: 'ur',
  },
  en: {
    label: 'English Blog',
    title: 'Fresh stories, useful context, better reading',
    description: 'Current articles across AI, technology, business, politics, sports, world affairs, science, and health.',
    path: '/blog/english',
    dir: 'ltr',
    lang: 'en',
  },
};

function LanguageNav({ current }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Blog languages">
      <Link
        to="/blog/urdu"
        className={`rounded-full px-5 py-2.5 text-sm font-black transition ${current === 'ur' ? 'bg-primary text-white shadow-sm' : 'border border-gray-200 bg-white text-ink hover:border-primary hover:text-primary'}`}
      >
        اردو
      </Link>
      <Link
        to="/blog/english"
        className={`rounded-full px-5 py-2.5 text-sm font-black transition ${current === 'en' ? 'bg-primary text-white shadow-sm' : 'border border-gray-200 bg-white text-ink hover:border-primary hover:text-primary'}`}
      >
        English
      </Link>
    </nav>
  );
}

function TopicFilters({ language, selected, onSelect }) {
  const isUrdu = language === 'ur';
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter posts by topic">
      {TOPIC_OPTIONS.map((topic) => (
        <button
          key={topic.value}
          type="button"
          onClick={() => onSelect(topic.value)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${selected === topic.value ? 'bg-ink text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-primary'}`}
        >
          {isUrdu ? topic.urdu : topic.label}
        </button>
      ))}
    </div>
  );
}

function LanguageListing({ language }) {
  const meta = LANGUAGE_META[language];
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const topic = TOPIC_OPTIONS.some((item) => item.value === searchParams.get('topic')) ? searchParams.get('topic') : 'all';
  const { posts, count, totalPages, loading, error } = useBlogListing({ page, pageSize: 9, language, category: topic });
  const isUrdu = language === 'ur';

  const setTopic = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('topic'); else next.set('topic', value);
    next.delete('page');
    setSearchParams(next, { replace: false });
  };

  const makeHref = (targetPage) => {
    const next = new URLSearchParams(searchParams);
    if (targetPage <= 1) next.delete('page'); else next.set('page', String(targetPage));
    const query = next.toString();
    return `${meta.path}${query ? `?${query}` : ''}`;
  };

  return (
    <>
      <SEO title={meta.label} path={meta.path} description={meta.description} language={meta.lang} />

      <section className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-purple-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" dir={meta.dir} lang={meta.lang}>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-black text-primary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> KM Afaq
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-ink sm:text-5xl">{meta.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">{meta.description}</p>
            <div className="mt-7"><LanguageNav current={language} /></div>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14" dir={meta.dir} lang={meta.lang}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                <Search className="h-4 w-4" aria-hidden="true" />
                {isUrdu ? 'موضوع کے حساب سے فلٹر کریں' : 'Filter by topic'}
              </div>
              <span className="text-sm font-semibold text-gray-400">
                {loading ? '…' : isUrdu ? `${count} مضامین` : `${count} articles`}
              </span>
            </div>
            <TopicFilters language={language} selected={topic} onSelect={setTopic} />
          </div>

          <div className="mt-8">
            {loading ? (
              <Loader label={isUrdu ? 'مضامین لوڈ ہو رہے ہیں...' : 'Loading articles...'} />
            ) : error ? (
              <EmptyState title="Could not load posts" description={error.message} />
            ) : posts.length ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => <BlogCard key={post.id} post={post} />)}
              </div>
            ) : (
              <EmptyState
                title={isUrdu ? 'اس موضوع پر ابھی کوئی مضمون نہیں' : 'No articles in this topic yet'}
                description={isUrdu ? 'کوئی دوسرا موضوع منتخب کریں یا بعد میں دوبارہ دیکھیں۔' : 'Choose another topic or check back after the next publishing run.'}
              />
            )}
          </div>

          {!loading && !error && posts.length > 0 ? (
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} makeHref={makeHref} isUrdu={isUrdu} />
          ) : null}
        </div>
      </section>
    </>
  );
}

function LatestFeed({ language }) {
  const isUrdu = language === 'ur';
  const { posts, loading } = usePublishedPosts(6, language);
  if (loading) return <Loader label={isUrdu ? 'مضامین لوڈ ہو رہے ہیں...' : 'Loading articles...'} />;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" dir={isUrdu ? 'rtl' : 'ltr'} lang={language}>
      {posts.map((post) => <BlogCard key={post.id} post={post} />)}
    </div>
  );
}

export default function BlogPage({ language = null }) {
  if (language) return <LanguageListing language={language} />;

  return (
    <>
      <SEO
        title="Blog"
        path="/blog"
        description="KM Afaq publishes current Urdu and English articles covering technology, business, politics, sports, world affairs, science and practical digital skills."
      />

      <section className="relative overflow-hidden bg-ink py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,.3),transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black"><Newspaper className="h-4 w-4" /> Current stories</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black"><Languages className="h-4 w-4" /> Urdu + English</span>
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">News, technology and ideas worth your time.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-300">A cleaner reading experience for timely stories, useful explainers and practical insights — published separately in Urdu and English.</p>
            <div className="mt-8"><LanguageNav /></div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4" dir="rtl" lang="ur">
            <div><span className="text-sm font-black text-primary">اردو</span><h2 className="mt-1 text-3xl font-black text-ink">تازہ اردو مضامین</h2></div>
            <Link className="font-black text-primary hover:underline" to="/blog/urdu">سب دیکھیں</Link>
          </div>
          <LatestFeed language="ur" />

          <div className="mb-8 mt-16 flex items-end justify-between gap-4">
            <div><span className="text-sm font-black text-primary">English</span><h2 className="mt-1 text-3xl font-black text-ink">Latest English Articles</h2></div>
            <Link className="font-black text-primary hover:underline" to="/blog/english">View all</Link>
          </div>
          <LatestFeed language="en" />
        </div>
      </section>
    </>
  );
}
