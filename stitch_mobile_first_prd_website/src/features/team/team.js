import { getTeamRecommendations, meals } from '../../shared/data.js';
import { icon, shell } from '../../shared/ui.js';
import { searchNaverImage } from '../../shared/images.js';
import { saveMealHistory } from '../../shared/supabase.js';
import { publishTeamRoom, startTeamRoomSync } from '../../shared/team-sync.js';

async function loadVoteImages(voteMeals) {
  await Promise.all((voteMeals || []).map(async meal => {
    const image = await searchNaverImage(`${meal.name} 음식 사진`);
    const imageElement = document.querySelector(`[data-vote-image="${meal.id}"]`);
    if (image?.link && imageElement) imageElement.style.backgroundImage = `url("${image.link}")`;
  }));
}

function voteSummary(state, voteMeals) {
  return voteMeals.reduce((summary, meal) => {
    summary[meal.id] = Number(state.teamVotes?.[meal.id] || 0);
    return summary;
  }, {});
}

function winningMealIds(votes) {
  const highest = Math.max(...Object.values(votes), 0);
  if (highest <= 0) return [];
  return Object.entries(votes).filter(([, count]) => count === highest).map(([id]) => id);
}

export function renderTeam(state) {
  const voteMeals = getTeamRecommendations(state.teamPreferences, state.teamRoom.members);
  const votes = voteSummary(state, voteMeals);
  const winners = winningMealIds(votes);
  const members = state.teamRoom.members || [];
  const voters = state.teamRoom.teamVoters || {};
  const allMembersVoted = members.length > 0 && members.every(member => Boolean(voters[member.id || member.name]));
  const decidedId = state.rouletteResult || (allMembersVoted && winners.length === 1 ? winners[0] : null);
  const decidedMeal = meals.find(meal => meal.id === decidedId);
  const result = decidedMeal ? `<div class="result-banner">결정된 메뉴는 <b>${decidedMeal.name}</b>이에요!</div>` : '';
  const tie = !decidedMeal && winners.length > 1;
  const action = decidedMeal
    ? '<button class="primary-button" data-action="show-restaurants">결정된 메뉴 식당 찾기</button>'
    : tie
      ? '<button class="primary-button" data-action="spin">동점 메뉴 룰렛 돌리기</button>'
      : '<p class="section-help">팀원들이 메뉴를 선택하면 최다 득표 메뉴를 결정해요.</p>';
  const voteCards = voteMeals.map(meal => {
    const count = Number(votes[meal.id] || 0);
    return `<button class="vote-card ${state.myVotes.includes(meal.id) ? 'voted' : ''}" data-vote="${meal.id}"><div class="vote-image" data-vote-image="${meal.id}" style="${meal.image ? `background-image:url('${meal.image}')` : ''}"></div><div class="vote-main"><div class="vote-heading"><h2>${meal.name}</h2><span>${count}표</span></div><div class="progress"><i style="width:${Math.min(count * 16.66, 100)}%"></i></div></div>${state.myVotes.includes(meal.id) ? `<em>${icon('check')}</em>` : ''}</button>`;
  }).join('');
  return shell(`
    <section class="page-content team-content"><div class="team-progress"><span>1</span><i></i><span>2</span><i></i><span class="active">3</span></div>${result}${tie ? '<div class="tie-alert">ⓘ　동점입니다. 룰렛으로 메뉴를 결정해 주세요.</div>' : ''}<div class="vote-list">${voteCards}</div>${action}${tie ? '<div class="team-roulette"><div class="wheel" data-team-wheel><div class="wheel-dot dot-one"></div><div class="wheel-dot dot-two"></div><div class="wheel-dot dot-three"></div><span class="wheel-label">동점<br />룰렛</span></div><p>버튼을 누르면 동점 메뉴 중 하나를 정해요.</p></div>' : ''}</section>
  `, '우리팀 점심 투표');
}

export function bindTeamEvents({ state, save, go, render }) {
  let spinning = false;
  startTeamRoomSync(state, save, render);
  const voteMeals = getTeamRecommendations(state.teamPreferences, state.teamRoom.members);
  loadVoteImages(voteMeals);
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('team-recommendations')));
  document.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.vote;
    const hasVote = state.myVotes.includes(id);
    state.myVotes = hasVote ? state.myVotes.filter(item => item !== id) : [...state.myVotes, id];
    state.teamVotes[id] = Number(state.teamVotes[id] || 0) + (hasVote ? -1 : 1);
    state.teamRoom.menuRoundStarted = true;
    state.teamRoom.teamVotes = { ...state.teamVotes };
    const currentMember = (state.teamRoom.members || []).find(member => member.name === state.teamRoom.currentUserName);
    const voterKey = currentMember?.id || state.teamRoom.currentUserName;
    state.teamRoom.teamVoters = { ...(state.teamRoom.teamVoters || {}), [voterKey]: state.myVotes.length > 0 };
    state.rouletteResult = null;
    save();
    publishTeamRoom(state).catch(() => {});
    render();
  }));
  document.querySelectorAll('[data-action="spin"]').forEach(button => button.addEventListener('click', () => {
    if (spinning) return;
    const voteMeals = getTeamRecommendations(state.teamPreferences, state.teamRoom.members);
    const candidates = winningMealIds(voteSummary(state, voteMeals));
    if (candidates.length < 2) return;
    spinning = true;
    button.disabled = true;
    button.textContent = '룰렛이 돌아가는 중...';
    document.querySelector('[data-team-wheel]')?.classList.add('spun');
    window.setTimeout(() => {
      state.rouletteResult = candidates[Math.floor(Math.random() * candidates.length)];
      state.teamSelectedMeal = meals.find(meal => meal.id === state.rouletteResult) || null;
      state.teamMenuConfirmed = true;
      save();
      publishTeamRoom(state).catch(() => {});
      saveMealHistory({ meal: state.teamSelectedMeal, source: 'team', status: 'planned' }).catch(() => {});
      go('team-recommendations');
    }, 2700);
  }));
  document.querySelectorAll('[data-action="show-restaurants"]').forEach(button => button.addEventListener('click', () => {
    const voteMeals = getTeamRecommendations(state.teamPreferences, state.teamRoom.members);
    const winnerId = state.rouletteResult || winningMealIds(voteSummary(state, voteMeals))[0];
    state.teamSelectedMeal = meals.find(meal => meal.id === winnerId) || null;
    state.teamMenuConfirmed = Boolean(state.teamSelectedMeal);
    save();
    saveMealHistory({ meal: state.teamSelectedMeal, source: 'team', status: 'planned' }).catch(() => {});
    go('team-recommendations');
  }));
}
