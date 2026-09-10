export const SITE = {
  name: 'KM Afaq',
  url: 'https://kmafaq.online',
  title: 'AI Automation & Tech Expert',
  description:
    'KM Afaq shares practical AI automation, technology, online earning insights, and digital services in Urdu and English.',
  email: 'hello@kmafaq.online',
  social: [
    { label: 'Facebook', href: import.meta.env.VITE_SOCIAL_FACEBOOK || 'https://facebook.com/' },
    { label: 'LinkedIn', href: import.meta.env.VITE_SOCIAL_LINKEDIN || 'https://linkedin.com/' },
    { label: 'YouTube', href: import.meta.env.VITE_SOCIAL_YOUTUBE || 'https://youtube.com/' },
    { label: 'Instagram', href: import.meta.env.VITE_SOCIAL_INSTAGRAM || 'https://instagram.com/' },
  ],
};

export const FALLBACK_SERVICES = [
  {
    id: 'fallback-ai-automation',
    name: 'AI Automation',
    description: 'Automate repetitive business workflows with practical AI agents and integrations.',
    price: 149,
    image_url: null,
  },
  {
    id: 'fallback-web-development',
    name: 'Web Development',
    description: 'Fast, responsive React websites connected to modern cloud backends.',
    price: 299,
    image_url: null,
  },
  {
    id: 'fallback-tech-consulting',
    name: 'Tech Consulting',
    description: 'Clear technical guidance for products, SEO, automation, and digital growth.',
    price: 79,
    image_url: null,
  },
];
