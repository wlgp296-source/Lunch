import { icon, shell } from '../../shared/ui.js';
import { createInviteUrl, isLocalAppUrl } from '../../shared/router.js';
import { shareInviteToKakao } from '../../shared/kakao.js';
import { publishTeamRoom, startTeamRoomSync } from '../../shared/team-sync.js';

export function renderTeamLobby(state) {
  const members = state.teamRoom.members || [];
  const currentMember = members.find(member => member.name === state.teamRoom.currentUserName);
  const isHost = currentMember?.role === '대표' || state.teamRoom.currentUserName === state.teamRoom.hostName;
  const hasCompletedOwnPreferences = Boolean(currentMember?.preferences?.completed);
  const menuRoundStarted = Boolean(state.teamRoom.menuRoundStarted);
  const inviteUrl = createInviteUrl(state.teamRoom.inviteCode || 'LUNCH-0000');
  const localNotice = isLocalAppUrl() ? '<small class="share-url share-warning">현재 로컬 주소라 다른 사람의 기기에서는 열리지 않아요. 공개 HTTPS 주소를 설정한 뒤 공유해주세요.</small>' : '';
  return shell(`
    <section class="page-content team-flow-content">
      <div class="lobby-heading"><span class="eyebrow">점심방이 만들어졌어요</span><h2>우리팀 점심방</h2><p>팀원들을 초대하고 참여를 기다려보세요.</p></div>
      <div class="invite-card"><div><span class="form-label">초대 코드</span><strong>${state.teamRoom.inviteCode || 'LUNCH-0000'}</strong><small class="share-url">${inviteUrl}</small>${localNotice}</div><button class="copy-button" data-action="copy-invite">${icon('link')} 링크 복사</button></div>
      <button class="primary-button share-button" data-action="share-invite">카톡으로 공유하기</button>
      <div class="member-card"><div class="member-card-heading"><h3>참여한 팀원</h3><span>${members.length}명</span></div><div class="member-list">${members.map(member => `<div class="member-item"><span class="member-avatar">${member.name.slice(0, 1)}</span><span>${member.name}</span><small class="member-status ${member.preferences?.completed ? 'complete' : ''}">${member.preferences?.completed ? '조건 입력 완료' : '조건 입력 전'}</small>${member.role === '대표' ? '<em>대표</em>' : ''}</div>`).join('')}</div></div>
      <p class="waiting-copy">${members.length < 2 ? '팀원에게 초대 코드를 공유해주세요.' : '팀원 조건을 모으면 공통으로 맞는 메뉴를 자동으로 추천해요.'}</p>
      <button class="secondary-button action-button member-condition-button" data-action="member-preferences"><span>${icon('person')}<b>${hasCompletedOwnPreferences ? '내 조건 수정하기' : '내 조건 입력하기'}</b></span>${icon('arrow')}</button>
      ${menuRoundStarted ? '<button class="primary-button" data-action="team-recommendations">메뉴 투표 참여하기</button>' : ''}
      ${isHost ? '<button class="primary-button" data-action="team-preferences">예산·위치 설정하기</button>' : '<p class="section-help lobby-member-help">대표자가 예산과 위치를 정하면 팀원 조건을 자동으로 합쳐 추천해요.</p>'}
    </section>
  `, '우리팀 점심방');
}

export function bindTeamLobbyEvents({ state, save, go, render }) {
  publishTeamRoom(state).catch(() => {});
  startTeamRoomSync(state, save, render);
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('home')));
  document.querySelectorAll('[data-action="team-preferences"]').forEach(button => button.addEventListener('click', () => go('team-preferences')));
  document.querySelectorAll('[data-action="team-recommendations"]').forEach(button => button.addEventListener('click', () => go('team-recommendations')));
  document.querySelectorAll('[data-action="member-preferences"]').forEach(button => button.addEventListener('click', () => go('team-member-preferences')));
  document.querySelectorAll('[data-action="copy-invite"]').forEach(button => button.addEventListener('click', async () => {
    const inviteUrl = createInviteUrl(state.teamRoom.inviteCode);
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* 로컬 미리보기에서는 클립보드 권한이 없을 수 있습니다. */ }
    button.textContent = '링크 복사됨';
  }));
  document.querySelectorAll('[data-action="share-invite"]').forEach(button => button.addEventListener('click', async () => {
    const inviteUrl = createInviteUrl(state.teamRoom.inviteCode);
    const title = 'Lunch Roulette 점심방 초대';
    const description = `${state.teamRoom.hostName || '친구'}님이 점심방에 초대했어요.`;
    try {
      const method = await shareInviteToKakao({ title, description, url: inviteUrl });
      button.textContent = method === 'kakao' ? '카톡 공유 완료' : method === 'system' ? '공유 완료' : '링크 복사됨';
    } catch (error) {
      if (error?.name !== 'AbortError') button.textContent = '링크를 복사해 보내세요';
    }
  }));
}
