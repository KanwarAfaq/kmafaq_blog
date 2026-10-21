import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
const safeDate=value=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toISOString():undefined;
for(const page of pages){
 const fullUrl=site+page.path,description=clean(page.description||page.title);
 const focus=clean(page.title),lead=description.toLocaleLowerCase().includes(focus.toLocaleLowerCase())?description:focus+' — '+description;
 const image=external(page.image),source=external(page.source);
 const author={'@type':'Person',name:'KM Afaq',url:site+'/'};
 const publisher={'@type':'Organization',name:'KM Afaq',url:site+'/'};
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
 const paragraphs=String(page.content||'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi,'\n\n')
  .replace(/<br\s*\/?>/gi,'\n\n')
  .replace(/<[^>]*>/g,' ')
  .replace(/^\s{0,3}#{1,6}\s+/gm,'')
  .slice(0,40000)
  .split(/\n\s*\n/)
  .map(part=>part.replace(/\s+/g,' ').trim())
  .filter(Boolean)
  .slice(0,80);
 const articleContent=page.kind==='BlogPosting'&&paragraphs.length
  ?'<section data-seo-article-body="true"><h2>Article</h2>'+paragraphs.map(part=>'<p>'+escape(part)+'</p>').join('')+'</section>'
  :'';
 const resource=source||sources[page.path]?.url,resourceLabel=source?'Original source or publisher':sources[page.path]?.label;
 const body=[
  '<main data-seo-prerender="true" style="max-width:68rem;margin:0 auto;padding:2.5rem 1rem;font-family:system-ui,sans-serif">',
  '<article lang="'+escape(page.language||'en')+'" '+(page.language==='ur'?'dir="rtl"':'')+'>',
  '<h1>'+escape(focus)+'</h1>',
  '<p>'+escape(lead)+'</p>',
  image?'<figure><img loading="lazy" src="'+escape(image)+'" alt="'+escape(focus+' illustration or cover')+'" style="max-width:min(100%,48rem);height:auto" /></figure>':'',
  '<h2>'+escape((page.language==='ur'?'مزید تفصیل: ':'About ')+focus)+'</h2>',
  articleContent||'<p>'+escape(description)+'</p>',
  publicArticleLinks(page),
  links.length?'<nav aria-label="Related pages"><h2>Related articles and resources</h2><ul>'+
   links.map(l=>'<li><a href="'+escape(l.path)+'">'+escape(l.text)+'</a></li>').join('')+'</ul></nav>':'',
  resource?'<p><a href="'+escape(resource)+'" rel="noopener noreferrer">'+escape(resourceLabel)+'</a> — consult this source for current information.</p>':'',
  '</article></main>',
 ].join('');
 const json=JSON.stringify(base).replace(/</g,'\\u003c');
 const head=[
  '<title>'+escape(page.title)+' | KM Afaq</title>',
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
  '<meta property="og:locale" content="'+(page.language==='ur'?'ur_PK':'en_US')+'" />',
  '<meta property="og:url" content="'+escape(fullUrl)+'" />',
  image?'<meta property="og:image" content="'+escape(image)+'" />':'',
  '<script type="application/ld+json">'+json+'</script>',
 ].join('');
 const html=tpl.replace(/<html\b[^>]*>/i, '<html lang="'+(page.language==='ur'?'ur':'en')+'" dir="'+(page.language==='ur'?'rtl':'ltr')+'">').replace(/<title>[\s\S]*?<\/title>/i,'')
  .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*\/?>/gi,'')
  .replace(/<link\s+rel="canonical"[^>]*\/?>/gi,'')
  .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi,'')
  .replace('</head>',head+'</head>')
  .replace('<div id="root"></div>','<div id="root">'+body+'</div>');
 const path=page.path==='/'?'index.html':page.path.slice(1)+'/index.html';
 const destination=resolve(root,'dist',path);
 await mkdir(dirname(destination),{recursive:true});
 await writeFile(destination,html,'utf8');
}
console.log('[seo] Pre-rendered '+pages.length+' public pages with headings, links and schema.');
