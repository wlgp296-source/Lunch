function roomEndpoint(code) {
  return `/api/team-room?code=${encodeURIComponent(code)}`;
}

export async function publishTeamRoom(state) {
  if (!state.teamRoom?.inviteCode) return false;
  const response = await fetch('/api/team-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: state.teamRoom, preferences: state.teamPreferences }),
  });
  return response.ok;
}

export async function syncTeamRoom(state, { save, onChange } = {}) {
  const code = state.teamRoom?.inviteCode;
  if (!code) return false;
  const response = await fetch(roomEndpoint(code));
  if (!response.ok) return false;
  const data = await response.json();
  const currentUserName = state.teamRoom.currentUserName;
  const previous = JSON.stringify({ room: state.teamRoom, preferences: state.teamPreferences });
  state.teamRoom = { ...state.teamRoom, ...(data.room || {}), currentUserName: currentUserName || data.room?.currentUserName || '' };
  if (data.preferences) state.teamPreferences = { ...state.teamPreferences, ...data.preferences };
  const changed = previous !== JSON.stringify({ room: state.teamRoom, preferences: state.teamPreferences });
  if (changed) {
    save?.();
    onChange?.();
  }
  return changed;
}

export function startTeamRoomSync(state, save, render) {
  if (window.__teamRoomSyncTimer) clearInterval(window.__teamRoomSyncTimer);
  const refresh = () => syncTeamRoom(state, { save, onChange: render }).catch(() => {});
  refresh();
  window.__teamRoomSyncTimer = window.setInterval(refresh, 3000);
  return () => clearInterval(window.__teamRoomSyncTimer);
}
