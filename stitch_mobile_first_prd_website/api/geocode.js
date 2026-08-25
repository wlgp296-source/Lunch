function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'GET 요청만 허용됩니다.' });
  }

  const query = String(request.query.q || '').trim();
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!query) return sendJson(response, 400, { error: '주소가 필요합니다.' });
  if (!apiKey) return sendJson(response, 500, { error: 'KAKAO_REST_API_KEY가 Vercel에 설정되지 않았습니다.' });

  try {
    const search = async (endpoint, parameter) => {
      const url = new URL(`https://dapi.kakao.com/v2/local/search/${endpoint}.json`);
      url.searchParams.set(parameter, query);
      url.searchParams.set('size', '1');
      return fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    };

    let kakaoResponse = await search('address', 'query');
    let kakaoData = await kakaoResponse.json();
    let firstDocument = kakaoData.documents?.[0];

    if (!firstDocument) {
      kakaoResponse = await search('keyword', 'query');
      kakaoData = await kakaoResponse.json();
      firstDocument = kakaoData.documents?.[0];
    }

    if (!kakaoResponse.ok) return sendJson(response, kakaoResponse.status, { error: '주소 검색에 실패했습니다.' });
    if (!firstDocument || !Number.isFinite(Number(firstDocument.y)) || !Number.isFinite(Number(firstDocument.x))) {
      return sendJson(response, 404, { error: '주소의 위치를 찾지 못했습니다.' });
    }

    return sendJson(response, 200, {
      address: firstDocument.road_address_name || firstDocument.road_address?.address_name || firstDocument.address_name || query,
      coordinates: {
        latitude: Number(firstDocument.y),
        longitude: Number(firstDocument.x),
      },
    });
  } catch {
    return sendJson(response, 502, { error: '주소 검색 서버에 연결하지 못했습니다.' });
  }
}
