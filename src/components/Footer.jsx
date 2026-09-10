import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SITE } from '../constants/site';

const socialIcons = { Facebook, LinkedIn: Linkedin, YouTube: Youtube, Instagram };

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <h2 className="text-lg font-extrabold text-ink">KM Afaq</h2>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            Practical AI automation, technology education, online earning insights, and modern digital services.
          </p>
        </div>

        <div>
          <h2 className="font-bold text-ink">Quick Links</h2>
          <nav className="mt-4 flex flex-col gap-3 text-sm text-gray-600" aria-label="Footer quick links">
            <Link className="hover:text-primary" to="/blog">Blog</Link>
            <Link className="hover:text-primary" to="/shop">Digital Store</Link>
            <Link className="hover:text-primary" to="/jobs">Jobs & Freelance</Link>
            <Link className="hover:text-primary" to="/about">About</Link>
            <Link className="hover:text-primary" to="/contact">Contact</Link>
            <Link className="hover:text-primary" to="/line">LINE Alerts</Link>
            <Link className="hover:text-primary" to="/business">Business Directory</Link>
            <Link className="hover:text-primary" to="/tools">AI Tools</Link>
            <Link className="hover:text-primary" to="/pricing">Pricing & Advertise</Link>
          </nav>
        </div>

        <div>
          <h2 className="font-bold text-ink">Services</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600">
            <Link className="hover:text-primary" to="/services">AI Automation</Link>
            <Link className="hover:text-primary" to="/services">Web Development</Link>
            <Link className="hover:text-primary" to="/services">Tech Consulting</Link>
          </div>
        </div>

        <div>
          <h2 className="font-bold text-ink">Contact</h2>
          <a href={`mailto:${SITE.email}`} className="mt-4 block text-sm text-gray-600 hover:text-primary">
            {SITE.email}
          </a>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Social links">
            {SITE.social.map((social) => {
              const Icon = socialIcons[social.label];
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-gray-200 p-2 text-gray-600 transition hover:border-primary/30 hover:bg-blue-50 hover:text-primary"
                  aria-label={social.label}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 px-4 py-6 text-center text-sm text-gray-500">
        © 2026 KM Afaq. All rights reserved.
      </div>
    </footer>
  );
}
