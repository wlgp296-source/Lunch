function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'GET 요청만 허용됩니다.' });
  }

  const originLatitude = Number(request.query.originLat);
  const originLongitude = Number(request.query.originLng);
  const destinationPairs = String(request.query.destinations || '')
    .split(';').filter(Boolean).slice(0, 5)
    .map(pair => pair.split(',').map(Number));
  const validOrigin = Number.isFinite(originLatitude) && Number.isFinite(originLongitude);
  const validDestinations = destinationPairs.length > 0 && destinationPairs.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  if (!validOrigin || !validDestinations) return sendJson(response, 400, { error: '출발지와 목적지 좌표가 필요합니다.' });

  try {
    const coordinates = [`${originLongitude},${originLatitude}`, ...destinationPairs.map(([longitude, latitude]) => `${longitude},${latitude}`)];
    const url = new URL(`https://router.project-osrm.org/table/v1/driving/${coordinates.join(';')}`);
    url.searchParams.set('sources', '0');
    url.searchParams.set('destinations', destinationPairs.map((_, index) => String(index + 1)).join(';'));
    url.searchParams.set('annotations', 'duration,distance');
    const upstream = await fetch(url);
    const data = await readJson(upstream);
    if (!upstream.ok || !data || data.code !== 'Ok') return sendJson(response, 502, { error: '차량 이동시간을 계산하지 못했습니다.' });

    const durations = data.durations?.[0] || [];
    const distances = data.distances?.[0] || [];
    return sendJson(response, 200, {
      routes: destinationPairs.map((_, index) => ({
        durationSeconds: durations[index] ?? null,
        distanceMeters: distances[index] ?? null,
      })),
    });
  } catch {
    return sendJson(response, 502, { error: '차량 경로 서버에 연결하지 못했습니다.' });
  }
}
