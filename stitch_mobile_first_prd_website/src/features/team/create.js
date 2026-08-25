import { icon, shell } from '../../shared/ui.js';
import { publishTeamRoom } from '../../shared/team-sync.js';
import { ensureStableIdentityId } from '../../shared/supabase.js';

export function renderTeamCreate() {
  return shell(`
    <section class="page-content team-flow-content">
      <div class="flow-intro"><div class="flow-icon">${icon('group')}</div><h2>우리팀 점심방을<br />만들어볼까요?</h2><p>팀원들을 초대하고 모두의 점심 메뉴를 함께 골라보세요.</p></div>
      <div class="team-panel"><label class="form-label" for="host-name">내 닉네임</label><input class="large-input" id="host-name" placeholder="예: 민수" maxlength="12" /><p class="field-help">팀원들이 알아볼 수 있는 이름을 입력해주세요.</p></div>
      <button class="primary-button" data-action="create-room">점심방 만들기</button>
    </section>
  `, '팀 점심방 만들기');
}

export function bindTeamCreateEvents({ state, save, go }) {
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('home')));
  document.querySelectorAll('[data-action="create-room"]').forEach(button => button.addEventListener('click', async () => {
    const input = document.querySelector('#host-name');
    const name = input?.value.trim();
    if (!name) {
      input?.focus();
      input?.classList.add('input-error');
      return;
    }
    const code = `LUNCH-${Math.floor(1000 + Math.random() * 9000)}`;
    const identityId = await ensureStableIdentityId();
    state.teamRoom = {
      roomId: `room-${Date.now()}`,
      inviteCode: code,
      hostName: name,
      currentUserName: name,
      members: [{ id: identityId, name, role: '대표', preferences: { fullness: '상관없음', temperature: '상관없음', category: '상관없음', form: '상관없음', cravings: [], recent: [], customCraving: '', restaurantVotes: [], completed: false } }],
      menuRoundStarted: false,
      teamVotes: {},
      teamVoters: {},
      teamVoteSelections: {},
    };
    state.teamVotes = {};
    state.myVotes = [];
    state.rouletteResult = null;
    state.teamSelectedMeal = null;
    state.teamMenuConfirmed = false;
    const { memberMenuPreferences, ...teamPreferencesWithoutMember } = state.teamPreferences;
    state.teamPreferences = { ...teamPreferencesWithoutMember, location: '강남역 주변' };
    save();
    const published = await publishTeamRoom(state).catch(() => false);
    if (!published) {
      window.alert('점심방을 저장하지 못했어요. 잠시 후 다시 만들어 주세요.');
      return;
    }
    go('team-lobby');
  }));
}
