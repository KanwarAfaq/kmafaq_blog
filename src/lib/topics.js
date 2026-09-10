export const TOPIC_OPTIONS = [
  { value: 'all', label: 'All topics', urdu: 'تمام موضوعات' },
  { value: 'ai-tech', label: 'AI & Tech', urdu: 'اے آئی اور ٹیک' },
  { value: 'business', label: 'Business', urdu: 'کاروبار و معیشت' },
  { value: 'politics', label: 'Politics', urdu: 'سیاست' },
  { value: 'world', label: 'World', urdu: 'دنیا' },
  { value: 'sports', label: 'Sports', urdu: 'کھیل' },
  { value: 'science', label: 'Science', urdu: 'سائنس' },
  { value: 'health', label: 'Health', urdu: 'صحت' },
  { value: 'trending', label: 'Trending', urdu: 'ٹرینڈنگ' },
];

export function topicLabel(value, language = 'en') {
  const item = TOPIC_OPTIONS.find((option) => option.value === value) || TOPIC_OPTIONS.at(-1);
  return language === 'ur' ? item.urdu : item.label;
}
