// Exercise the complete build without credentials or touching real public data.
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const workspace = await mkdtemp(join(tmpdir(), 'kmafaq-build-check-'));
const env = { ...process.env };
for (const name of ['SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VERCEL','SITE_URL','NODE_OPTIONS']) delete env[name];
function run(command, args, overrides = {}) {
  const result = spawnSync(command, args, { cwd: workspace, env: { ...env, ...overrides }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Validation command failed: ${command} (exit ${result.status})`);
}
try {
  for (const name of ['src','server','api','public','scripts','tests','index.html','package.json','vercel.json','vite.config.js']) {
    await cp(resolve(root,name),join(workspace,name),{recursive:true});
  }
  await symlink(resolve(root,'node_modules'),join(workspace,'node_modules'),'dir');
  run(process.execPath,['--import',join(workspace,'tests/fixtures/seo-fetch.mjs'),'scripts/generate-seo.mjs'],{
    SUPABASE_URL:'https://seo-fixture.invalid',SUPABASE_ANON_KEY:'test-fixture',
  });
  run('npm',['run','build']);
  run(process.execPath,['--test',...['article-html','public-page','seo-pages','seo-source','sitemap-routing','sitemap'].map(name=>`tests/${name}.test.mjs`)]);
} finally {
  await rm(workspace,{recursive:true,force:true});
}
