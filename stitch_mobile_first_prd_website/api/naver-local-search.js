function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

const stripHtml = value => String(value ?? '').replace(/<[^>]*>/g, '');

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'GET 요청만 허용됩니다.' });
  }

  const query = String(request.query.q || '').trim();
  const display = Math.min(Math.max(Number(request.query.display || 5), 1), 5);
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!query) return sendJson(response, 400, { error: '검색어가 필요합니다.' });
  if (!clientId || !clientSecret) return sendJson(response, 500, { error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 Vercel에 설정되지 않았습니다.' });

  try {
    const url = new URL('https://naverapihub.apigw.ntruss.com/search/v1/local');
    url.searchParams.set('query', query);
    url.searchParams.set('display', String(display));
    url.searchParams.set('start', '1');
    url.searchParams.set('sort', 'random');
    url.searchParams.set('format', 'json');
    const upstream = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    });
    const data = await readJson(upstream);
    if (!upstream.ok || !data) return sendJson(response, 502, { error: '네이버 지역 검색이 JSON으로 응답하지 않았습니다.' });

    const restaurants = (data.items || []).map(item => ({
      name: stripHtml(item.title),
      category: stripHtml(item.category),
      address: item.roadAddress || item.address || '',
      link: item.link || '',
      latitude: Number.isFinite(Number(item.mapy)) ? Number(item.mapy) / 10_000_000 : null,
      longitude: Number.isFinite(Number(item.mapx)) ? Number(item.mapx) / 10_000_000 : null,
    }));
    return sendJson(response, 200, { query, total: Number(data.total || restaurants.length), restaurants });
  } catch {
    return sendJson(response, 502, { error: '네이버 지역 검색에 연결하지 못했습니다.' });
  }
}
