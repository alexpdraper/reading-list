const DOMAINS = [
  'news.example.com',
  'blog.example.org',
  'docs.example.net',
  'shop.example.com',
  'forum.example.io',
  'wiki.example.dev',
  'reader.example.app',
  'press.example.co',
];

const SLUG_WORDS = [
  'deep-dive',
  'weekly-roundup',
  'field-notes',
  'quickstart-guide',
  'case-study',
  'release-notes',
  'design-review',
  'postmortem',
  'benchmarking',
  'interview',
  'opinion',
  'explainer',
];

const TITLE_TEMPLATES = [
  (word, n) => `A ${word.replace(/-/g, ' ')} on distributed systems, part ${n}`,
  (word, n) => `${word.replace(/-/g, ' ')}: what changed in release ${n}`,
  (word, n) => `Why ${word.replace(/-/g, ' ')} still matters in ${2020 + (n % 6)}`,
  (word, n) => `Notes from a ${word.replace(/-/g, ' ')} session, issue #${n}`,
  (word, n) => `The state of ${word.replace(/-/g, ' ')} — issue ${n}`,
];

const UTM_CAMPAIGNS = ['spring-launch', 'weekly-digest', 'partner-share', 'evergreen', 'q3-push'];

function utf8ByteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

export function makeSyntheticItem(index, { baseTimestamp = 1_700_000_000_000, targetRawBytes = 250 } = {}) {
  const domain = DOMAINS[index % DOMAINS.length];
  const word = SLUG_WORDS[index % SLUG_WORDS.length];
  const campaign = UTM_CAMPAIGNS[index % UTM_CAMPAIGNS.length];
  const titleTemplate = TITLE_TEMPLATES[index % TITLE_TEMPLATES.length];
  const year = 2020 + (index % 6);
  const slugId = String(index).padStart(6, '0');

  const title = titleTemplate(word, index);
  const baseUrl = `https://${domain}/articles/${year}/${slugId}/${word}?utm_source=newsletter&utm_campaign=${campaign}&ref=share-${index}`;

  const item = {
    addedAt: baseTimestamp - index * 1000 * 60 * 7,
    title,
    url: baseUrl,
  };

  const baseline = utf8ByteLength(JSON.stringify(item));
  const padNeeded = Math.max(0, targetRawBytes - baseline - '&pad='.length);
  const url = padNeeded > 0 ? `${baseUrl}&pad=${'p'.repeat(padNeeded)}` : baseUrl;

  return { ...item, url };
}

export function makeSyntheticItems(count, options = {}) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(makeSyntheticItem(i, options));
  }
  return items;
}

export function averageRawBytes(items) {
  const total = items.reduce((sum, item) => sum + utf8ByteLength(JSON.stringify(item)), 0);
  return total / items.length;
}
