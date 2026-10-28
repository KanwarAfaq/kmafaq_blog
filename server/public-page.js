import { renderArticleHtml } from './article-html.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
export const sources = {
 blog:{table:'posts',status:'published',title:'title'},
 shop:{table:'digital_products',status:'active',title:'name'},
 jobs:{table:'job_listings',status:'active',title:'title'},
 business:{table:'business_listings',status:'active',title:'name'},
};
export function renderPublicPage(shell,section,slug,row) {
 const site='https://kmafaq.online', canonical=site+'/'+section+'/'+encodeURIComponent(slug);
 const title=String(row[sources[section].title]||'');
 const description=row.seo_description||row.excerpt||row.short_description||title;
 const language=row.language==='ur'?'ur':'en';
 const schema={'@context':'https://schema.org','@type':section==='blog'?'BlogPosting':'WebPage',
  name:title,description,url:canonical,inLanguage:language,
  ...(section==='blog'?{headline:title,author:{'@type':'Person',name:'KM Afaq',url:site+'/about'},
   datePublished:safeDate(row.created_at),dateModified:safeDate(row.updated_at||row.created_at)}:{})};
 const published=safeDate(row.created_at);
 const authorLine=section==='blog'?`<p><a href="/about" rel="author">KM Afaq</a>${published?` · <time datetime="${published}">${escape(published.slice(0,10))}</time>`:''}</p>`:'';
 const article=renderArticleHtml(row.content||row.description||row.short_description||'');
 const imageValue=row.cover_image_url||row.cover_url||row.logo_url;
 let image;
 try { const u=new URL(imageValue);if(['http:','https:'].includes(u.protocol))image=u.href; } catch { /* Optional image. */ }
 if(image)schema.image=image;
 if(section==='blog'){
  schema.publisher={'@type':'Organization',name:'KM Afaq',url:site+'/'};
  schema.mainEntityOfPage={'@type':'WebPage','@id':canonical};
  schema.isAccessibleForFree=true;
  schema.breadcrumb={'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:site+'/'},{'@type':'ListItem',position:2,name:language==='ur'?'اردو بلاگ':'English Blog',item:site+(language==='ur'?'/blog/urdu':'/blog/english')},{'@type':'ListItem',position:3,name:title,item:canonical}]};
  if(/^https?:\/\//i.test(row.source_url||''))schema.citation=row.source_url;
 }
 let head=`<title>${escape(title)} | KM Afaq</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="${section==='blog'?'article':'website'}"><meta property="og:site_name" content="KM Afaq">${section==='blog'&&published?`<meta property="article:published_time" content="${published}"><meta property="article:author" content="${site}/about">`:''}<meta property="og:locale" content="${language==='ur'?'ur_PK':'en_US'}"><meta name="twitter:card" content="${image?'summary_large_image':'summary'}"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}">${image?`<meta property="og:image" content="${escape(image)}"><meta property="og:image:alt" content="${escape(title)}"><meta name="twitter:image" content="${escape(image)}">`: ''}<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`;
 head=head.replace(/<(meta|link|script)\b/g,'<$1 data-rh="true"');
 return shell.replace(/<html\b[^>]*>/i,`<html lang="${language}" dir="${language==='ur'?'rtl':'ltr'}">`)
  .replace(/<title>[\s\S]*?<\/title>/gi,'')
  .replace(/<meta\b(?=[^>]*\b(?:name|property)="(?:description|robots|googlebot|og:[^"]+|twitter:[^"]+)")[^>]*>/gi,'')
  .replace(/<link\b(?=[^>]*\brel="canonical")[^>]*>/gi,'')
  .replace(/<script\b(?=[^>]*\btype="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace('</head>',head+'</head>')
  .replace('<div id="root"></div>',`<div id="root"><main style="max-width:68rem;margin:0 auto;padding:2rem 1rem;overflow-wrap:anywhere"><h1>${escape(title)}</h1>${authorLine}<p>${escape(description)}</p>${image?`<img src="${escape(image)}" alt="${escape(title)}" loading="eager" fetchpriority="high" decoding="async" style="max-width:100%;height:auto">`: ''}<article class="article-prose">${article}</article>${/^https?:\/\//i.test(row.source_url||'')?`<p><a href="${escape(row.source_url)}" rel="noopener noreferrer">Original source</a></p>`:''}<a href="/${section}">Browse ${section==='blog'?'articles':escape(section)}</a></main></div>`);
}
