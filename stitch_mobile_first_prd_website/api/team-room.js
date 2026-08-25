import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const database = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body;
}

export default async function handler(request, response) {
  if (!database) return sendJson(response, 500, { error: 'Supabase 환경변수가 Vercel에 설정되지 않았습니다.' });

  if (request.method === 'GET') {
    const code = String(request.query.code || '').trim().toUpperCase();
    if (!code) return sendJson(response, 400, { error: '초대 코드가 필요합니다.' });
    const { data, error } = await database.rpc('get_team_room', { p_invite_code: code });

    if (error) return sendJson(response, 500, { error: '팀방을 불러오지 못했습니다.' });
    const room = data?.[0];
    if (!room) return sendJson(response, 404, { error: '해당 초대 코드의 팀방을 찾지 못했습니다.' });
    return sendJson(response, 200, { room: room.room, preferences: room.preferences });
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendJson(response, 405, { error: 'GET 또는 POST 요청만 허용됩니다.' });
  }

  const body = normalizeBody(request.body);
  const incomingRoom = body.room || {};
  const incomingPreferences = body.preferences || {};
  // The browser sends the code in the JSON room for POST requests. Accept a
  // query parameter too so both direct API calls and the browser work.
  const code = String(request.query.code || incomingRoom.inviteCode || body.inviteCode || '').trim().toUpperCase();
  if (!code) return sendJson(response, 400, { error: '초대 코드가 필요합니다.' });
  const { data, error: writeError } = await database.rpc('upsert_team_room', {
    p_invite_code: code,
    p_room: incomingRoom,
    p_preferences: incomingPreferences,
  });

  if (writeError) return sendJson(response, 500, { error: '팀방 정보를 저장하지 못했습니다.' });
  const room = data?.[0];
  return sendJson(response, 200, { room: room?.room || incomingRoom, preferences: room?.preferences || incomingPreferences });
}
