import { renderArticleHtml } from '../server/article-html.js';
import { PAGE_FAQS, faqSchema } from '../src/constants/faqs.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const fitTitle=t=>{const suf=' | KM Afaq';t=String(t).trim();return t.length+suf.length<=60?t+suf:t.slice(0,60-suf.length-1).replace(/\s+\S*$/,'')+'…'+suf;};
const root=process.cwd(),site='https://kmafaq.online';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=value=>String(value??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const external=value=>{
 try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}
};
const manifest=JSON.parse(await readFile(resolve(root,'public/seo-pages.json'),'utf8'));
const pages=manifest.pages.filter(p=>/^\/(?:$|[a-z0-9_%/-]+$)/i.test(p.path)&&!p.path.includes('..'));
const all=new Set(pages.map(p=>p.path));
const tpl=await readFile(resolve(root,'dist/index.html'),'utf8');
// Keep a fresh app shell for public records created after this static build.
await writeFile(resolve(root,'dist/app-shell.html'),tpl,'utf8');
const sources={
 '/':{url:'https://developer.mozilla.org/en-US/',label:'MDN Web Docs: official web platform reference'},
 '/services':{url:'https://developer.mozilla.org/en-US/',label:'Web development reference: MDN Web Docs'},
 '/tools':{url:'https://developer.mozilla.org/en-US/',label:'Reference documentation for web technologies'},
};
const related=page=>{
 const basics=[{path:'/blog',text:'Read technology articles'},{path:'/services',text:'Explore AI and web services'},{path:'/',text:'KM Afaq home'}];
 const words=new Set(String(page.title||'').toLowerCase().match(/[a-z]{5,}/g)||[]);
 const matched=page.kind==='BlogPosting'?pages.filter(p=>p.kind==='BlogPosting'&&p.path!==page.path&&p.language===page.language)
  .map(p=>({p,score:(String(p.title||'').toLowerCase().match(/[a-z]{5,}/g)||[]).filter(w=>words.has(w)).length}))
  .filter(p=>p.score>0).sort((a,b)=>b.score-a.score).slice(0,2).map(x=>({path:x.p.path,text:x.p.title})):[];
 return [...matched,...basics].filter((p,i,list)=>p.path!==page.path&&all.has(p.path)&&list.findIndex(x=>x.path===p.path)===i).slice(0,4);
};

const publicArticleLinks=page=>{
 if(!['/','/blog','/blog/english','/blog/urdu'].includes(page.path))return '';
 const posts=pages.filter(item=>item.kind==='BlogPosting'&&/^\/blog\/[a-z0-9_%/-]+$/i.test(item.path))
  .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const languages=page.path==='/blog/english'?['en']:page.path==='/blog/urdu'?['ur']:['en','ur'];
 const limit=page.path==='/'?12:600;
 const sections=languages.map(lang=>{
  const articles=posts.filter(item=>(item.language==='ur'?'ur':'en')===lang).slice(0,limit);
  if(!articles.length)return '';
  const label=lang==='ur'?'Urdu articles':'English articles';
  return '<section><h2>'+escape(label)+'</h2><ul>'+
   articles.map(item=>'<li><a href="'+escape(item.path)+'">'+escape(item.title)+'</a></li>').join('')+'</ul></section>';
 }).filter(Boolean);
 return sections.length?'<nav aria-label="Browse published articles" data-seo-blog-hub="true">'+sections.join('')+'</nav>':'';
};
const faqHtml=path=>{const f=PAGE_FAQS[path];if(!f)return '';
 return '<section><h2>'+escape(f.heading)+'</h2><dl>'+f.items.map(i=>'<dt>'+escape(i.q)+'</dt><dd>'+escape(i.a)+'</dd>').join('')+'</dl><nav aria-label="Related pages"><ul>'+f.links.map(l=>'<li><a href="'+escape(l.to)+'">'+escape(l.text)+'</a></li>').join('')+'</ul></nav></section>'};

const commercialContent=page=>{
 if(page.path==='/shop'){
  const products=pages.filter(p=>/^\/shop\/[a-z0-9_%/-]+$/i.test(p.path));
  if(!products.length)return '<section><h2>Digital resources</h2><p>Browse the service offerings and contact the publisher about resources that fit your workflow. Product pages will appear when a downloadable resource is available.</p><p><a href="/pricing">See partnership options</a> or <a href="/contact">ask about a digital resource</a>.</p></section>';
  return '<section data-seo-product-list="true"><h2>Available digital resources</h2><p>Explore downloadable templates and practical resources. Open each resource to review its description and current availability before ordering or downloading.</p><ul>'+
    products.slice(0,80).map(p=>'<li><a href="'+escape(p.path)+'">'+escape(p.title)+'</a> — '+escape(clean(p.description||p.title))+'</li>').join('')+
   '</ul><p>Looking for a bundle or a resource for your team? <a href="/pricing">Explore digital product partnerships</a> or <a href="/contact">send an enquiry</a>.</p></section>';
 }
 if(page.path==='/services')return '<section><h2>How a technology project begins</h2><p>Start with the current workflow, the inputs you can share, the users who depend on it and the outcome you want to measure. AI automation projects may involve data extraction, review steps or tool integrations. Web development projects may involve a responsive interface, a backend or deployment work. The appropriate scope depends on your requirements rather than a pre-set package.</p><p>Before starting, agree on deliverables, which accounts and data need access, testing criteria, maintenance responsibility and any relevant privacy requirements. <a href="/contact">Describe your project</a> or review <a href="/pricing">service and partnership options</a>.</p></section>';
 if(page.path==='/pricing')return '<section><h2>Compare service and partnership options</h2><p>Current options include premium watchlist alerts, business directory listings, sponsored articles, featured job listings, newsletter sponsorships and digital-product partnerships. Choose an option according to what you need: personal updates, a qualified enquiry channel, an advertising placement or a downloadable resource.</p><p>The interactive plan selector above shows the current descriptions and prices. Before committing, confirm what is included, the duration, editorial labeling for sponsorships and how leads or results will be reported. Sponsorship never guarantees Google ranking or indexing. <a href="/contact">Contact KM Afaq</a> if you need a custom scope.</p></section>';
 return '';
};

const safeDate=value=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toISOString():undefined;
for(const page of pages){
 const fullUrl=site+page.path,description=clean(page.description||page.title);
 const focus=clean(page.title),lead=description.toLocaleLowerCase().includes(focus.toLocaleLowerCase())?description:focus+' — '+description;
 const image=external(page.image),source=external(page.source);
 const author={'@type':'Person',name:'KM Afaq',url:site+'/'};
 const publisher={'@type':'Organization',name:'KM Afaq',url:site+'/',logo:site+'/favicon.svg'};
 const base={'@context':'https://schema.org','@type':page.kind==='BlogPosting'?'BlogPosting':'WebPage',
  headline:page.kind==='BlogPosting'?page.title:undefined,name:page.kind!=='BlogPosting'?page.title:undefined,
  url:fullUrl,description,inLanguage:page.language||'en',
  mainEntityOfPage:{'@type':'WebPage','@id':fullUrl},isPartOf:{'@type':'WebSite',name:'KM Afaq',url:site+'/'},
  ...(page.kind==='BlogPosting'?{author,publisher,isAccessibleForFree:true,
   ...(safeDate(page.date)?{datePublished:safeDate(page.date),dateModified:safeDate(page.modified)||safeDate(page.date)}:{})}:{}),
  ...(image?{image}:{}),...(source?{citation:source}:{})};
 const links=related(page);
 // Search crawlers must receive the actual public article, not just its excerpt.
 // Remove markup/scripts and escape the resulting text to prevent HTML injection.
 const articleContent=page.kind==='BlogPosting'&&String(page.content||'').trim()
  ?'<section class="article-prose" data-seo-article-body="true">'+renderArticleHtml(page.content)+'</section>'
  :'';
 const resource=source||sources[page.path]?.url,resourceLabel=source?'Original source or publisher':sources[page.path]?.label;
 const body=[
  '<main data-seo-prerender="true" style="max-width:68rem;margin:0 auto;padding:2.5rem 1rem;font-family:system-ui,sans-serif">',
  '<article lang="'+escape(page.language||'en')+'" '+(page.language==='ur'?'dir="rtl"':'')+'>',
  '<h1>'+escape(focus)+'</h1>',
  page.kind==='BlogPosting'?'<p><a href="/about" rel="author">KM Afaq</a>'+(safeDate(page.date)?' · <time datetime="'+safeDate(page.date)+'">'+escape(safeDate(page.date).slice(0,10))+'</time>':'')+'</p>':'',
  '<p>'+escape(lead)+'</p>',
  image?'<figure><img loading="eager" fetchpriority="high" decoding="async" src="'+escape(image)+'" alt="'+escape(focus+' illustration or cover')+'" style="max-width:min(100%,48rem);height:auto" /></figure>':'',
  '<h2>'+escape((page.language==='ur'?'مزید تفصیل: ':'About ')+focus)+'</h2>',
  articleContent||'<p>'+escape(description)+'</p>',
  publicArticleLinks(page),
  commercialContent(page),
  faqHtml(page.path),
  links.length?'<nav aria-label="Related pages"><h2>Related articles and resources</h2><ul>'+
   links.map(l=>'<li><a href="'+escape(l.path)+'">'+escape(l.text)+'</a></li>').join('')+'</ul></nav>':'',
  resource?'<p><a href="'+escape(resource)+'" rel="noopener noreferrer">'+escape(resourceLabel)+'</a> — consult this source for current information.</p>':'',
  '</article></main>',
 ].join('');
 const json=JSON.stringify(base).replace(/</g,'\\u003c');
 const head=[
  '<title>'+escape(fitTitle(page.title))+'</title>',
  '<meta name="description" content="'+escape(description)+'" />',
  '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />',
  '<link rel="canonical" href="'+escape(fullUrl)+'" />',
  '<meta property="og:type" content="'+(page.kind==='BlogPosting'?'article':'website')+'" />',
  '<meta property="og:title" content="'+escape(page.title)+'" />',
  '<meta property="og:description" content="'+escape(description)+'" />',
  '<meta name="twitter:card" content="'+(image?'summary_large_image':'summary')+'" />',
  '<meta name="twitter:title" content="'+escape(page.title)+'" />',
  '<meta name="twitter:description" content="'+escape(description)+'" />',
  image?'<meta name="twitter:image" content="'+escape(image)+'" />':'',
  page.kind==='BlogPosting'&&safeDate(page.date)?'<meta property="article:published_time" content="'+safeDate(page.date)+'" /><meta property="article:modified_time" content="'+safeDate(page.modified||page.date)+'" /><meta property="article:author" content="'+site+'/about" />':'',
  '<meta property="og:locale" content="'+(page.language==='ur'?'ur_PK':'en_US')+'" />',
  '<meta property="og:url" content="'+escape(fullUrl)+'" />',
  image?'<meta property="og:image" content="'+escape(image)+'" />':'',
  '<script type="application/ld+json">'+json+'</script>',
  faqSchema(page.path)?'<script type="application/ld+json">'+JSON.stringify(faqSchema(page.path)).replace(/</g,'\\u003c')+'</script>':'',
 ].join('');
 // Helmet must adopt server metadata rather than append a second canonical.
 const managedHead=head.replace(/<(meta|link|script)\b/g,'<$1 data-rh="true"');
 const html=tpl.replace(/<html\b[^>]*>/i, '<html lang="'+(page.language==='ur'?'ur':'en')+'" dir="'+(page.language==='ur'?'rtl':'ltr')+'">').replace(/<title>[\s\S]*?<\/title>/i,'')
  .replace(/<meta\b(?=[^>]*\b(?:name|property)="(?:description|robots|googlebot|og:[^"]+|twitter:[^"]+)")[^>]*\/?>/gi,'')
  .replace(/<link\b(?=[^>]*\brel="canonical")[^>]*\/?>/gi,'')
  .replace(/<script\b(?=[^>]*\btype="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace('</head>',managedHead+'</head>')
  .replace('<div id="root"></div>','<div id="root">'+body+'</div>');
 const path=page.path==='/'?'index.html':page.path.slice(1)+'/index.html';
 const destination=resolve(root,'dist',path);
 await mkdir(dirname(destination),{recursive:true});
 await writeFile(destination,html,'utf8');
}
console.log('[seo] Pre-rendered '+pages.length+' public pages with headings, links and schema.');
