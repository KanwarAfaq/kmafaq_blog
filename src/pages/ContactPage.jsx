import { Mail, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import SEO from '../components/SEO';
import SectionHeading from '../components/SectionHeading';
import { SITE } from '../constants/site';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  function submit(event) {
    event.preventDefault();

    const subject = encodeURIComponent(`Project inquiry from ${form.name}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    toast.success('Opening your email app...');
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`;
  }

  return (
    <>
      <SEO
        title="Contact"
        path="/contact"
        description="Contact KM Afaq about AI automation, web development, technical consulting, partnerships, or other digital projects."
      />
      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <SectionHeading
              eyebrow="Contact"
              title="Tell me what you want to build or automate"
              description="Send a concise overview of your goal, existing tools, and expected outcome."
            />
            <a href={`mailto:${SITE.email}`} className="mt-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700 shadow-sm hover:text-primary">
              <span className="rounded-xl bg-blue-50 p-2 text-primary"><Mail className="h-5 w-5" aria-hidden="true" /></span>
              {SITE.email}
            </a>
          </div>

          <form onSubmit={submit} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
                  placeholder="Your name"
                />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
                  placeholder="you@example.com"
                />
              </label>
            </div>
            <label className="mt-5 block text-sm font-semibold text-gray-700">
              Project details
              <textarea
                required
                rows="7"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
                placeholder="What do you want to achieve?"
              />
            </label>
            <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-700">
              <MessageSquareText className="h-5 w-5" aria-hidden="true" /> Send inquiry
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
