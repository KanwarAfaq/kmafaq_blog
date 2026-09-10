import { Bot, Code2, Lightbulb } from 'lucide-react';
import SEO from '../components/SEO';
import SectionHeading from '../components/SectionHeading';

export default function AboutPage() {
  return (
    <>
      <SEO
        title="About"
        path="/about"
        description="Learn about KM Afaq and the focus on practical AI automation, technology education, web development, and digital growth."
      />
      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <img
            src="/images/about-km-afaq.svg"
            alt="KM Afaq profile illustration"
            loading="lazy"
            decoding="async"
            className="aspect-square w-full rounded-3xl bg-white object-cover shadow-sm"
          />
          <div>
            <SectionHeading eyebrow="About KM Afaq" title="Making modern technology useful, not complicated" />
            <div className="mt-6 space-y-5 text-base leading-8 text-gray-600">
              <p>
                KM Afaq is a technology-focused platform covering AI automation, modern web development, practical digital skills, and online earning opportunities.
              </p>
              <p>
                The goal is simple: explain useful technology clearly, build reliable solutions, and help readers and clients move from ideas to working systems.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            [Bot, 'Automation first', 'Use AI and integrations where they save real time and reduce repetitive work.'],
            [Code2, 'Clean engineering', 'Build responsive, maintainable interfaces with secure cloud-backed data flows.'],
            [Lightbulb, 'Practical education', 'Turn fast-moving technology trends into understandable and actionable guidance.'],
          ].map(([Icon, title, text]) => (
            <article key={title} className="rounded-3xl border border-gray-200 p-6">
              <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
              <h2 className="mt-5 text-xl font-bold text-ink">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
