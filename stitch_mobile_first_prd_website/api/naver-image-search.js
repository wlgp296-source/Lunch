function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

const stripHtml = value => String(value ?? '').replace(/<[^>]*>/g, '');

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'GET 요청만 허용됩니다.' });
  }

  const query = String(request.query.q || '').trim();
  const display = Math.min(Math.max(Number(request.query.display || 1), 1), 5);
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!query) return sendJson(response, 400, { error: '검색어가 필요합니다.' });
  if (!clientId || !clientSecret) {
    return sendJson(response, 500, { error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 Vercel에 설정되지 않았습니다.' });
  }

  try {
    const naverUrl = new URL('https://naverapihub.apigw.ntruss.com/search/v1/image');
    naverUrl.searchParams.set('query', query);
    naverUrl.searchParams.set('display', String(display));
    naverUrl.searchParams.set('start', '1');
    naverUrl.searchParams.set('sort', 'sim');
    naverUrl.searchParams.set('filter', 'large');
    naverUrl.searchParams.set('format', 'json');

    const naverResponse = await fetch(naverUrl, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    });
    const naverData = await naverResponse.json();

    if (!naverResponse.ok) return sendJson(response, naverResponse.status, { error: '네이버 이미지 검색에 실패했습니다.' });

    return sendJson(response, 200, {
      query,
      images: (naverData.items || []).map(item => ({
        title: stripHtml(item.title),
        link: item.link || '',
        thumbnail: item.thumbnail || '',
      })),
    });
  } catch {
    return sendJson(response, 502, { error: '네이버 이미지 검색에 연결하지 못했습니다.' });
  }
}
