import { ArrowRight, BellRing, BriefcaseBusiness, CheckCircle2, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import BlogCard from '../components/BlogCard';
import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import SEO from '../components/SEO';
import SectionHeading from '../components/SectionHeading';
import ServiceCard from '../components/ServiceCard';
import { usePublishedPosts } from '../hooks/usePublishedPosts';
import { useServices } from '../hooks/useServices';

export default function HomePage() {
  const { posts: urduPosts, loading: urduLoading } = usePublishedPosts(3, 'ur');
  const { posts: englishPosts, loading: englishLoading } = usePublishedPosts(3, 'en');
  const { services, loading: servicesLoading } = useServices();

  return (
    <>
      <SEO path="/" />

      <section className="overflow-hidden bg-gradient-to-br from-primary via-blue-600 to-secondary text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="max-w-4xl">
            <p className="mb-4 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
              AI • Technology • Online Earning
            </p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">AI Automation & Tech Expert</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-50 sm:text-xl" dir="rtl" lang="ur">
              اے آئی آٹومیشن، ویب ٹیکنالوجی اور آن لائن ارننگ کے عملی حل
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/blog"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-primary shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Read Blog <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                Hire Me <Mail className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>


      <section className="-mt-8 relative z-10 pb-8">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { to: '/line', title: 'LINE Alerts', text: 'Scan, add as friend, choose topics. No website login.', icon: MessageCircle },
            { to: '/alerts', title: 'Premium Intelligence', text: 'Track companies, people and keywords.', icon: BellRing },
            { to: '/business', title: 'Business Directory', text: 'Featured listings with direct lead capture.', icon: BriefcaseBusiness },
            { to: '/tools', title: 'AI Tools', text: 'Curated tools with affiliate-ready links.', icon: Sparkles },
          ].map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-black text-ink">{title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Latest insights"
              title="Urdu & English Blog"
              description="Fresh AI, technology, automation, and earning articles published separately in Urdu and English."
            />
            <Link to="/blog" className="inline-flex shrink-0 items-center gap-2 font-semibold text-primary hover:underline">
              View blog <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-12" dir="rtl" lang="ur">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-ink">تازہ اردو مضامین</h2>
              <Link to="/blog/urdu" className="font-semibold text-primary hover:underline">سب دیکھیں</Link>
            </div>
            {urduLoading ? (
              <Loader label="اردو مضامین لوڈ ہو رہے ہیں..." />
            ) : urduPosts.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {urduPosts.map((post) => <BlogCard key={post.id} post={post} />)}
              </div>
            ) : (
              <EmptyState title="ابھی کوئی اردو پوسٹ نہیں" description="ایجنٹ کی اگلی اردو پوسٹ یہاں نظر آئے گی۔" />
            )}
          </div>

          <div className="mt-14">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-ink">Latest English Articles</h2>
              <Link to="/blog/english" className="font-semibold text-primary hover:underline">View all</Link>
            </div>
            {englishLoading ? (
              <Loader label="Loading English posts..." />
            ) : englishPosts.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {englishPosts.map((post) => <BlogCard key={post.id} post={post} />)}
              </div>
            ) : (
              <EmptyState title="No English posts yet" description="The next English agent post will appear here automatically." />
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Services"
            title="Build smarter. Automate faster."
            description="Focused services for creators, startups, and businesses that want practical technology outcomes."
            align="center"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {servicesLoading
              ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-gray-100" />)
              : services.slice(0, 3).map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <img
              src="/images/about-km-afaq.svg"
              alt="KM Afaq profile illustration"
              loading="lazy"
              decoding="async"
              className="aspect-square w-full object-cover"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="About"
              title="Technology explained with practical results in mind"
              description="KM Afaq focuses on AI automation, modern web technology, and clear digital strategies that are useful for real people and real businesses."
            />
            <ul className="mt-7 space-y-3 text-sm text-gray-700 sm:text-base">
              {['AI-first workflow automation', 'Responsive modern web development', 'Actionable tech and earning education'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/about" className="mt-7 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              More about KM Afaq <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
