const stripHtml = value => String(value ?? '').replace(/<[^>]*>/g, '');

const normalizeText = value => stripHtml(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[^가-힣a-z0-9]/g, '');

function parsePrice(value, unit = 'won') {
  const number = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(number)) return null;
  return unit === 'manwon' ? Math.round(number * 10_000) : number;
}

export function extractPrices(text) {
  const source = stripHtml(text);
  const prices = [];

  for (const match of source.matchAll(/(\d+(?:\.\d+)?)\s*만\s*(?:원|원대)/g)) {
    const price = parsePrice(match[1], 'manwon');
    if (price) prices.push(price);
  }

  for (const match of source.matchAll(/(\d+(?:\.\d+)?)\s*천\s*(?:원|원대)?/g)) {
    const price = parsePrice(match[1]) * 1000;
    if (price) prices.push(price);
  }

  for (const match of source.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*원/g)) {
    const price = parsePrice(match[1]);
    if (price) prices.push(price);
  }

  for (const match of source.matchAll(/(\d{1,3}(?:,\d{3})+)(?!\d)/g)) {
    const price = parsePrice(match[1]);
    if (price) prices.push(price);
  }

  return [...new Set(prices)];
}

function hasMenuMention(text, mealName) {
  const normalizedText = normalizeText(text);
  const mealTokens = String(mealName ?? '')
    .split(/\s+/)
    .map(normalizeText)
    .filter(token => token.length >= 2);
  const normalizedMeal = normalizeText(mealName);
  return Boolean(normalizedMeal && normalizedText.includes(normalizedMeal))
    || (mealTokens.length > 0 && mealTokens.every(token => normalizedText.includes(token)));
}

function hasRestaurantMention(text, restaurantName) {
  const normalizedText = normalizeText(text);
  const restaurantTokens = String(restaurantName ?? '')
    .split(/\s+/)
    .map(normalizeText)
    .filter(token => token.length >= 2);
  const normalizedRestaurant = normalizeText(restaurantName);
  return Boolean(normalizedRestaurant && normalizedText.includes(normalizedRestaurant))
    || (restaurantTokens.length > 0 && restaurantTokens.some(token => normalizedText.includes(token)));
}

function pricesNearMenu(text, mealName) {
  const source = stripHtml(text);
  const mealToken = String(mealName ?? '').trim().split(/\s+/).filter(Boolean)[0] || '';
  const mealIndex = source.toLowerCase().indexOf(mealToken.toLowerCase());
  if (mealIndex < 0) return [];

  // 주소·전화번호·다른 메뉴의 숫자를 잘못 가져오지 않도록 메뉴명 주변만 확인합니다.
  const windowStart = Math.max(0, mealIndex - 80);
  const windowEnd = Math.min(source.length, mealIndex + String(mealName).length + 180);
  return extractPrices(source.slice(windowStart, windowEnd));
}

function isPlausiblePrice(price, expectedPrice) {
  if (!Number.isFinite(price) || price < 2_500 || price > 100_000) return false;
  if (!Number.isFinite(expectedPrice)) return true;

  const minimum = expectedPrice <= 5_000 ? Math.max(2_500, Math.round(expectedPrice * 0.5)) : 5_000;
  const maximum = Math.max(15_000, Math.round(expectedPrice * 2));
  return price >= minimum && price <= maximum;
}

export function findPriceHint(posts, { restaurantName, mealName, expectedPrice }) {
  const candidates = (posts || []).flatMap(post => {
    const text = `${post.title || ''} ${post.description || ''}`;
    const prices = extractPrices(text);
    const nearbyPrices = pricesNearMenu(text, mealName).filter(price => isPlausiblePrice(price, expectedPrice));
    if (!prices.length || !hasMenuMention(text, mealName) || !hasRestaurantMention(text, restaurantName) || !nearbyPrices.length) return [];

    const score = (hasRestaurantMention(text, restaurantName) ? 2 : 0)
      + (hasMenuMention(text, mealName) ? 2 : 0);
    return nearbyPrices.map(price => ({
      price,
      sourceUrl: post.link,
      sourceTitle: post.title,
      sourceDate: post.postDate,
      score,
    }));
  });

  return candidates.sort((left, right) => right.score - left.score)[0] || null;
}

const priceCache = new Map();
const goodPriceCache = new Map();

export async function addNaverPriceHints(restaurants, mealName, expectedPrice) {
  return Promise.all((restaurants || []).map(async restaurant => {
    const query = `${restaurant.name} ${mealName} 메뉴판 가격`;
    if (!priceCache.has(query)) {
      priceCache.set(query, fetch(`/api/naver-blog-search?q=${encodeURIComponent(query)}&display=5`)
        .then(async response => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '네이버 가격 검색에 실패했습니다.');
          return findPriceHint(data.posts, { restaurantName: restaurant.name, mealName, expectedPrice });
        })
        .catch(() => ({ priceLookupError: true })));
    }

    const priceHint = await priceCache.get(query);
    return { ...restaurant, ...(priceHint || {}) };
  }));
}

export async function addGoodPriceHints(restaurants, mealName) {
  return Promise.all((restaurants || []).map(async restaurant => {
    const cacheKey = `${restaurant.name}|${restaurant.address}|${mealName}`;
    if (!goodPriceCache.has(cacheKey)) {
      const params = new URLSearchParams({ restaurant: restaurant.name, address: restaurant.address || '', meal: mealName });
      goodPriceCache.set(cacheKey, fetch(`/api/good-price-search?${params}`)
        .then(async response => {
          if (response.status === 404 || response.status === 503) return null;
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '착한가격업소 검색에 실패했습니다.');
          return data.matched ? data : null;
        })
        .catch(() => null));
    }

    const goodPrice = await goodPriceCache.get(cacheKey);
    return goodPrice
      ? { ...restaurant, price: goodPrice.price, sourceUrl: goodPrice.sourceUrl, goodPrice: true, goodPriceMenuName: goodPrice.menuName }
      : restaurant;
  }));
}
