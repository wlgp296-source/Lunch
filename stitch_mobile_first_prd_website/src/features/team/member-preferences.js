import { recentMenus, teamCravings, teamPreferenceAxes } from '../../shared/data.js';
import { icon, shell } from '../../shared/ui.js';
import { publishTeamRoom } from '../../shared/team-sync.js';

const defaultPreferences = {
  fullness: '상관없음',
  temperature: '상관없음',
  category: '상관없음',
  form: '상관없음',
  cravings: [],
  recent: [],
  customCraving: '',
  restaurantVotes: [],
  completed: false,
};

export function renderTeamMemberPreferences(state) {
  const member = (state.teamRoom.members || []).find(item => item.name === state.teamRoom.currentUserName) || state.teamRoom.members?.[0];
  const preferences = { ...defaultPreferences, ...(member?.preferences || {}) };
  const axisSections = teamPreferenceAxes.map(axis => `
    <div class="preference-axis">
      <h3>${axis.label}</h3>
      <div class="choice-grid">
        ${axis.options.map(option => `<button type="button" class="chip choice-chip ${preferences[axis.id] === option ? 'selected' : ''}" data-member-axis="${axis.id}" data-member-value="${option}">${option}</button>`).join('')}
      </div>
    </div>
  `).join('');
  const cravings = teamCravings.map(craving => `<button class="chip taste-chip ${preferences.cravings.includes(craving.id) ? 'selected' : ''}" data-member-craving="${craving.id}">${craving.image ? `<img class="taste-image" src="${craving.image}" alt="" />` : `<span class="taste-emoji">${craving.emoji}</span>`}<span>${craving.label}</span></button>`).join('');
  const recent = recentMenus.map(menu => `<button class="tag ${preferences.recent.includes(menu) ? 'selected' : ''}" data-member-recent="${menu}">${menu}</button>`).join('');
  return shell(`<section class="page-content preference-content team-member-preferences"><div class="flow-intro"><div class="flow-icon">${icon('person')}</div><h2>${member?.name || '팀원'}님의 메뉴 조건</h2><p>팀원마다 자기 조건을 입력하면 공통으로 맞는 메뉴를 자동으로 찾아요.</p></div><div class="section-block"><h2>기본 취향</h2><p class="section-help">각 항목에서 하나씩 선택해 주세요.</p>${axisSections}</div><div class="section-block"><h2>오늘의 당김</h2><p class="section-help">여러 개를 선택할 수 있어요.</p><div class="taste-grid">${cravings}</div></div><div class="section-block"><h2>최근 먹은 메뉴</h2><p class="section-help">최근 먹은 메뉴는 추천에서 우선 제외해요.</p><div class="tag-list">${recent}</div></div><button class="primary-button" data-action="save-member-preferences">내 조건 저장하기</button></section>`, '내 조건 입력');
}

export function bindTeamMemberPreferencesEvents({ state, save, go, render }) {
  const member = (state.teamRoom.members || []).find(item => item.name === state.teamRoom.currentUserName) || state.teamRoom.members?.[0];
  if (!member) {
    go('team-lobby');
    return;
  }
  member.preferences = { ...defaultPreferences, ...(member.preferences || {}) };
  const rememberCurrentConditions = () => {
    state.teamPreferences.memberMenuPreferences = { ...member.preferences };
    save();
  };
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('team-lobby')));
  document.querySelectorAll('[data-member-axis]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    member.preferences = { ...member.preferences, [button.dataset.memberAxis]: button.dataset.memberValue };
    rememberCurrentConditions();
    render();
  }));
  document.querySelectorAll('[data-member-craving]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.memberCraving;
    member.preferences.cravings = member.preferences.cravings.includes(id) ? member.preferences.cravings.filter(item => item !== id) : [...member.preferences.cravings, id];
    rememberCurrentConditions();
    render();
  }));
  document.querySelectorAll('[data-member-recent]').forEach(button => button.addEventListener('click', () => {
    const menu = button.dataset.memberRecent;
    member.preferences.recent = member.preferences.recent.includes(menu) ? member.preferences.recent.filter(item => item !== menu) : [...member.preferences.recent, menu];
    rememberCurrentConditions();
    render();
  }));
  document.querySelectorAll('[data-action="save-member-preferences"]').forEach(button => button.addEventListener('click', async () => {
    member.preferences.completed = true;
    // Keep the current user's saved conditions available while a room is
    // syncing. The normal source remains teamRoom.members; this is only a
    // fallback for a refresh or a local preview with no room response yet.
    state.teamPreferences.memberMenuPreferences = { ...member.preferences };
    save();
    await publishTeamRoom(state).catch(() => {});
    go('team-lobby');
  }));
}
