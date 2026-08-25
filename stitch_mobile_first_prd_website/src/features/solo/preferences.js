import { budgets, getSoloRecommendations, meals, moods } from '../../shared/data.js';
import { icon, shell } from '../../shared/ui.js';

const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function renderPreferences(state) {
  const selectedRecent = state.recent || [];
  const recentTags = selectedRecent.map(menu => `<button class="tag selected" data-recent="${menu}">${menu}</button>`).join('');
  return shell(`
    <section class="page-content preference-content">
      <div class="section-block"><div class="mood-grid">${moods.map(([label, emoji]) => `<button class="chip mood-chip ${state.mood.includes(label) ? 'selected' : ''}" data-mood="${label}"><span>${emoji}</span>${label}</button>`).join('')}</div></div>
      <div class="section-block"><h2>최근 먹은 메뉴</h2><p class="section-help">최근 먹은 메뉴는 기본 추천에서 제외해요.</p><label class="search-field"><span>⌕</span><input id="menu-search" placeholder="메뉴 검색 후 선택" autocomplete="off" /><div id="menu-search-results" class="search-results" role="listbox"></div></label><div class="tag-list">${recentTags || '<span class="muted">선택한 메뉴가 없어요</span>'}</div><button class="repeat-toggle ${state.allowRecentlyEaten ? 'selected' : ''}" data-action="allow-recent">다시 먹고 싶어요</button></div>
      <div class="section-block"><h2>개인 제외 설정</h2><p class="section-help">알레르기나 먹기 싫은 음식을 쉼표로 구분해 입력하세요.</p><label class="large-setting"><span>알레르기</span><input id="allergies" value="${escapeAttribute((state.allergies || []).join(', '))}" placeholder="예: 땅콩, 새우" /></label><label class="large-setting"><span>먹기 싫은 음식</span><input id="dislikes" value="${escapeAttribute((state.dislikes || []).join(', '))}" placeholder="예: 오이, 고수" /></label></div>
      <div class="section-block"><h2>예산</h2><div class="horizontal-list">${budgets.map(budget => `<button class="chip ${state.budget === budget ? 'selected' : ''}" data-budget="${budget}">${budget}</button>`).join('')}</div></div>
      <div class="section-block"><h2>차량 이동 가능 시간</h2><div class="range-wrap"><span>🚗</span><input id="distance" type="range" min="5" max="20" step="5" value="${state.distance}" /><div class="range-labels"><span>차량 5분</span><b id="distance-label">차량 ${state.distance}분</b><span>차량 15분</span><span>차량 20분</span></div></div><p class="section-help">교통 상황을 제외한 차량 예상 시간으로 식당을 필터링해요.</p></div>
      <div class="section-block"><h2>위치 선택</h2><label class="location-field"><span>${icon('location')}</span><input id="location" value="${escapeAttribute(state.location)}" aria-label="위치" /><small id="location-status">${state.coordinates ? '현재 위치를 사용하고 있어요.' : '주소를 입력하거나 현재 위치를 가져오세요.'}</small></label><button class="location-button" type="button" data-action="solo-current-location">${icon('location')} 현재 위치 자동으로 가져오기</button></div>
    </section>
    <div class="bottom-cta"><button class="primary-button" data-action="recommend">추천 메뉴 3개</button></div>
  `, '오늘의 기분');
}

export function bindPreferencesEvents({ state, save, go, render }) {
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('home')));
  document.querySelectorAll('[data-action="recommend"]').forEach(button => button.addEventListener('click', () => { state.recommendations = getSoloRecommendations(state); state.selectedMeal = null; save(); go('recommendations'); }));
  document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', () => {
    const mood = button.dataset.mood;
    state.mood = state.mood.includes(mood) ? state.mood.filter(item => item !== mood) : [...state.mood, mood];
    save();
    render();
  }));
  document.querySelectorAll('[data-recent]').forEach(button => button.addEventListener('click', () => {
    const menu = button.dataset.recent;
    state.recent = state.recent.includes(menu) ? state.recent.filter(item => item !== menu) : [...state.recent, menu];
    save();
    render();
  }));
  const searchInput = document.querySelector('#menu-search');
  const searchResults = document.querySelector('#menu-search-results');
  const renderSearchResults = () => {
    if (!searchResults) return;
    const query = searchInput?.value.trim().toLowerCase() || '';
    const matches = query ? meals.filter(meal => meal.name.toLowerCase().includes(query)).slice(0, 6) : [];
    searchResults.innerHTML = matches.map(meal => `<button type="button" data-search-menu="${meal.name}">${meal.name}<small>${meal.category}</small></button>`).join('');
    searchResults.querySelectorAll('[data-search-menu]').forEach(button => button.addEventListener('click', () => {
      const menu = button.dataset.searchMenu;
      if (!state.recent.includes(menu)) state.recent = [...state.recent, menu];
      searchInput.value = '';
      save();
      render();
    }));
  };
  searchInput?.addEventListener('input', renderSearchResults);
  document.querySelectorAll('[data-action="allow-recent"]').forEach(button => button.addEventListener('click', () => {
    state.allowRecentlyEaten = !state.allowRecentlyEaten;
    save();
    render();
  }));
  ['allergies', 'dislikes'].forEach(id => document.querySelector(`#${id}`)?.addEventListener('change', event => {
    state[id] = event.target.value.split(',').map(item => item.trim()).filter(Boolean);
    save();
  }));
  document.querySelectorAll('[data-budget]').forEach(button => button.addEventListener('click', () => {
    state.budget = button.dataset.budget;
    save();
    render();
  }));
  const distance = document.querySelector('#distance');
  if (distance) distance.addEventListener('input', event => {
    state.distance = Number(event.target.value);
    const label = document.querySelector('#distance-label');
    if (label) label.textContent = `차량 ${state.distance}분`;
    save();
  });
  const location = document.querySelector('#location');
  if (location) location.addEventListener('change', event => {
    state.location = event.target.value.trim() || '강남역 주변';
    state.coordinates = null;
    save();
  });
  document.querySelectorAll('[data-action="solo-current-location"]').forEach(button => button.addEventListener('click', () => {
    const status = document.querySelector('#location-status');
    if (!navigator.geolocation) {
      if (status) status.textContent = '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
      return;
    }
    if (status) status.textContent = '현재 위치를 확인하고 있어요...';
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      state.coordinates = {
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
      };
      state.location = '현재 위치';
      save();
      render();
      const query = new URLSearchParams({ lat: String(state.coordinates.latitude), lng: String(state.coordinates.longitude) });
      fetch(`/api/reverse-geocode?${query}`)
        .then(response => response.json())
        .then(data => {
          if (!data.address) return;
          state.location = data.address;
          save();
          render();
        })
        .catch(() => {});
    }, error => {
      if (!status) return;
      status.textContent = error.code === 1
        ? '위치 권한을 허용하면 현재 위치를 사용할 수 있어요.'
        : '현재 위치를 확인하지 못했어요. 직접 입력해 주세요.';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  }));
}
