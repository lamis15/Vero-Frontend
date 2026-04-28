/**
 * Affichage du sujet au-dessus des bulles : aligné sur le repli Java (+ transport).
 */

const TRANSPORT = [
  ' car ', ' car?', ' car.', ' car,',
  ' of car', 'about car', 'the car ', ' your car', ' my car', 'using car',
  ' voiture ', 'voiture ', ' voiture',
  ' km ', ' km?', ' km.', ' km,',
  'kilometer', 'kilometre', 'mileage',
  'driving', 'drive ', ' driven', 'driver',
  'vehicle', 'traffic', 'highway', 'motorway', 'parking',
  'fuel', 'essence', 'diesel', 'electric car', 'e-bike', 'ebike',
  'daily commute', 'commute time', 'rush hour', 'carpool'
];

const ECO = [
  'ecovillage', 'eco village', 'ecologie', 'ecologique', 'ecological', 'ecologic', 'ecology',
  'environment', 'environmental', 'climate', 'carbon', 'co2', 'emission',
  'recycle', 'recycling', 'renewable', 'solar', 'wind power', 'pollution',
  'biodiversity', 'deforestation', 'sustainability', 'sustainable', 'ozone',
  'green energy', 'nature', 'planet', 'earth', 'organic farming', 'compost',
  'ecovollage'
];

const PRODUCT = [
  'product', 'products', 'produit', 'produits', 'packaging', 'emballage',
  'biodegradable', 'compostable', 'label', 'brand', 'consumer', 'shopping',
  'fair trade', 'green product', 'eco product', 'ecological product'
];

const LIFESTYLE = [
  'vegan', 'vegetarian', 'vegetarien', 'diet', 'regime', 'commute',
  'commuting', 'bicycle', 'bike', 'walking', 'lifestyle', 'habit', 'gym',
  'public transport', 'metro', 'bus', 'train', 'flight', 'flying', 'travel',
  'mobility', 'mobilite'
];

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function pad(n: string): string {
  return ` ${n} `;
}

function score(normalized: string, terms: readonly string[]): number {
  let s = 0;
  for (const term of terms) {
    if (normalized.includes(term)) s++;
  }
  return s;
}

/** Réponses / bruit : pas de bandeau sujet. */
export function isTrivialChatLine(raw: string | undefined | null): boolean {
  const t = (raw || '').trim();
  if (t.length <= 0) return true;
  if (/\bn'?importe\s+quoi\b/i.test(t)) return true;
  if (t.length <= 2) return true;
  if (t.length <= 4 && /^[\d\s!?.,]+$/i.test(t)) return true;
  const trivial =
    /^(oui|non|ok|okay|yes|no|yep|nope|merci|thanks?|thx|lol|haha|ha+|hm+|bien|cool|nice|d'accord|dac|ouais|si|peut-?etre|peut-être|nimporte|n'importe)$/i;
  if (t.length <= 48 && trivial.test(t)) return true;
  return false;
}

function transportHits(raw: string, padded: string): number {
  let transport = score(padded, TRANSPORT);
  if (transport === 0) {
    if (
      raw.startsWith('car ') ||
      raw.endsWith(' car') ||
      raw.includes(' car ') ||
      raw.includes(' km') ||
      raw.startsWith('km ') ||
      raw.endsWith(' km')
    ) {
      transport = 1;
    }
  }
  return transport;
}

export function inferTopicSlugFromContent(
  text: string | undefined | null
): 'eco' | 'lifestyle' | 'product' | 'transport' | null {
  if (!text || !text.trim()) return null;
  const raw = normalizeText(text);
  const n = pad(raw);
  const transport = transportHits(raw, n);
  const eco = score(n, ECO);
  const product = score(n, PRODUCT);
  const lifestyle = score(n, LIFESTYLE);
  if (eco === 0 && product === 0 && lifestyle === 0 && transport === 0) return null;
  const max = Math.max(transport, eco, product, lifestyle);
  if (transport === max) return 'transport';
  if (product === max) return 'product';
  if (eco === max) return 'eco';
  return 'lifestyle';
}

export type TopicSubjectSlug = 'eco' | 'lifestyle' | 'product' | 'transport';

const LABELS: Record<TopicSubjectSlug, string> = {
  eco: 'Environnement',
  lifestyle: 'Mode de vie',
  product: 'Produits & conso',
  transport: 'Mobilité & trajets'
};

/** Sujet à afficher : backend d’abord, sinon inférence locale ; jamais {@code other}. */
export function topicSubjectRowFromMessage(msg: {
  content: string;
  topic?: string | null;
}): { slug: TopicSubjectSlug; label: string } | null {
  if (isTrivialChatLine(msg.content)) return null;

  let slug = (msg.topic || '').toLowerCase() as string;
  if (slug === 'eco' || slug === 'lifestyle' || slug === 'product' || slug === 'transport') {
    return { slug: slug as TopicSubjectSlug, label: LABELS[slug as TopicSubjectSlug] };
  }

  const inferred = inferTopicSlugFromContent(msg.content);
  if (!inferred) return null;
  return { slug: inferred, label: LABELS[inferred] };
}
