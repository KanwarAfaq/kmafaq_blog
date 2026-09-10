import { Helmet } from 'react-helmet-async';
import { SITE } from '../constants/site';

export default function SEO({
  title,
  description = SITE.description,
  path = '/',
  image,
  type = 'website',
  schema = [],
  noIndex = false,
  language = 'en',
}) {
  const pageTitle = title ? `${title} | ${SITE.name}` : `${SITE.name} | ${SITE.title}`;
  const canonical = new URL(path, SITE.url).toString();
  const shareImage = image ? new URL(image, SITE.url).toString() : new URL('/favicon.svg', SITE.url).toString();
  const isUrdu = language === 'ur';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    email: SITE.email,
    logo: new URL('/favicon.svg', SITE.url).toString(),
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
  };

  const schemas = [organizationSchema, websiteSchema, ...schema];

  return (
    <Helmet htmlAttributes={{ lang: language }}>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={shareImage} />
      <meta property="og:locale" content={isUrdu ? 'ur_PK' : 'en_US'} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={shareImage} />

      {schemas.map((item, index) => (
        <script type="application/ld+json" key={`${item['@type']}-${index}`}>
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
