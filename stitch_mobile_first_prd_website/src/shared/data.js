import menuCatalog from './menu-catalog.json';

export const menuCategories = menuCatalog.categories;
export const meals = menuCatalog.menus.map(menu => ({
  match: 80,
  minutes: 10,
  reasons: [],
  image: '',
  restaurants: [],
  ...menu,
}));

export const moods = [
  ['든든하게', '💪'], ['깔끔하게', '🌱'], ['매콤하게', '🌶️'],
  ['따뜻하게', '♨️'], ['건강하게', '🥗'], ['색다르게', '✨'],
];

export const teamPreferenceAxes = [
  { id: 'fullness', label: '포만감', options: ['가볍게', '든든하게', '상관없음'] },
  { id: 'temperature', label: '음식 온도', options: ['차갑게', '뜨겁게', '상관없음'] },
  { id: 'category', label: '음식 종류', options: [...menuCategories, '상관없음'] },
  { id: 'form', label: '선호 형태', options: ['밥', '면', '국물', '고기', '상관없음'] },
];

export const teamCravings = [
  { id: 'spicy', label: '매콤한 게 당겨요', emoji: '🌶️' },
  { id: 'mild', label: '담백한 게 좋아요', emoji: '🍚' },
  { id: 'sour', label: '새콤한 게 당겨요', emoji: '🍋' },
  { id: 'crispy', label: '바삭한 게 먹고 싶어요', image: '/images/shrimp-tempura.png' },
  { id: 'hangover', label: '해장하고 싶어요', emoji: '🍲' },
];

export const recentMenus = ['돈까스', '제육볶음', '마라탕', '샐러드', '비빔밥', '파스타', '김밥', '쌀국수'];
export const budgets = ['~ 7천원', '7천원 ~ 1만원', '1만원 ~ 1.5만원', '1.5만원 ~'];

const normalizePreference = value => String(value ?? '').replace(/\s+/g, '').toLowerCase();

function mealMatchesText(meal, values = []) {
  const searchable = normalizePreference(`${meal.name} ${meal.category} ${meal.fullness} ${meal.temperature} ${meal.form} ${(meal.cravings || []).join(' ')} ${(meal.tasteTags || []).join(' ')}`);
  return values.some(value => {
    const normalized = normalizePreference(value);
    return normalized && searchable.includes(normalized);
  });
}

function mealMatchesCustomCraving(meal, craving) {
  const normalized = normalizePreference(craving);
  if (!normalized) return false;
  const aliases = {
    배고파요: ['든든하게', '밥', '고기'],
    든든하게: ['든든하게', '밥', '고기'],
    담백하게: ['담백', 'mild'],
    매콤하게: ['매콤', 'spicy'],
    새콤하게: ['새콤', 'sour'],
    바삭하게: ['바삭', 'crispy'],
    해장: ['해장', 'hangover', '국물'],
  };
  return mealMatchesText(meal, [normalized, ...(aliases[normalized] || [])]);
}

function preferenceHash(value) {
  return String(value).split('').reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0) >>> 0;
}

export function isPriceWithinBudget(price, budget) {
  if (!budget) return true;
  if (budget === '~ 7천원') return price <= 7000;
  if (budget === '7천원 ~ 1만원') return price >= 7000 && price <= 10000;
  if (budget === '1만원 ~ 1.5만원') return price >= 10000 && price <= 15000;
  if (budget === '1.5만원 ~') return price >= 15000;
  return true;
}

export function getTeamRecommendations(preferences = {}, members = []) {
  const axes = ['fullness', 'temperature', 'category', 'form'];
  const hasMemberMenuPreferences = member => {
    const memberPreferences = member.preferences || {};
    return Boolean(memberPreferences.completed)
      || axes.some(axis => memberPreferences[axis] && memberPreferences[axis] !== '상관없음')
      || (memberPreferences.cravings || []).length > 0
      || Boolean(memberPreferences.customCraving);
  };
  const completedMembers = members.filter(hasMemberMenuPreferences);
  const savedMemberPreferences = preferences.memberMenuPreferences
    && !completedMembers.some(member => JSON.stringify(member.preferences) === JSON.stringify(preferences.memberMenuPreferences))
    ? [{ preferences: preferences.memberMenuPreferences }]
    : [];
  const hasLegacyMenuPreferences = axes.some(axis => preferences[axis] && preferences[axis] !== '상관없음')
    || (preferences.cravings || []).length > 0
    || Boolean(preferences.customCraving);
  // Older rooms stored the representative's menu conditions in teamPreferences.
  // Keep those rooms working, while new rooms use each member's saved conditions.
  const respondingMembers = completedMembers.length
    ? [...completedMembers, ...savedMemberPreferences]
    : savedMemberPreferences.length
      ? savedMemberPreferences
    : hasLegacyMenuPreferences
      ? [{ preferences }]
      : [];
  const memberRecent = respondingMembers.flatMap(member => member.preferences?.recent || []);
  const memberCravingGroups = respondingMembers.map(member => [...(member.preferences?.cravings || []), member.preferences?.customCraving].filter(Boolean)).filter(group => group.length);
  const preferenceSeed = JSON.stringify({
    axes: respondingMembers.map(member => axes.map(axis => member.preferences?.[axis] || '')),
    cravings: respondingMembers.map(member => [...(member.preferences?.cravings || []), member.preferences?.customCraving || '']),
    recent: memberRecent,
  });
  const rotationSeed = preferenceHash(preferenceSeed || new Date().toISOString().slice(0, 10));
  const scoredMeals = meals.map(meal => {
    let considered = 0;
    let matched = 0;
    const preferenceReasons = [];

    axes.forEach(axis => {
      const selections = respondingMembers
        .map(member => member.preferences?.[axis])
        .filter(selected => selected && selected !== '상관없음');
      if (!selections.length) return;
      considered += 1;
      const matches = selections.filter(selected => meal[axis] === selected).length;
      const ratio = matches / selections.length;
      matched += ratio;
      if (ratio > 0) {
        const labels = { fullness: '포만감', temperature: '음식 온도', category: '음식 종류', form: '선호 형태' };
        preferenceReasons.push(ratio === 1 ? `모든 팀원의 ${labels[axis]} 조건에 맞아요` : `팀원 ${matches}명의 ${labels[axis]} 조건에 맞아요`);
      }
    });

    const memberMatches = memberCravingGroups.filter(group => group.some(craving => teamCravings.some(option => option.id === craving) ? meal.cravings.includes(craving) : mealMatchesCustomCraving(meal, craving))).length;
    const memberMatchRatio = memberCravingGroups.length ? memberMatches / memberCravingGroups.length : 0;
    if (memberCravingGroups.length) {
      considered += 1;
      if (memberMatchRatio > 0) {
        matched += memberMatchRatio;
        preferenceReasons.unshift(memberMatchRatio === 1 ? '모든 팀원의 당김을 반영했어요' : '팀원들의 당김을 반영했어요');
      }
    }

    const wasRecentlyEaten = [...(preferences.recent || []), ...memberRecent].some(recent => meal.name.includes(recent) || recent.includes(meal.name));
    const tieBreak = preferenceHash(`${rotationSeed}:${meal.id}`) % 1000;
    const match = Math.max(45, Math.min(99, considered
      ? 65 + Math.round((matched / considered) * 34)
      : 70 + (tieBreak % 25)));
    return {
      ...meal,
      match,
      reasons: preferenceReasons.length ? preferenceReasons.slice(0, 2) : (meal.reasons?.length ? meal.reasons : ['새로운 메뉴 후보예요']),
      wasRecentlyEaten,
      tieBreak,
      // 메뉴 가격은 식당에 따라 달라지므로 팀 메뉴 투표 단계에서는 예산을 적용하지 않아요.
      budgetMatches: true,
    };
  });

  const notRecentlyEaten = scoredMeals.filter(meal => !meal.wasRecentlyEaten);
  const candidates = notRecentlyEaten.length ? notRecentlyEaten : scoredMeals;
  const sharedAxisConditions = axes.map(axis => {
    const selections = respondingMembers
      .map(member => member.preferences?.[axis])
      .filter(selected => selected && selected !== '상관없음');
    return selections.length && new Set(selections).size === 1 ? [axis, selections[0]] : null;
  }).filter(Boolean);
  const sharedCravings = respondingMembers.length === 1
    ? (memberCravingGroups[0] || [])
    : teamCravings
      .map(option => option.id)
      .filter(craving => memberCravingGroups.length && memberCravingGroups.every(group => group.includes(craving)));
  const matchesCraving = (meal, craving) => teamCravings.some(option => option.id === craving)
    ? meal.cravings.includes(craving)
    : mealMatchesCustomCraving(meal, craving);
  const exactCandidates = candidates.filter(meal => (
    sharedAxisConditions.every(([axis, value]) => meal[axis] === value)
    && (!sharedCravings.length || sharedCravings.some(craving => matchesCraving(meal, craving)))
  ));
  const hasFocusedConditions = sharedAxisConditions.length > 0 || sharedCravings.length > 0;
  const rankedCandidates = hasFocusedConditions && exactCandidates.length
    ? exactCandidates
    : candidates;
  const resultLimit = hasFocusedConditions && exactCandidates.length
    ? Math.min(exactCandidates.length, 3)
    : 3;
  return rankedCandidates
    .sort((left, right) => right.match - left.match || right.tieBreak - left.tieBreak)
    .slice(0, resultLimit);
}

export function getSoloRecommendations(preferences = {}) {
  const recent = preferences.recent || [];
  const moodsSelected = preferences.mood || [];
  const allergies = preferences.allergies || [];
  const dislikes = preferences.dislikes || [];
  const allowRecentlyEaten = Boolean(preferences.allowRecentlyEaten);
  const moodRules = {
    든든하게: meal => meal.fullness === '든든하게',
    깔끔하게: meal => meal.cravings?.includes('mild') || meal.tasteTags?.includes('담백'),
    매콤하게: meal => meal.cravings?.includes('spicy'),
    따뜻하게: meal => meal.temperature === '뜨겁게',
    건강하게: meal => meal.category === '샐러드·건강식' || meal.tasteTags?.includes('건강함'),
    색다르게: meal => !['한식', '중식', '일식'].includes(meal.category),
  };

  const scoredMeals = meals.map(meal => {
    const recentlyEaten = mealMatchesText(meal, recent);
    const blocked = mealMatchesText(meal, [...allergies, ...dislikes]);
    const moodMatches = moodsSelected.filter(mood => moodRules[mood]?.(meal)).length;
    const budgetMatches = isPriceWithinBudget(meal.price, preferences.budget);
    const score = (budgetMatches ? 4 : 0) + moodMatches * 3 + (recentlyEaten ? -8 : 2) + (meal.match || 0) / 20;
    const reasons = [];
    if (moodMatches) reasons.push('오늘의 기분을 반영했어요');
    if (budgetMatches) reasons.push('예산에 맞는 메뉴예요');
    if (!reasons.length) reasons.push(...(meal.reasons || []));
    return { ...meal, score, recentlyEaten, blocked, budgetMatches, reasons: reasons.slice(0, 2) };
  });

  const allowed = scoredMeals.filter(meal => !meal.blocked && (allowRecentlyEaten || !meal.recentlyEaten));
  const fallback = scoredMeals.filter(meal => !meal.blocked && (allowRecentlyEaten || !meal.recentlyEaten || !meal.recentlyEaten));
  return (allowed.length ? allowed : fallback)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}
