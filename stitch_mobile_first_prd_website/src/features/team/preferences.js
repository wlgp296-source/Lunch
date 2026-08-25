import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { budgets } from '../../shared/data.js';
import { icon, shell } from '../../shared/ui.js';
import { publishTeamRoom } from '../../shared/team-sync.js';

const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const DEFAULT_MAP_CENTER = [37.4979, 127.0276];
const DRIVING_METERS_PER_MINUTE = 500;
const DISTANCE_OPTIONS = [5, 10, 15, 20, 30];
let activeMap = null;

async function reverseGeocode(coordinates) {
  const query = new URLSearchParams({
    lat: String(coordinates.latitude),
    lng: String(coordinates.longitude),
  });
  const response = await fetch(`/api/reverse-geocode?${query}`);
  const data = await response.json();
  if (!response.ok || !data.address) throw new Error(data.error || '주소를 확인할 수 없습니다.');
  return data.address;
}

async function geocodeAddress(address) {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
  const data = await response.json();
  if (!response.ok || !data.coordinates) throw new Error(data.error || '주소 위치를 찾을 수 없습니다.');
  return data;
}

function initializeTeamMap(preferences) {
  const mapElement = document.querySelector('#team-map');
  if (!mapElement) return { updateRadius: () => {} };

  activeMap?.remove();
  const hasCoordinates = Boolean(preferences.coordinates?.latitude && preferences.coordinates?.longitude);
  const center = hasCoordinates
    ? [preferences.coordinates.latitude, preferences.coordinates.longitude]
    : DEFAULT_MAP_CENTER;
  const map = L.map(mapElement, { zoomControl: true }).setView(center, hasCoordinates ? 16 : 14);
  activeMap = map;

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);

  if (hasCoordinates) {
    L.circleMarker(center, {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#154212',
      fillOpacity: 1,
    }).addTo(map).bindPopup('현재 위치');
  }

  const radius = L.circle(center, {
    radius: preferences.distance * DRIVING_METERS_PER_MINUTE,
    color: '#154212',
    weight: 1.5,
    fillColor: '#bcf0ae',
    fillOpacity: 0.24,
  }).addTo(map);

  // Leaflet can initialize before the mobile layout has settled. Recalculate
  // the map size after the page is painted so tiles do not appear as a blank
  // color block and the map does not jump when the address is resolved.
  window.setTimeout(() => map.invalidateSize(), 0);
  window.setTimeout(() => map.invalidateSize(), 250);

  return {
    updateRadius: minutes => radius.setRadius(minutes * DRIVING_METERS_PER_MINUTE),
  };
}

export function renderTeamPreferences(state) {
  const preferences = state.teamPreferences;
  const selectedDistanceIndex = Math.max(0, DISTANCE_OPTIONS.indexOf(Number(preferences.distance)));
  const hasCurrentLocation = Boolean(preferences.coordinates?.latitude && preferences.coordinates?.longitude);
  const hasResolvedAddress = hasCurrentLocation && preferences.location && !['강남역 주변', '현재 위치'].includes(preferences.location);
  const isResolvingCurrentAddress = hasCurrentLocation && !hasResolvedAddress;
  const locationLabel = hasResolvedAddress ? preferences.location : (hasCurrentLocation ? '현재 위치' : preferences.location);
  return shell(`
    <section class="page-content preference-content team-preferences-content">
      <div class="team-progress"><span class="active">1</span><i></i><span>2</span><i></i><span>3</span></div>
      <p class="team-step-copy">메뉴 취향은 팀원 각자의 조건을 자동으로 합쳐요. 대표자는 예산과 위치만 정해주세요.</p>
      <div class="section-block"><h2>예산</h2><div class="horizontal-list">${budgets.map(budget => `<button class="chip ${preferences.budget === budget ? 'selected' : ''}" data-team-budget="${budget}">${budget}</button>`).join('')}</div></div>
      <div class="section-block"><h2>위치와 거리</h2><div class="location-actions"><label class="location-field"><span>${icon('location')}</span><input id="team-location" value="${escapeAttribute(locationLabel)}" aria-label="팀 위치" /><small id="team-location-status">${hasResolvedAddress ? '현재 위치를 사용하고 있어요.' : isResolvingCurrentAddress ? '현재 위치 주소를 확인하고 있어요...' : '현재 위치를 자동으로 가져오거나 직접 입력하세요.'}</small></label><button class="location-button" type="button" data-action="current-location">${icon('location')} 현재 위치 자동으로 가져오기</button></div><div id="team-map" class="team-map" aria-label="현재 위치와 차량 이동시간 예상 범위 지도"></div><p class="map-help">차량 이동시간 기준으로 식당을 필터링해요. 지도 원은 예상 범위이며 교통 상황은 반영되지 않아요.</p><div class="range-wrap"><input id="team-distance" type="range" min="0" max="4" step="1" value="${selectedDistanceIndex}" /> <div class="range-labels">${DISTANCE_OPTIONS.map(minutes => `<span data-distance-label="${minutes}" class="${Number(preferences.distance) === minutes ? 'selected' : ''}">차량 ${minutes}분</span>`).join('')}</div></div></div>
    </section>
    <div class="bottom-cta"><button class="primary-button" data-action="team-recommend">팀 메뉴 추천받기</button></div>
  `, '예산과 위치 설정');
}

export function bindTeamPreferencesEvents({ state, save, go, render }) {
  const currentMember = (state.teamRoom.members || []).find(member => member.name === state.teamRoom.currentUserName);
  const isHost = currentMember?.role === '대표' || state.teamRoom.currentUserName === state.teamRoom.hostName;
  if (state.teamRoom.currentUserName && !isHost) {
    go('team-lobby');
    return;
  }
  // Opening the representative settings starts a new recommendation round.
  // Clear any previous winner here as well as on the submit action, so a
  // browser refresh or an old synced room cannot skip the voting screen.
  state.teamVotes = {};
  state.myVotes = [];
  state.rouletteResult = null;
  state.teamSelectedMeal = null;
  state.teamMenuConfirmed = false;
  state.teamRoom.menuRoundStarted = false;
  state.teamRoom.teamVotes = {};
  save();
  const hasCurrentLocation = Boolean(state.teamPreferences.coordinates?.latitude && state.teamPreferences.coordinates?.longitude);
  if (hasCurrentLocation && (!state.teamPreferences.location || state.teamPreferences.location === '강남역 주변')) {
    state.teamPreferences.location = '현재 위치';
    save();
  }
  const resolveCurrentLocationAddress = () => {
    const coordinates = state.teamPreferences.coordinates;
    const currentLocationLabel = state.teamPreferences.location;
    if (!coordinates || !['', '강남역 주변', '현재 위치'].includes(currentLocationLabel)) return;

    const status = document.querySelector('#team-location-status');
    if (status) status.textContent = '현재 위치 주소를 확인하고 있어요...';
    reverseGeocode(coordinates).then(address => {
      state.teamPreferences.location = address;
      save();
      const input = document.querySelector('#team-location');
      const status = document.querySelector('#team-location-status');
      if (input) input.value = address;
      if (status) status.textContent = '현재 위치를 사용하고 있어요.';
    }).catch(() => {
      if (status) status.textContent = '현재 위치는 확인했지만 주소 이름을 가져오지 못했어요.';
    });
  };
  const teamMap = initializeTeamMap(state.teamPreferences);
  if (hasCurrentLocation) resolveCurrentLocationAddress();
  document.querySelectorAll('[data-action="back"]').forEach(button => button.addEventListener('click', () => go('team-lobby')));
  document.querySelectorAll('[data-action="team-recommend"]').forEach(button => button.addEventListener('click', async () => {
    // Starting a new recommendation round must never reopen the previous
    // winner/restaurant screen. The next screen should always show candidates
    // first, then let the team start a fresh menu vote.
    state.teamVotes = {};
    state.myVotes = [];
    state.rouletteResult = null;
    state.teamSelectedMeal = null;
    state.teamMenuConfirmed = false;
    state.teamRoom.menuRoundStarted = true;
    state.teamRoom.teamVotes = {};
    save();
    await publishTeamRoom(state).catch(() => {});
    go('team-recommendations');
  }));
  document.querySelectorAll('[data-team-budget]').forEach(button => button.addEventListener('click', () => {
    state.teamPreferences.budget = button.dataset.teamBudget;
    state.teamSelectedMeal = null;
    save();
    render();
  }));
  const distance = document.querySelector('#team-distance');
  if (distance) distance.addEventListener('input', event => {
    state.teamPreferences.distance = DISTANCE_OPTIONS[Number(event.target.value)] ?? 10;
    document.querySelectorAll('[data-distance-label]').forEach(label => {
      label.classList.toggle('selected', Number(label.dataset.distanceLabel) === state.teamPreferences.distance);
    });
    teamMap.updateRadius(state.teamPreferences.distance);
    save();
  });
  const location = document.querySelector('#team-location');
  if (location) location.addEventListener('change', event => {
    const address = event.target.value.trim() || '강남역 주변';
    state.teamPreferences.location = address;
    state.teamPreferences.coordinates = null;
    save();
    const status = document.querySelector('#team-location-status');
    if (status) status.textContent = '주소 위치를 확인하고 있어요...';
    geocodeAddress(address).then(result => {
      state.teamPreferences.location = result.address || address;
      state.teamPreferences.coordinates = result.coordinates;
      save();
      render();
    }).catch(() => {
      if (status) status.textContent = '주소는 저장했지만 지도 위치를 찾지 못했어요.';
    });
  });
  if (state.teamPreferences.location && state.teamPreferences.location !== '강남역 주변' && !state.teamPreferences.coordinates) {
    const status = document.querySelector('#team-location-status');
    if (status) status.textContent = '주소 위치를 확인하고 있어요...';
    geocodeAddress(state.teamPreferences.location).then(result => {
      state.teamPreferences.location = result.address || state.teamPreferences.location;
      state.teamPreferences.coordinates = result.coordinates;
      save();
      render();
    }).catch(() => {
      if (status) status.textContent = '주소는 저장했지만 지도 위치를 찾지 못했어요.';
    });
  }
  const requestCurrentLocation = () => {
    const status = document.querySelector('#team-location-status');
    if (!navigator.geolocation) {
      if (status) status.textContent = '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
      return;
    }
    if (status) status.textContent = '현재 위치를 확인하고 있어요...';
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      state.teamPreferences.coordinates = {
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
      };
      state.teamPreferences.location = '현재 위치';
      save();
      render();
    }, error => {
      if (!status) return;
      status.textContent = error.code === 1
        ? '위치 권한을 허용하면 현재 위치를 사용할 수 있어요.'
        : '현재 위치를 확인하지 못했어요. 직접 입력해 주세요.';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };
  document.querySelectorAll('[data-action="current-location"]').forEach(button => button.addEventListener('click', requestCurrentLocation));
  if (!hasCurrentLocation && state.teamPreferences.location === '강남역 주변') requestCurrentLocation();
}
