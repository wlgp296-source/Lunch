import { meals } from './data.js';

export const defaultState = {
  mood: ['든든하게'],
  recent: [],
  budget: '7천원 ~ 1만원',
  distance: 10,
  location: '강남역 주변',
  coordinates: null,
  recommendations: meals,
  selectedMeal: null,
  allergies: [],
  dislikes: [],
  allowRecentlyEaten: false,
  records: [],
  teamVotes: { bibimbap: 2, pasta: 2, malatang: 2 },
  myVotes: [],
  rouletteResult: null,
  teamSelectedMeal: null,
  teamMenuConfirmed: false,
  teamRoom: {
    roomId: '',
    inviteCode: '',
    hostName: '',
    currentUserName: '',
    members: [],
    menuRoundStarted: false,
    teamVotes: {},
  },
  teamPreferences: {
    mood: ['든든하게'],
    fullness: '상관없음',
    temperature: '상관없음',
    category: '상관없음',
    form: '상관없음',
    cravings: [],
    customCraving: '',
    recent: [],
    budget: '7천원 ~ 1만원',
    distance: 10,
    location: '강남역 주변',
    coordinates: null,
  },
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('lunch-roulette-state') || 'null');
    return saved ? {
      ...defaultState,
      ...saved,
      teamRoom: { ...defaultState.teamRoom, ...(saved.teamRoom || {}) },
      teamPreferences: { ...defaultState.teamPreferences, ...(saved.teamPreferences || {}) },
    } : { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

export const state = loadState();

export function saveState() {
  localStorage.setItem('lunch-roulette-state', JSON.stringify(state));
}
