import { readFileSync } from 'node:fs';
import goodPriceHandler from './api/good-price-search.js';

let envFile = '';
try {
  envFile = readFileSync(new URL('./.env', import.meta.url), 'utf8');
} catch {
  // 배포 환경에서는 비밀값을 파일로 올리지 않고 호스팅 환경변수로 주입합니다.
}

const readEnv = name => envFile.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() || process.env[name] || '';
const kakaoApiKey = readEnv('KAKAO_REST_API_KEY');
const naverClientId = readEnv('NAVER_CLIENT_ID');
const naverClientSecret = readEnv('NAVER_CLIENT_SECRET');
const goodPriceApiKey = readEnv('MOIS_GOOD_PRICE_API_KEY');
const goodPriceApiUrl = readEnv('MOIS_GOOD_PRICE_API_URL');
const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabasePublishableKey = readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const teamRooms = new Map();

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const stripHtml = value => String(value ?? '').replace(/<[^>]*>/g, '');

const scaledCoordinate = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number / 10_000_000 : null;
};

const readJsonBody = request => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
  });
  request.on('error', reject);
});

function mergeTeamMembers(existing = [], incoming = []) {
  const members = [...existing];
  incoming.forEach(member => {
    const index = members.findIndex(item => item.id === member.id || item.name === member.name);
    if (index >= 0) members[index] = { ...members[index], ...member, preferences: { ...(members[index].preferences || {}), ...(member.preferences || {}) } };
    else members.push(member);
  });
  return members;
}

export default {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
  },
  plugins: [
      {
        name: 'lunch-roulette-kakao-geocoder',
        configureServer(server) {
          server.middlewares.use('/api/team-room', async (request, response, next) => {
            const requestUrl = new URL(request.url || '', 'http://localhost');
            if (request.method === 'GET') {
              const code = requestUrl.searchParams.get('code')?.trim();
              const saved = code ? teamRooms.get(code) : null;
              if (!saved) {
                sendJson(response, 404, { error: '점심방을 찾지 못했습니다.' });
                return;
              }
              sendJson(response, 200, saved);
              return;
            }

            if (request.method === 'POST') {
              try {
                const payload = await readJsonBody(request);
                const incomingRoom = payload.room || {};
                const code = String(incomingRoom.inviteCode || '').trim();
                if (!code) {
                  sendJson(response, 400, { error: '초대 코드가 필요합니다.' });
                  return;
                }
                const previous = teamRooms.get(code) || { room: {}, preferences: null };
                const room = {
                  ...previous.room,
                  ...incomingRoom,
                  inviteCode: code,
                  members: mergeTeamMembers(previous.room.members, incomingRoom.members),
                };
                const saved = { room, preferences: payload.preferences || previous.preferences || null, updatedAt: new Date().toISOString() };
                teamRooms.set(code, saved);
                sendJson(response, 200, saved);
              } catch (error) {
                sendJson(response, 400, { error: '점심방 정보를 저장하지 못했습니다.' });
              }
              return;
            }

            next();
          });

          server.middlewares.use('/api/reverse-geocode', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }

            const requestUrl = new URL(request.url || '', 'http://localhost');
            const latitude = Number(requestUrl.searchParams.get('lat'));
            const longitude = Number(requestUrl.searchParams.get('lng'));

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              sendJson(response, 400, { error: '위도와 경도가 필요합니다.' });
              return;
            }

            if (!kakaoApiKey) {
              sendJson(response, 500, { error: 'KAKAO_REST_API_KEY가 설정되지 않았습니다.' });
              return;
            }

            try {
              const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');
              kakaoUrl.searchParams.set('x', String(longitude));
              kakaoUrl.searchParams.set('y', String(latitude));

              const kakaoResponse = await fetch(kakaoUrl, {
                headers: { Authorization: `KakaoAK ${kakaoApiKey}` },
              });
              const kakaoData = await kakaoResponse.json();
              const firstDocument = kakaoData.documents?.[0];
              const address = firstDocument?.road_address?.address_name || firstDocument?.address?.address_name || null;

              sendJson(response, kakaoResponse.ok ? 200 : kakaoResponse.status, { address });
            } catch (error) {
              sendJson(response, 502, { error: '카카오 주소 변환에 연결하지 못했습니다.' });
            }
          });

          server.middlewares.use('/api/geocode', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }

            const requestUrl = new URL(request.url || '', 'http://localhost');
            const query = requestUrl.searchParams.get('q')?.trim();

            if (!query) {
              sendJson(response, 400, { error: '주소가 필요합니다.' });
              return;
            }

            if (!kakaoApiKey) {
              sendJson(response, 500, { error: 'KAKAO_REST_API_KEY가 설정되지 않았습니다.' });
              return;
            }

            try {
              const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/address.json');
              kakaoUrl.searchParams.set('query', query);
              kakaoUrl.searchParams.set('size', '1');

              let kakaoResponse = await fetch(kakaoUrl, {
                headers: { Authorization: `KakaoAK ${kakaoApiKey}` },
              });
              let kakaoData = await kakaoResponse.json();
              let firstDocument = kakaoData.documents?.[0];

              if (!firstDocument) {
                const keywordUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
                keywordUrl.searchParams.set('query', query);
                keywordUrl.searchParams.set('size', '1');
                kakaoResponse = await fetch(keywordUrl, {
                  headers: { Authorization: `KakaoAK ${kakaoApiKey}` },
                });
                kakaoData = await kakaoResponse.json();
                firstDocument = kakaoData.documents?.[0];
              }

              if (!kakaoResponse.ok) {
                sendJson(response, kakaoResponse.status, { error: '주소 검색에 실패했습니다.' });
                return;
              }

              if (!firstDocument || !Number.isFinite(Number(firstDocument.y)) || !Number.isFinite(Number(firstDocument.x))) {
                sendJson(response, 404, { error: '주소의 위치를 찾지 못했습니다.' });
                return;
              }

              sendJson(response, 200, {
                address: firstDocument.road_address_name || firstDocument.road_address?.address_name || firstDocument.address_name || query,
                coordinates: {
                  latitude: Number(firstDocument.y),
                  longitude: Number(firstDocument.x),
                },
              });
            } catch (error) {
              sendJson(response, 502, { error: '주소 검색 서버에 연결하지 못했습니다.' });
            }
          });

          server.middlewares.use('/api/naver-local-search', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }

            const requestUrl = new URL(request.url || '', 'http://localhost');
            const query = requestUrl.searchParams.get('q')?.trim();
            const display = Math.min(Math.max(Number(requestUrl.searchParams.get('display') || 5), 1), 5);

            if (!query) {
              sendJson(response, 400, { error: '검색어가 필요합니다.' });
              return;
            }

            if (!naverClientId || !naverClientSecret) {
              sendJson(response, 500, { error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.' });
              return;
            }

            try {
              const naverUrl = new URL('https://naverapihub.apigw.ntruss.com/search/v1/local');
              naverUrl.searchParams.set('query', query);
              naverUrl.searchParams.set('display', String(display));
              naverUrl.searchParams.set('start', '1');
              naverUrl.searchParams.set('sort', 'random');
              naverUrl.searchParams.set('format', 'json');

              const naverResponse = await fetch(naverUrl, {
                headers: {
                  'X-NCP-APIGW-API-KEY-ID': naverClientId,
                  'X-NCP-APIGW-API-KEY': naverClientSecret,
                },
              });
              const naverData = await naverResponse.json();

              if (!naverResponse.ok) {
                sendJson(response, naverResponse.status, { error: '네이버 지역 검색에 실패했습니다.' });
                return;
              }

              const restaurants = (naverData.items || []).map(item => ({
                name: stripHtml(item.title),
                category: stripHtml(item.category),
                address: item.roadAddress || item.address || '',
                link: item.link || '',
                latitude: scaledCoordinate(item.mapy),
                longitude: scaledCoordinate(item.mapx),
              }));

              sendJson(response, 200, {
                query,
                total: Number(naverData.total || restaurants.length),
                restaurants,
              });
            } catch (error) {
              sendJson(response, 502, { error: '네이버 지역 검색에 연결하지 못했습니다.' });
            }
          });

          server.middlewares.use('/api/naver-blog-search', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }

            const requestUrl = new URL(request.url || '', 'http://localhost');
            const query = requestUrl.searchParams.get('q')?.trim();
            const display = Math.min(Math.max(Number(requestUrl.searchParams.get('display') || 5), 1), 10);

            if (!query) {
              sendJson(response, 400, { error: '검색어가 필요합니다.' });
              return;
            }

            if (!naverClientId || !naverClientSecret) {
              sendJson(response, 500, { error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.' });
              return;
            }

            try {
              const naverUrl = new URL('https://naverapihub.apigw.ntruss.com/search/v1/blog');
              naverUrl.searchParams.set('query', query);
              naverUrl.searchParams.set('display', String(display));
              naverUrl.searchParams.set('start', '1');
              naverUrl.searchParams.set('sort', 'sim');
              naverUrl.searchParams.set('format', 'json');

              const naverResponse = await fetch(naverUrl, {
                headers: {
                  'X-NCP-APIGW-API-KEY-ID': naverClientId,
                  'X-NCP-APIGW-API-KEY': naverClientSecret,
                },
              });
              const naverData = await naverResponse.json();

              if (!naverResponse.ok) {
                sendJson(response, naverResponse.status, { error: '네이버 블로그 검색에 실패했습니다.' });
                return;
              }

              const posts = (naverData.items || []).map(item => ({
                title: stripHtml(item.title),
                link: item.link || '',
                description: stripHtml(item.description),
                bloggerName: stripHtml(item.bloggername),
                postDate: item.postdate || '',
              }));

              sendJson(response, 200, {
                query,
                total: Number(naverData.total || posts.length),
                posts,
              });
            } catch (error) {
              sendJson(response, 502, { error: '네이버 블로그 검색에 연결하지 못했습니다.' });
            }
          });

          server.middlewares.use('/api/naver-image-search', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }

            const requestUrl = new URL(request.url || '', 'http://localhost');
            const query = requestUrl.searchParams.get('q')?.trim();
            const display = Math.min(Math.max(Number(requestUrl.searchParams.get('display') || 1), 1), 5);

            if (!query) {
              sendJson(response, 400, { error: '검색어가 필요합니다.' });
              return;
            }

            if (!naverClientId || !naverClientSecret) {
              sendJson(response, 500, { error: 'NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.' });
              return;
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
                  'X-NCP-APIGW-API-KEY-ID': naverClientId,
                  'X-NCP-APIGW-API-KEY': naverClientSecret,
                },
              });
              const naverData = await naverResponse.json();

              if (!naverResponse.ok) {
                sendJson(response, naverResponse.status, { error: '네이버 이미지 검색에 실패했습니다.' });
                return;
              }

              const images = (naverData.items || []).map(item => ({
                title: stripHtml(item.title),
                link: item.link || '',
                thumbnail: item.thumbnail || '',
              }));

              sendJson(response, 200, { query, images });
            } catch (error) {
              sendJson(response, 502, { error: '네이버 이미지 검색에 연결하지 못했습니다.' });
            }
          });

          server.middlewares.use('/api/good-price-search', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }
            request.goodPriceConfig = { apiKey: goodPriceApiKey, apiUrl: goodPriceApiUrl };
            await goodPriceHandler(request, response);
          });

          server.middlewares.use('/api/driving-times', async (request, response, next) => {
            if (request.method !== 'GET') {
              next();
              return;
            }

            const requestUrl = new URL(request.url || '', 'http://localhost');
            const originLatitude = Number(requestUrl.searchParams.get('originLat'));
            const originLongitude = Number(requestUrl.searchParams.get('originLng'));
            const destinationPairs = (requestUrl.searchParams.get('destinations') || '')
              .split(';')
              .filter(Boolean)
              .slice(0, 5)
              .map(pair => pair.split(',').map(Number));

            const validOrigin = Number.isFinite(originLatitude) && Number.isFinite(originLongitude);
            const validDestinations = destinationPairs.length > 0 && destinationPairs.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));

            if (!validOrigin || !validDestinations) {
              sendJson(response, 400, { error: '출발지와 목적지 좌표가 필요합니다.' });
              return;
            }

            try {
              const coordinates = [`${originLongitude},${originLatitude}`, ...destinationPairs.map(([longitude, latitude]) => `${longitude},${latitude}`)];
              const osrmUrl = new URL(`https://router.project-osrm.org/table/v1/driving/${coordinates.join(';')}`);
              osrmUrl.searchParams.set('sources', '0');
              osrmUrl.searchParams.set('destinations', destinationPairs.map((_, index) => String(index + 1)).join(';'));
              osrmUrl.searchParams.set('annotations', 'duration,distance');

              const osrmResponse = await fetch(osrmUrl);
              const osrmData = await osrmResponse.json();
              if (!osrmResponse.ok || osrmData.code !== 'Ok') {
                sendJson(response, 502, { error: '차량 이동시간을 계산하지 못했습니다.' });
                return;
              }

              const durations = osrmData.durations?.[0] || [];
              const distances = osrmData.distances?.[0] || [];
              sendJson(response, 200, {
                routes: destinationPairs.map((_, index) => ({
                  durationSeconds: durations[index] ?? null,
                  distanceMeters: distances[index] ?? null,
                })),
              });
            } catch (error) {
              sendJson(response, 502, { error: '차량 경로 서버에 연결하지 못했습니다.' });
            }
          });
        },
      },
  ],
};
