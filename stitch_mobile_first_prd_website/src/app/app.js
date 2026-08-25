import { state, saveState } from '../shared/state.js';
import { currentScreen, go } from '../shared/router.js';
import { renderHome, bindHomeEvents } from '../features/home.js';
import { renderPreferences, bindPreferencesEvents } from '../features/solo/preferences.js';
import { renderRecommendations, bindRecommendationsEvents } from '../features/solo/recommendations.js';
import { renderTeam, bindTeamEvents } from '../features/team/team.js';
import { renderTeamCreate, bindTeamCreateEvents } from '../features/team/create.js';
import { renderTeamJoin, bindTeamJoinEvents } from '../features/team/join.js';
import { renderTeamLobby, bindTeamLobbyEvents } from '../features/team/lobby.js';
import { renderTeamPreferences, bindTeamPreferencesEvents } from '../features/team/preferences.js';
import { renderTeamRecommendations, bindTeamRecommendationsEvents } from '../features/team/recommendations.js';
import { renderTeamMemberPreferences, bindTeamMemberPreferencesEvents } from '../features/team/member-preferences.js';
import { renderHistory, bindHistoryEvents } from '../features/history.js';
import { ensureSupabaseUser, loadRecentMealHistory, loadRecentMealNames } from '../shared/supabase.js';

const app = document.querySelector('#app');

// Create one anonymous Supabase identity per browser. It lets the app save
// history without forcing users through a sign-up screen.
ensureSupabaseUser().catch(() => {});

loadRecentMealNames().then(recentNames => {
  if (!recentNames.length) return;
  state.recent = [...new Set([...recentNames, ...(state.recent || [])])];
  state.teamPreferences.recent = [...new Set([...recentNames, ...(state.teamPreferences.recent || [])])];
  const currentMember = (state.teamRoom.members || []).find(member => member.name === state.teamRoom.currentUserName);
  if (currentMember?.preferences) {
    currentMember.preferences.recent = [...new Set([...recentNames, ...(currentMember.preferences.recent || [])])];
  }
  saveState();
  renderApp();
}).catch(() => {});

loadRecentMealHistory().then(history => {
  if (!history.length) return;
  state.recentHistory = history;
  saveState();
  renderApp();
}).catch(() => {});

const screens = {
  home: { render: renderHome, bind: bindHomeEvents },
  preferences: { render: renderPreferences, bind: bindPreferencesEvents },
  recommendations: { render: renderRecommendations, bind: bindRecommendationsEvents },
  history: { render: renderHistory, bind: bindHistoryEvents },
  team: { render: renderTeam, bind: bindTeamEvents },
  'team-create': { render: renderTeamCreate, bind: bindTeamCreateEvents },
  'team-join': { render: renderTeamJoin, bind: bindTeamJoinEvents },
  'team-lobby': { render: renderTeamLobby, bind: bindTeamLobbyEvents },
  'team-preferences': { render: renderTeamPreferences, bind: bindTeamPreferencesEvents },
  'team-member-preferences': { render: renderTeamMemberPreferences, bind: bindTeamMemberPreferencesEvents },
  'team-recommendations': { render: renderTeamRecommendations, bind: bindTeamRecommendationsEvents },
  'team-vote': { render: renderTeam, bind: bindTeamEvents },
};

export function renderApp() {
  const screenName = currentScreen();
  // The lobby starts polling the shared room, but that poll must not keep
  // overwriting a member's in-progress condition choices on other screens.
  if (screenName !== 'team-lobby' && window.__teamRoomSyncTimer) {
    window.clearInterval(window.__teamRoomSyncTimer);
    window.__teamRoomSyncTimer = null;
  }
  const screen = screens[screenName] || screens.home;
  app.innerHTML = screen.render(state);
  screen.bind({ state, save: saveState, go, render: renderApp });
}

window.addEventListener('hashchange', renderApp);
