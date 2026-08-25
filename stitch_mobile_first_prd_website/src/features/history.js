import { meals } from '../shared/data.js';
import { icon, shell } from '../shared/ui.js';

const formatDate = value => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value));

export function renderHistory(state) {
  const records = [...(state.records || [])].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const content = records.length
    ? records.map(record => `<article class="history-card"><div><span class="eyebrow">${formatDate(record.createdAt)}</span><h2>${record.mealName}</h2><p class="muted">${record.status === 'eaten' ? '먹었어요' : '먹기로 한 메뉴'}</p></div><div class="history-actions">${record.status !== 'eaten' ? `<button class="small-button" data-history-eaten="${record.id}">먹었어요</button>` : ''}<button class="small-button secondary-small" data-history-repeat="${record.mealId}">다시 추천</button></div></article>`).join('')
    : '<div class="empty-state"><h2>아직 식사 기록이 없어요</h2><p>추천 메뉴를 선택하면 여기에 자동으로 저장돼요.</p></div>';
  return shell(`<section class="page-content history-content"><p class="intro">내가 먹은 점심을 모아봤어요</p><div class="history-list">${content}</div></section>`, '내 식사 기록');
}

export function bindHistoryEvents({ state, save, go, render }) {
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('home')));
  document.querySelectorAll('[data-history-eaten]').forEach(button => button.addEventListener('click', () => {
    const record = state.records.find(item => item.id === button.dataset.historyEaten);
    if (!record) return;
    record.status = 'eaten';
    record.eatenAt = new Date().toISOString();
    save();
    render();
  }));
  document.querySelectorAll('[data-history-repeat]').forEach(button => button.addEventListener('click', () => {
    state.recent = (state.recent || []).filter(item => item !== meals.find(meal => meal.id === button.dataset.historyRepeat)?.name);
    state.allowRecentlyEaten = true;
    save();
    go('preferences');
  }));
}
