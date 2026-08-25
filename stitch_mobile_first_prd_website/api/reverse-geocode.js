function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'GET 요청만 허용됩니다.' });
  }

  const latitude = Number(request.query.lat);
  const longitude = Number(request.query.lng);
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return sendJson(response, 400, { error: '위도와 경도가 필요합니다.' });
  }
  if (!apiKey) {
    return sendJson(response, 500, { error: 'KAKAO_REST_API_KEY가 Vercel에 설정되지 않았습니다.' });
  }

  try {
    const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');
    kakaoUrl.searchParams.set('x', String(longitude));
    kakaoUrl.searchParams.set('y', String(latitude));
    const kakaoResponse = await fetch(kakaoUrl, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    const kakaoData = await kakaoResponse.json();
    const firstDocument = kakaoData.documents?.[0];
    const address = firstDocument?.road_address?.address_name || firstDocument?.address?.address_name || null;

    return sendJson(response, kakaoResponse.ok ? 200 : kakaoResponse.status, {
      address,
      error: kakaoResponse.ok ? undefined : '카카오 주소 변환에 실패했습니다.',
    });
  } catch {
    return sendJson(response, 502, { error: '카카오 주소 변환에 연결하지 못했습니다.' });
  }
}
