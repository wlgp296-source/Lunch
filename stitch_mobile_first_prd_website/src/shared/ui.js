const icons = { back: '←', arrow: '→', person: '♙', group: '♧', link: '↗', location: '⌖', edit: '✎', star: '★', refresh: '↻', filter: '☷', check: '✓' };

export function icon(name) {
  return icons[name] || '•';
}

export function shell(content, title = '') {
  return `<main class="phone-shell">${title ? `<header class="topbar"><button class="icon-button" data-action="back" aria-label="뒤로">${icon('back')}</button><h1>${title}</h1><span class="topbar-spacer"></span></header>` : ''}${content}</main>`;
}
