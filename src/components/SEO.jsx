import { Helmet } from 'react-helmet-async';
import { SITE } from '../constants/site';

function cleanDescription(value) {
  return String(value || SITE.description).replace(/\s+/g, ' ').trim().slice(0, 320);
}

export default function SEO({
  title,
  description = SITE.description,
  path = '/',
  image,
  imageAlt,
  type = 'website',
  schema = [],
  noIndex = false,
  language = 'en',
}) {
  const pageTitle = title ? `${title} | ${SITE.name}` : `${SITE.name} | ${SITE.title}`;
  const pageDescription = cleanDescription(description);
  const canonicalUrl = new URL(path || '/', SITE.url);
  canonicalUrl.hash = '';
  const canonical = canonicalUrl.toString();
  const shareImage = image
    ? new URL(image, SITE.url).toString()
    : new URL('/images/about-km-afaq.svg', SITE.url).toString();
  const shareImageAlt = imageAlt || title || `${SITE.name} — ${SITE.title}`;
  const isUrdu = language === 'ur';
  const sameAs = SITE.social.map((item) => item.href).filter(Boolean);

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    email: SITE.email,
    logo: new URL('/favicon.svg', SITE.url).toString(),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE.url}/#person`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    ...(sameAs.length ? { sameAs } : {}),
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    publisher: { '@id': `${SITE.url}/#organization` },
    inLanguage: ['en', 'ur'],
  };

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': type === 'article' ? 'WebPage' : 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: pageTitle,
    description: pageDescription,
    inLanguage: language,
    isPartOf: { '@id': `${SITE.url}/#website` },
  };

  const schemas = [organizationSchema, personSchema, websiteSchema, webPageSchema, ...schema].filter(Boolean);

  return (
    <Helmet htmlAttributes={{ lang: language, dir: isUrdu ? 'rtl' : 'ltr' }}>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'} />
      <meta name="googlebot" content={noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={shareImage} />
      <meta property="og:image:alt" content={shareImageAlt} />
      <meta property="og:locale" content={isUrdu ? 'ur_PK' : 'en_US'} />
      <meta property="og:locale:alternate" content={isUrdu ? 'en_US' : 'ur_PK'} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={shareImage} />
      <meta name="twitter:image:alt" content={shareImageAlt} />

      {schemas.map((item, index) => (
        <script type="application/ld+json" key={`${item['@type']}-${item['@id'] || index}`}>
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
