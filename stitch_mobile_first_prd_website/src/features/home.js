import { icon, shell } from '../shared/ui.js';

export function renderHome() {
  return shell(`
    <section class="home-screen">
      <div class="home-decor decor-left">🥟</div><div class="home-decor decor-right">🥗</div>
      <div class="brand"><h1>Lunch<br />Roulette</h1><p>오늘 뭐 먹지?</p></div>
      <div class="roulette-placeholder home-wheel" aria-label="천천히 돌아가는 점심 룰렛"><div class="pointer"></div><div class="roulette-center">Spin</div></div>
      <div class="home-actions">
        <button class="primary-button action-button" data-action="team-create"><span>${icon('group')}<b>팀 점심방 만들기</b></span>${icon('arrow')}</button>
        <button class="secondary-button action-button" data-action="solo"><span>${icon('person')}<b>혼자 추천받기</b></span>${icon('arrow')}</button>
        <button class="secondary-button action-button" data-action="team-join"><span>${icon('link')}<b>초대 링크로 참여</b></span>${icon('arrow')}</button>
        <button class="secondary-button action-button" data-action="history"><span>${icon('star')}<b>내 식사 기록</b></span>${icon('arrow')}</button>
      </div>
      <div class="cityscape">⌂　⌂　⌂　⌂　⌂　⌂</div>
    </section>
  `);
}

export function bindHomeEvents({ go }) {
  document.querySelectorAll('[data-action="solo"]').forEach(button => button.addEventListener('click', () => go('preferences')));
  document.querySelectorAll('[data-action="team-create"]').forEach(button => button.addEventListener('click', () => go('team-create')));
  document.querySelectorAll('[data-action="team-join"]').forEach(button => button.addEventListener('click', () => go('team-join')));
  document.querySelectorAll('[data-action="history"]').forEach(button => button.addEventListener('click', () => go('history')));
}
