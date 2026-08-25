const DATA_SOURCE_URL = 'https://www.data.go.kr/data/3045247/fileData.do?recommendDataYn=Y';
const DEFAULT_API_URL = 'https://api.odcloud.kr/api/3045247/v1/uddi:12a36b40-6230-4401-b647-b8456a789c7f';

const stripHtml = value => String(value ?? '').replace(/<[^>]*>/g, '');
const normalize = value => stripHtml(value).replace(/\s+/g, '').toLowerCase();

function sendJson(response, statusCode, payload) {
  if (typeof response.status === 'function') {
    response.status(statusCode).json(payload);
    return;
  }
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function requestValue(request, name) {
  if (request.query?.[name]) return String(request.query[name]).trim();
  return new URL(request.url || '', 'http://localhost').searchParams.get(name)?.trim() || '';
}

function parsePrice(value) {
  const price = Number(String(value ?? '').replace(/[^0-9]/g, ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function rowMenus(row) {
  return [1, 2, 3, 4].map(index => ({
    name: stripHtml(row[`메뉴${index}`]),
    price: parsePrice(row[`가격${index}`]),
  })).filter(menu => menu.name && menu.price);
}

function matchRow(row, restaurantName, address, mealName) {
  const rowName = normalize(row.업소명);
  const rowAddress = normalize(row.주소);
  const requestedName = normalize(restaurantName);
  const requestedAddress = stripHtml(address).toLowerCase();
  const requestedMeal = normalize(mealName);
  const nameMatch = requestedName && rowName && (rowName.includes(requestedName) || requestedName.includes(rowName));
  const addressTokens = requestedAddress.split(/\s+/).map(normalize).filter(token => token.length >= 2);
  const addressMatch = addressTokens.length > 0 && addressTokens.filter(token => rowAddress.includes(token)).length >= Math.min(2, addressTokens.length);
  const menus = rowMenus(row);
  const mealMatch = menus.find(menu => normalize(menu.name).includes(requestedMeal) || requestedMeal.includes(normalize(menu.name)));
  if (!nameMatch || (!addressMatch && requestedAddress)) return null;
  return mealMatch || menus[0] || null;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'GET 요청만 허용됩니다.' });

  const restaurantName = requestValue(request, 'restaurant');
  const address = requestValue(request, 'address');
  const mealName = requestValue(request, 'meal');
  const config = request.goodPriceConfig || {};
  const apiKey = config.apiKey || process.env.MOIS_GOOD_PRICE_API_KEY;
  const apiUrl = config.apiUrl || process.env.MOIS_GOOD_PRICE_API_URL || DEFAULT_API_URL;

  if (!restaurantName || !mealName) return sendJson(response, 400, { error: '식당명과 메뉴명이 필요합니다.' });
  if (!apiKey) return sendJson(response, 503, { error: 'MOIS_GOOD_PRICE_API_KEY가 설정되지 않았습니다.' });

  try {
    const url = new URL(apiUrl);
    url.searchParams.set('page', '1');
    url.searchParams.set('perPage', '100');
    url.searchParams.set('returnType', 'JSON');
    url.searchParams.set('serviceKey', apiKey);
    url.searchParams.set('cond[업소명::LIKE]', restaurantName);

    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok || !Array.isArray(data.data)) return sendJson(response, upstream.ok ? 502 : upstream.status, { error: '착한가격업소 API 응답을 확인하지 못했습니다.' });

    const matched = data.data.map(row => ({ row, menu: matchRow(row, restaurantName, address, mealName) })).find(item => item.menu);
    if (!matched) return sendJson(response, 404, { matched: false });

    return sendJson(response, 200, {
      matched: true,
      shopName: stripHtml(matched.row.업소명),
      address: stripHtml(matched.row.주소),
      menuName: matched.menu.name,
      price: matched.menu.price,
      sourceUrl: DATA_SOURCE_URL,
    });
  } catch {
    return sendJson(response, 502, { error: '착한가격업소 API에 연결하지 못했습니다.' });
  }
}
