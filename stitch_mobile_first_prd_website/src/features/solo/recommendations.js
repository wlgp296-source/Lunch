import { getSoloRecommendations, meals } from '../../shared/data.js';
import { icon, shell } from '../../shared/ui.js';
import { addDrivingTimes, drivingSummary, filterByDrivingTime } from '../../shared/routing.js';
import { saveMealHistory } from '../../shared/supabase.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function mealCard(meal) {
  return `<button class="meal-card" data-meal="${meal.id}"><div class="meal-image" style="background-image:url('${meal.image}')"></div><div class="meal-info"><div class="meal-heading"><h2>${meal.name}</h2><span class="match">매칭 ${meal.match}%</span></div><ul>${meal.reasons.map(reason => `<li>${reason}</li>`).join('')}<li class="muted">${icon('location')} ${meal.minutes}분 거리</li></ul></div></button>`;
}

function locationSearchTerm(location) {
  const normalized = String(location ?? '').replace(/\s*주변$/, '').trim();
  if (!normalized || normalized === '현재 위치') return '';
  return normalized.split(/\s+/).slice(0, 3).join(' ');
}

function searchQueryFor(meal, state) {
  const location = locationSearchTerm(state.location);
  return [location, meal.name, '맛집'].filter(Boolean).join(' ');
}

function fallbackRestaurantCards(meal) {
  return meal.restaurants.map(restaurant => `<article class="restaurant-card"><div><h3>${escapeHtml(restaurant.name)}</h3><p>${escapeHtml(restaurant.menu)}</p><p class="muted">${escapeHtml(restaurant.distance)} · 평점 ${escapeHtml(restaurant.rating)} · ${escapeHtml(restaurant.address)}</p></div><a href="https://map.naver.com/p/search/${encodeURIComponent(restaurant.address + ' ' + restaurant.name)}" target="_blank" rel="noreferrer">지도</a></article>`).join('');
}

function restaurantPanel(meal, state) {
  const query = searchQueryFor(meal, state);
  return `<section class="restaurant-panel"><div class="panel-heading"><div><span class="eyebrow">선택한 메뉴</span><h2>${escapeHtml(meal.name)}</h2></div><button class="text-button" data-action="close-restaurant">닫기</button></div><p class="panel-copy">네이버에서 주변 식당을 찾고 있어요.</p><div class="restaurant-list" data-naver-restaurants data-naver-query="${escapeHtml(query)}"><p class="muted">검색 중...</p></div><p class="panel-copy price-source-note">메뉴 가격은 현재 네이버 지역 검색 결과에 포함되지 않아 기존 예시 가격을 함께 보여드립니다.</p><div class="restaurant-list restaurant-fallback-list">${fallbackRestaurantCards(meal)}</div></section>`;
}

function renderNaverRestaurants(container, restaurants, maxMinutes) {
  if (!restaurants.length) {
    container.innerHTML = `<p class="muted">차량 ${maxMinutes}분 이내의 식당을 찾지 못했어요.</p>`;
    return;
  }

  container.innerHTML = restaurants.map(restaurant => {
    const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`;
    return `<article class="restaurant-card"><div><h3>${escapeHtml(restaurant.name)}</h3><p class="muted">${escapeHtml(restaurant.category || '음식점')} · ${escapeHtml(restaurant.address)}</p><p class="muted">${drivingSummary(restaurant)} · 가격 정보는 식당 메뉴에서 확인이 필요해요.</p></div><a href="${mapUrl}" target="_blank" rel="noreferrer">지도</a></article>`;
  }).join('');
}

async function loadNaverRestaurants(state) {
  const container = document.querySelector('[data-naver-restaurants]');
  if (!container) return;

  const query = container.dataset.naverQuery;
  try {
    const response = await fetch(`/api/naver-local-search?q=${encodeURIComponent(query)}&display=5`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '네이버 검색에 실패했습니다.');
    const withDrivingTimes = await addDrivingTimes(data.restaurants || [], state.coordinates);
    const filteredRestaurants = filterByDrivingTime(withDrivingTimes, state.distance);
    renderNaverRestaurants(container, filteredRestaurants, state.distance);
  } catch (error) {
    container.innerHTML = `<p class="muted">네이버 검색을 불러오지 못했어요. ${escapeHtml(error.message)}</p>`;
  }
}

export function renderRecommendations(state) {
  const list = state.recommendations?.length ? state.recommendations : getSoloRecommendations(state);
  return shell(`
    <section class="page-content recommendation-content"><p class="intro">취향과 조건에 맞춘 추천이에요! ✨</p><div class="meal-list">${list.map(mealCard).join('')}</div><div class="recommendation-actions"><button class="outline-button" data-action="refresh">${icon('refresh')} 다시 추천하기</button><button class="text-button" data-action="preferences">${icon('filter')} 필터 다시 설정하기</button></div>${state.selectedMeal ? restaurantPanel(state.selectedMeal, state) : ''}</section>
  `, '추천 메뉴 3개');
}

export function bindRecommendationsEvents({ state, save, go, render }) {
  document.querySelectorAll('[data-action="back"], [data-action="preferences"]').forEach(button => button.addEventListener('click', () => go('preferences')));
  document.querySelectorAll('[data-action="refresh"]').forEach(button => button.addEventListener('click', () => {
    state.recommendations = getSoloRecommendations({ ...state, refreshSeed: Date.now() }).sort(() => Math.random() - 0.5);
    state.selectedMeal = null;
    save();
    render();
  }));
  document.querySelectorAll('[data-action="close-restaurant"]').forEach(button => button.addEventListener('click', () => {
    state.selectedMeal = null;
    render();
  }));
  document.querySelectorAll('[data-meal]').forEach(button => button.addEventListener('click', () => {
    state.selectedMeal = meals.find(meal => meal.id === button.dataset.meal);
    const recordId = `${state.selectedMeal.id}-${new Date().toISOString().slice(0, 10)}`;
    if (!state.records.some(record => record.id === recordId)) state.records.unshift({ id: recordId, mealId: state.selectedMeal.id, mealName: state.selectedMeal.name, createdAt: new Date().toISOString(), status: 'planned' });
    save();
    saveMealHistory({ meal: state.selectedMeal, source: 'solo', status: 'planned' }).catch(() => {});
    render();
  }));
  loadNaverRestaurants(state);
}
