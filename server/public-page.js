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
 const paragraphs=String(row.content||row.description||row.short_description||'')
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
  .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi,'\n\n').replace(/<[^>]*>/g,'')
  .split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 const head=`<title>${escape(title)} | KM Afaq</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="${section==='blog'?'article':'website'}"><meta name="twitter:card" content="summary"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`;
 return shell.replace(/<html\b[^>]*>/i,`<html lang="${language}" dir="${language==='ur'?'rtl':'ltr'}">`)
  .replace(/<title>[\s\S]*?<\/title>/gi,'')
  .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/gi,'')
  .replace(/<link\s+rel="canonical"[^>]*>/gi,'')
  .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi,'')
  .replace('</head>',head+'</head>')
  .replace('<div id="root"></div>',`<div id="root"><main><h1>${escape(title)}</h1><p>${escape(description)}</p>${paragraphs.map(x=>'<p>'+escape(x)+'</p>').join('')}<a href="/${section}">Browse ${section==='blog'?'articles':escape(section)}</a></main></div>`);
}
