import { getTeamRecommendations, isPriceWithinBudget } from '../../shared/data.js';
import { icon, shell } from '../../shared/ui.js';
import { addDrivingTimes, drivingSummary, filterByDrivingTime } from '../../shared/routing.js';
import { addNaverPriceHints } from '../../shared/pricing.js';
import { addNaverRestaurantImages, searchNaverImage } from '../../shared/images.js';
import { publishTeamRoom, startTeamRoomSync } from '../../shared/team-sync.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

async function loadMenuImages(meals) {
  await Promise.all((meals || []).map(async meal => {
    const query = `${meal.name} 음식 사진`;
    const image = await searchNaverImage(query);
    const imageElements = document.querySelectorAll(`[data-menu-image="${meal.id}"]`);
    imageElements.forEach(imageElement => {
      if (image?.link) imageElement.style.backgroundImage = `url("${image.link}")`;
    });
  }));
}

function locationSearchTerm(location) {
  const normalized = String(location ?? '').replace(/\s*주변$/, '').trim();
  if (!normalized || normalized === '현재 위치') return '';
  return normalized.split(/\s+/).slice(0, 3).join(' ');
}

function searchQueryFor(meal, state) {
  const location = locationSearchTerm(state.teamPreferences.location);
  return [location, meal.name, '맛집'].filter(Boolean).join(' ');
}

function restaurantVoteKey(meal, name, address) {
  return `${meal.id}:${name}|${address}`;
}

function currentMember(state) {
  return (state.teamRoom.members || []).find(member => member.name === state.teamRoom.currentUserName) || state.teamRoom.members?.[0];
}

function restaurantVoteCount(state, voteKey) {
  return (state.teamRoom.members || []).filter(member => member.preferences?.restaurantVotes?.includes(voteKey)).length;
}

function hasRestaurantVote(state, voteKey) {
  return Boolean(currentMember(state)?.preferences?.restaurantVotes?.includes(voteKey));
}

function restaurantPanel(meal, state) {
  const query = searchQueryFor(meal, state);
  return `<section class="restaurant-panel team-restaurant-panel"><div class="panel-heading"><div class="selected-menu-heading"><div class="selected-menu-photo" data-menu-image="${meal.id}" style="background-image:url('${escapeHtml(meal.image)}')"></div><div><span class="eyebrow">결정된 메뉴</span><h2>${escapeHtml(meal.name)}</h2></div></div><button class="text-button" data-action="close-team-restaurant">닫기</button></div><p class="panel-copy">결정된 메뉴를 판매하는 주변 식당 3곳을 추천해요. 지도에서 위치와 실제 메뉴를 확인하면 됩니다.</p><div class="restaurant-list" data-team-naver-restaurants data-team-naver-query="${escapeHtml(query)}"><p class="muted">식당 검색 중...</p></div><p class="panel-copy price-source-note">메뉴 단계에서는 식당별 가격을 표시하지 않아요. 예산은 선택된 식당의 실제 메뉴 가격 확인 단계에 적용됩니다.</p></section>`;
}

function renderRestaurants(container, restaurants, maxMinutes, notice = '', state, meal) {
  if (!restaurants.length) {
    container.innerHTML = `<p class="muted">차량 ${maxMinutes}분 이내에서 메뉴 가격을 확인할 수 있는 식당을 찾지 못했어요.</p>`;
    return;
  }

  const counts = restaurants.map(restaurant => restaurantVoteCount(state, restaurantVoteKey(meal, restaurant.name, restaurant.address)));
  const highestVote = Math.max(...counts, 0);
  const tiedCount = counts.filter(count => count === highestVote && count > 0).length;
  const tieNotice = tiedCount > 1 ? '현재 동점입니다. 여러 식당을 선택할 수 있어요.' : '';
  const noticeMarkup = [notice, tieNotice].filter(Boolean).map(item => `<p class="muted restaurant-notice">${item}</p>`).join('');
  container.innerHTML = `${noticeMarkup}${restaurants.map(restaurant => {
    const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`;
    const priceSource = restaurant.sourceUrl ? `<a class="source-link" href="${escapeHtml(restaurant.sourceUrl)}" target="_blank" rel="noreferrer">가격 출처</a>` : '';
    const photo = restaurant.imageUrl ? `<img class="restaurant-photo" src="${escapeHtml(restaurant.imageUrl)}" alt="${escapeHtml(restaurant.name)} 음식 사진" loading="lazy" />` : '';
    const priceText = Number.isFinite(restaurant.price)
      ? `확인된 메뉴 가격 약 ${restaurant.price.toLocaleString('ko-KR')}원`
      : '메뉴 가격은 식당 메뉴에서 확인해주세요';
    const voteKey = restaurantVoteKey(meal, restaurant.name, restaurant.address);
    const voteCount = restaurantVoteCount(state, voteKey);
    const selected = hasRestaurantVote(state, voteKey);
    return `<article class="restaurant-card">${photo}<div><h3>${escapeHtml(restaurant.name)}</h3><p class="muted">${escapeHtml(restaurant.category || '음식점')} · ${escapeHtml(restaurant.address)}</p><p class="restaurant-price ${Number.isFinite(restaurant.price) ? '' : 'price-unknown'}">${priceText}</p><p class="muted">${drivingSummary(restaurant)} ${priceSource}</p></div><a href="${mapUrl}" target="_blank" rel="noreferrer">지도</a></article>`;
  }).join('')}`;
}

async function loadTeamRestaurants(state) {
  const container = document.querySelector('[data-team-naver-restaurants]');
  if (!container) return;

  try {
    const query = container.dataset.teamNaverQuery;
    const response = await fetch(`/api/naver-local-search?q=${encodeURIComponent(query)}&display=5`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '네이버 검색에 실패했습니다.');
    const withDrivingTimes = await addDrivingTimes(data.restaurants || [], state.teamPreferences.coordinates);
    const withinDistance = filterByDrivingTime(withDrivingTimes, state.teamPreferences.distance)
      .sort((left, right) => (left.drivingMinutes ?? Number.POSITIVE_INFINITY) - (right.drivingMinutes ?? Number.POSITIVE_INFINITY))
      .slice(0, 3);
    const withPriceHints = await addNaverPriceHints(withinDistance, state.teamSelectedMeal?.name || '', state.teamSelectedMeal?.price);
    const budget = state.teamPreferences.budget;
    const confirmedBudgetRestaurants = budget
      ? withPriceHints.filter(restaurant => Number.isFinite(restaurant.price) && isPriceWithinBudget(restaurant.price, budget))
      : withPriceHints;
    const priceUnknownRestaurants = budget
      ? withPriceHints.filter(restaurant => !Number.isFinite(restaurant.price))
      : [];
    const filteredRestaurants = budget && confirmedBudgetRestaurants.length
      ? [...confirmedBudgetRestaurants, ...priceUnknownRestaurants]
      : withPriceHints;
    const priceNotice = budget && !confirmedBudgetRestaurants.length && priceUnknownRestaurants.length
      ? '주변 식당은 찾았지만 온라인에 메뉴 가격이 공개되지 않아 숨기지 않고 보여드려요. 가격은 네이버 지도 메뉴에서 확인해주세요.'
      : budget && confirmedBudgetRestaurants.length && priceUnknownRestaurants.length
        ? '예산에 맞는 가격이 확인된 식당을 먼저 보여드리고, 가격 확인이 필요한 식당도 함께 표시했어요.'
        : '';
    const restaurantsWithImages = await addNaverRestaurantImages(filteredRestaurants, state.teamSelectedMeal?.name, state.teamPreferences.location);
    renderRestaurants(container, restaurantsWithImages, state.teamPreferences.distance, priceNotice, state, state.teamSelectedMeal);
  } catch (error) {
    container.innerHTML = `<p class="muted">네이버 검색을 불러오지 못했어요. ${escapeHtml(error.message)}</p>`;
  }
}

export function renderTeamRecommendations(state) {
  const recommendedMeals = getTeamRecommendations(state.teamPreferences, state.teamRoom.members);
  const hasConfirmedTeamMeal = Boolean(state.teamMenuConfirmed && state.teamSelectedMeal);
  const totalMembers = state.teamRoom.members.length || 1;
  const respondedMembers = state.teamRoom.members.filter(member => member.preferences?.completed).length;
  const mealResults = recommendedMeals.length
    ? recommendedMeals.map(meal => `<article class="meal-card" data-team-meal="${meal.id}"><div class="meal-image" data-menu-image="${meal.id}" style="background-image:url('${meal.image}')"></div><div class="meal-info"><div class="meal-heading"><h2>${meal.name}</h2><span class="match">매칭 ${meal.match}%</span></div><ul>${meal.reasons.map(reason => `<li>${reason}</li>`).join('')}<li class="muted">${icon('location')} ${meal.minutes}분 거리</li></ul></div></article>`).join('')
    : '<div class="empty-state"><h2>추천할 메뉴가 없어요</h2><p>조건을 조금 넓혀서 다시 설정해 주세요.</p></div>';
  const decidedMealNotice = hasConfirmedTeamMeal
    ? `<div class="result-banner">메뉴 투표 결과: <b>${escapeHtml(state.teamSelectedMeal.name)}</b></div>`
    : '<p class="section-help vote-step-help">아직 메뉴를 결정하지 않았어요. 아래 메뉴를 확인한 뒤 메뉴 투표를 진행해 주세요.</p>';
  const selectedMealContent = hasConfirmedTeamMeal
    ? `${decidedMealNotice}${restaurantPanel(state.teamSelectedMeal, state)}`
    : `${decidedMealNotice}<p class="intro">응답 ${respondedMembers}/${totalMembers}명의 조건을 반영한 메뉴예요! ✨</p><p class="section-help">메뉴 가격은 식당마다 달라서 지금 표시하지 않아요. 먼저 메뉴를 투표하고, 결정된 메뉴를 판매하는 식당을 추천해요.</p><div class="meal-list">${mealResults}</div>`;
  const actionLabel = hasConfirmedTeamMeal ? '다른 메뉴 다시 투표하기' : '메뉴 투표 시작하기';
  return shell(`
    <section class="page-content recommendation-content team-recommendation-content"><div class="team-progress"><span>1</span><i></i><span>2</span><i></i><span class="active">3</span></div>${selectedMealContent}<div class="recommendation-actions"><button class="primary-button" data-action="team-vote">${actionLabel}</button><button class="text-button" data-action="team-preferences">조건 다시 설정하기</button></div></section>
  `, '팀 추천 메뉴');
}

export function bindTeamRecommendationsEvents({ state, save, go, render }) {
  publishTeamRoom(state).catch(() => {});
  startTeamRoomSync(state, save, render);
  document.querySelectorAll('[data-action="back"], [data-action="team-preferences"]').forEach(button => button.addEventListener('click', () => go('team-preferences')));
  document.querySelectorAll('[data-action="team-vote"]').forEach(button => button.addEventListener('click', () => {
    state.teamRoom.menuRoundStarted = true;
    state.teamRoom.teamVotes = { ...state.teamVotes };
    state.rouletteResult = null;
    state.teamSelectedMeal = null;
    state.teamMenuConfirmed = false;
    save();
    publishTeamRoom(state).catch(() => {});
    go('team-vote');
  }));
  document.querySelectorAll('[data-action="close-team-restaurant"]').forEach(button => button.addEventListener('click', () => {
    state.teamSelectedMeal = null;
    save();
    render();
  }));
  const restaurantContainer = document.querySelector('[data-team-naver-restaurants]');
  restaurantContainer?.addEventListener('click', async event => {
    const button = event.target.closest('[data-team-restaurant-vote]');
    if (!button || !state.teamSelectedMeal) return;
    const member = currentMember(state);
    if (!member) return;
    member.preferences = { ...(member.preferences || {}), restaurantVotes: [...(member.preferences?.restaurantVotes || [])] };
    const voteKey = restaurantVoteKey(state.teamSelectedMeal, button.dataset.restaurantName, button.dataset.restaurantAddress);
    member.preferences.restaurantVotes = member.preferences.restaurantVotes.includes(voteKey)
      ? member.preferences.restaurantVotes.filter(item => item !== voteKey)
      : [...member.preferences.restaurantVotes, voteKey];
    save();
    updateRestaurantVoteButtons(restaurantContainer, state, state.teamSelectedMeal);
    await publishTeamRoom(state).catch(() => {});
  });
  loadMenuImages(getTeamRecommendations(state.teamPreferences, state.teamRoom.members));
  loadTeamRestaurants(state);
}

function updateRestaurantVoteButtons(container, state, meal) {
  container.querySelectorAll('[data-team-restaurant-vote]').forEach(button => {
    const voteKey = restaurantVoteKey(meal, button.dataset.restaurantName, button.dataset.restaurantAddress);
    const selected = hasRestaurantVote(state, voteKey);
    const voteCount = restaurantVoteCount(state, voteKey);
    button.classList.toggle('selected', selected);
    button.textContent = `${selected ? '투표 취소' : '식당 투표'}${voteCount ? ` · ${voteCount}표` : ''}`;
  });
}
