import { ArrowUpRight, CalendarDays, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { topicLabel } from '../lib/topics';

function estimatedReadMinutes(post) {
  const text = `${post.excerpt || ''} ${post.title || ''}`;
  return Math.max(4, Math.round(text.split(/\s+/).length / 35) + 4);
}

export default function BlogCard({ post, compact = false }) {
  const isUrdu = post.language !== 'en';
  const language = isUrdu ? 'ur' : 'en';

  if (compact) {
    return (
      <article lang={language} dir={isUrdu ? 'rtl' : 'ltr'} className="group flex gap-3">
        <Link to={`/blog/${post.slug}`} className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
          {post.cover_image_url ? (
            <img src={post.cover_image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-100 to-purple-100" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-black uppercase tracking-wide text-primary">{topicLabel(post.topic_category, language)}</span>
          <h3 className="mt-1 line-clamp-2 text-sm font-extrabold leading-5 text-ink">
            <Link to={`/blog/${post.slug}`} className="transition group-hover:text-primary">{post.title}</Link>
          </h3>
          <time className="mt-1 block text-xs text-gray-400" dateTime={post.created_at}>
            {new Intl.DateTimeFormat(isUrdu ? 'ur-PK' : 'en', { dateStyle: 'medium' }).format(new Date(post.created_at))}
          </time>
        </div>
      </article>
    );
  }

  return (
    <article
      lang={language}
      dir={isUrdu ? 'rtl' : 'ltr'}
      className="group overflow-hidden rounded-[1.75rem] border border-gray-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]"
    >
      <Link to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`} className="relative block overflow-hidden">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-blue-100 via-white to-purple-100" aria-hidden="true" />
        )}
        <div className="absolute start-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-xs font-black text-primary shadow-sm backdrop-blur">{topicLabel(post.topic_category, language)}</span>
          {post.is_sponsored ? <span className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-amber-950 shadow-sm">Sponsored</span> : null}
        </div>
      </Link>

      <div className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={post.created_at}>
              {new Intl.DateTimeFormat(isUrdu ? 'ur-PK' : 'en', { dateStyle: 'medium' }).format(new Date(post.created_at))}
            </time>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {estimatedReadMinutes(post)} {isUrdu ? 'منٹ' : 'min read'}
          </span>
        </div>

        <h3 className="line-clamp-2 text-xl font-black leading-snug text-ink sm:text-[1.35rem]">
          <Link className="transition group-hover:text-primary" to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
          {post.excerpt || (isUrdu ? 'مکمل مضمون میں اہم نکات، پس منظر اور قابلِ عمل معلومات پڑھیں۔' : 'Read the full article for context, key takeaways, and practical insights.')}
        </p>

        <Link to={`/blog/${post.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary">
          {isUrdu ? 'مضمون پڑھیں' : 'Read article'}
          <ArrowUpRight className={`h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${isUrdu ? '-scale-x-100' : ''}`} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
