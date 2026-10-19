/* Universal site menu: a yellow "tap in" pill + one "menu" dropdown with every page.
   Usage: <div data-sitenav></div> where the page's buttons go (+ /assets/sitenav.css, this script).
   Options on the mount: data-tapin="off" hides the tap in pill (e.g. the hidden /content page).
   Tap in: if the page has the Tap In card (/assets/tapin.js), it scrolls down and opens it;
   otherwise it goes to /music/#community. */
(function () {
  const PAGES = [
    ['Home', '/'],
    ['Listen', '/music/'],
    ['On The Verge', '/ontheverge/'],
    ['EPK', '/epk/'],
    ['Get Featured', '/feature/'],
    ['Booking', '/epk/#contact']
  ];
  const here = location.pathname.replace(/index\.html$/, '');

  document.querySelectorAll('[data-sitenav]').forEach((mount, i) => {
    const id = 'snMenu' + i;
    const tapin = mount.dataset.tapin === 'off' ? '' :
      '<a class="sn-pill sn-tapin" href="/music/#community" data-tapin-open>tap in ↓</a>';
    const items = PAGES.map(([name, href]) => {
      const cur = !href.includes('#') && href === here;
      return `<a class="sn-item${cur ? ' sn-cur' : ''}" href="${href}"${cur ? ' aria-current="page"' : ''}>${name}${cur ? '<span>you’re here</span>' : ''}</a>`;
    }).join('');
    const wrap = document.createElement('div');
    wrap.className = 'sitenav';
    wrap.setAttribute('role', 'navigation');
    wrap.setAttribute('aria-label', 'Site');
    wrap.innerHTML = tapin +
      `<div class="sn-drop"><button class="sn-pill sn-btn" type="button" aria-expanded="false" aria-controls="${id}">menu <span class="sn-chev" aria-hidden="true">▾</span></button>` +
      `<div class="sn-list" id="${id}" hidden>${items}</div></div>`;
    mount.replaceWith(wrap);

    const btn = wrap.querySelector('.sn-btn'), list = wrap.querySelector('.sn-list');
    const set = (open) => {
      list.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open) { list.classList.remove('sn-left'); if (list.getBoundingClientRect().left < 8) list.classList.add('sn-left'); }
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(list.hidden); if (!list.hidden) list.querySelector('a').focus({ preventScroll: true }); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !list.hidden) { set(false); btn.focus(); } });
    // "Booking" on the EPK itself, or any same-page link: just close the menu and let it scroll
    list.addEventListener('click', () => set(false));
  });
})();
