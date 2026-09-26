import { BUCKETS_URL } from '../lib-paths.mjs';

const { bucketKey, encodeBucket } = await import(BUCKETS_URL);

function utf8ByteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

const DOMAINS = [
  'news.collide-fixture.test',
  'blog.collide-fixture.test',
  'docs.collide-fixture.test',
  'shop.collide-fixture.test',
  'forum.collide-fixture.test',
  'wiki.collide-fixture.test',
];
const WORDS = [
  'deep-dive',
  'weekly-roundup',
  'field-notes',
  'quickstart-guide',
  'case-study',
  'release-notes',
  'design-review',
  'postmortem',
];
const CAMPAIGNS = ['spring-launch', 'weekly-digest', 'partner-share', 'evergreen', 'q3-push'];

function candidateItem(n, baseTimestamp) {
  const domain = DOMAINS[n % DOMAINS.length];
  const word = WORDS[n % WORDS.length];
  const campaign = CAMPAIGNS[n % CAMPAIGNS.length];
  const year = 2020 + (n % 6);
  const url = `https://${domain}/articles/${year}/${String(n).padStart(6, '0')}/${word}?utm_source=newsletter&utm_campaign=${campaign}&ref=share-${n}`;
  const title = `Collision fixture candidate ${n}: a ${word.replace(/-/g, ' ')} report`;
  return { addedAt: baseTimestamp - n, title, url };
}

export function findOverflowingBucket(bucketCount, {
  overBytes = 8192,
  maxCandidates = 20000,
  baseTimestamp = 1_700_000_000_000,
} = {}) {
  const buckets = new Map();

  for (let n = 0; n < maxCandidates; n++) {
    const item = candidateItem(n, baseTimestamp);
    const key = bucketKey(item.url, bucketCount);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);

    const encoded = encodeBucket(list);
    const realSize = key.length + utf8ByteLength(encoded);
    if (realSize > overBytes) {
      return { key, items: list, encodedByteSize: realSize, candidatesScanned: n + 1 };
    }
  }

  throw new Error(
    `findOverflowingBucket: no bucket exceeded ${overBytes} bytes after scanning ${maxCandidates} candidates at bucketCount=${bucketCount}`,
  );
}
