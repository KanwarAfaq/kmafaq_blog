// Shared by interactive articles and crawler-facing HTML.
export function headingId(value = '') {
  return String(value).replace(/[*_`~()[\]]/g, '').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'section';
}

export function extractHeadings(markdown = '') {
  const counts = new Map();
  // Ignore code examples, where # is not an article heading.
  const text = String(markdown).replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
  return Array.from(text.matchAll(/^(#{1,3})\s+(.+)$/gm)).map(match => {
    const text = match[2].replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
    const base = headingId(text);
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return { level: Math.max(2, match[1].length), text, id: count === 1 ? base : `${base}-${count}` };
  }).filter(item => item.text);
}
