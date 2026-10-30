// Single source of truth for page FAQs. Used by the React pages (visible content),
// the FAQPage JSON-LD, and scripts/prerender.mjs. Keep answers limited to what the
// site actually does; do not add unverifiable claims.
export const PAGE_FAQS = {
  '/business': {
    heading: 'Business directory questions',
    items: [
      { q: 'What is the KM Afaq business directory?', a: 'It is a directory of businesses and service providers featured on KM Afaq. Each listing has a short description, category and city where provided, and a page where you can request a quote.' },
      { q: 'How do I contact a listed business?', a: 'Open a listing and use the quote request on its page. Your inquiry is sent through KM Afaq.' },
      { q: 'How can I list my business?', a: 'See the pricing page for listing options, or contact KM Afaq directly. Featured listings receive priority placement.' },
    ],
    links: [{ to: '/pricing', text: 'Listing options and pricing' }, { to: '/jobs', text: 'Browse jobs and freelance work' }, { to: '/services', text: 'AI automation and web development services' }],
  },
  '/jobs': {
    heading: 'Jobs and freelance questions',
    items: [
      { q: 'What kinds of jobs are listed?', a: 'AI, technology, remote, internship, contract, part-time, full-time and freelance opportunities.' },
      { q: 'How do I find jobs in a specific place?', a: 'Use the search box to filter by job title, company or location, and the job type menu to narrow to full-time, contract, internship or freelance roles.' },
      { q: 'Can I post a job?', a: 'Yes. Use the Post a job button on this page to submit a listing. See the pricing page for promotion options.' },
    ],
    links: [{ to: '/tools', text: 'AI tools directory' }, { to: '/blog', text: 'Technology articles in Urdu and English' }, { to: '/pricing', text: 'Pricing and promotion options' }],
  },
  '/tools': {
    heading: 'AI tools directory questions',
    items: [
      { q: 'How are the AI tools chosen?', a: 'KM Afaq selects tools for practical workflows, productivity and digital work, and lists a category and pricing label for each where available.' },
      { q: 'Are the tool links affiliate links?', a: 'Some may be. Affiliate links can earn KM Afaq a commission at no extra cost to you, and those links are marked as sponsored.' },
      { q: 'Can KM Afaq help me automate work with these tools?', a: 'KM Afaq offers AI automation and web development services. See the services page for details.' },
    ],
    links: [{ to: '/services', text: 'AI automation and web development services' }, { to: '/blog/english', text: 'English articles on AI and technology' }, { to: '/blog/urdu', text: 'اردو مضامین' }],
  },
};

export function faqSchema(path) {
  const faq = PAGE_FAQS[path];
  if (!faq) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}
