globalThis.fetch=async input=>{
 const u=new URL(input);if(u.hostname!=='seo-fixture.invalid')throw new Error('Fixture attempted an unexpected network request');const table=u.pathname.split('/').at(-1);
 const posts=[{slug:'audit-english-fixture',title:'Audit English article',excerpt:'A concise factual summary.',content:'# Main answer\n\nOriginal article content.\n\n## Evidence\n\n[Reference](https://example.org/source)\n\n- First fact\n- Second fact\n\n| Fact | Detail |\n| --- | --- |\n| A | B |',language:'en',created_at:'2026-10-20T12:00:00Z',cover_image_url:'https://example.org/cover.jpg',source_url:'https://example.org/source'},{slug:'audit-urdu-fixture',title:'اردو مضمون',content:'## اہم سوال\n\nاصل معلومات۔',language:'ur',created_at:'2026-10-20T12:00:00Z'}];
 return new Response(JSON.stringify(table==='posts'?posts:[]));
};
