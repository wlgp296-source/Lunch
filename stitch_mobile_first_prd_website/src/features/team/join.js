import { icon, shell } from '../../shared/ui.js';
import { routeParams } from '../../shared/router.js';
import { publishTeamRoom } from '../../shared/team-sync.js';

export function renderTeamJoin(state) {
  const routeCode = routeParams().get('code') || '';
  const inviteCode = routeCode || state.teamRoom.inviteCode || '';
  return shell(`
    <section class="page-content team-flow-content">
      <div class="flow-intro"><div class="flow-icon">${icon('link')}</div><h2>초대받은<br />점심방에 참여해요</h2><p>초대 코드와 닉네임을 입력하면 팀 점심방에 참여할 수 있어요.</p></div>
      <div class="team-panel"><label class="form-label" for="invite-code">초대 코드</label><input class="large-input" id="invite-code" value="${inviteCode}" placeholder="예: LUNCH-1234" maxlength="16" /><label class="form-label" for="join-name">내 닉네임</label><input class="large-input" id="join-name" placeholder="예: 지영" maxlength="12" /></div>
      <button class="primary-button" data-action="join-room">점심방 참여하기</button>
    </section>
  `, '초대 링크로 참여');
}

export function bindTeamJoinEvents({ state, save, go }) {
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('home')));
  document.querySelectorAll('[data-action="join-room"]').forEach(button => button.addEventListener('click', async () => {
    const code = document.querySelector('#invite-code')?.value.trim();
    const nameInput = document.querySelector('#join-name');
    const name = nameInput?.value.trim();
    if (!code || !name) {
      nameInput?.focus();
      nameInput?.classList.add('input-error');
      return;
    }
    delete state.teamPreferences.memberMenuPreferences;
    try {
      const response = await fetch(`/api/team-room?code=${encodeURIComponent(code)}`);
      if (response.ok) {
        const data = await response.json();
        state.teamRoom = { ...state.teamRoom, ...(data.room || {}), inviteCode: code, currentUserName: name };
        if (data.preferences) state.teamPreferences = { ...state.teamPreferences, ...data.preferences };
      }
    } catch { /* 서버가 없는 로컬 미리보기에서는 아래의 로컬 상태로 계속 진행합니다. */ }
    const members = state.teamRoom.members || [];
    if (!members.some(member => member.name === name)) members.push({ id: `member-${Date.now()}`, name, role: '팀원', preferences: { fullness: '상관없음', temperature: '상관없음', category: '상관없음', form: '상관없음', cravings: [], recent: [], customCraving: '', restaurantVotes: [], completed: false } });
    state.teamRoom = { ...state.teamRoom, inviteCode: code, currentUserName: name, members };
    save();
    await publishTeamRoom(state).catch(() => {});
    go('team-member-preferences');
  }));
}
