/* ==========================================================================
   Dr. Bruno Kersten — Oncologia Clínica
   Comportamentos de interface: menu, busca, carrossel, formulários.
   ========================================================================== */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  /* ----------------------------------------------------------------------
     1. Cabeçalho: sombra ao rolar
     ---------------------------------------------------------------------- */
  const header = $('#siteHeader');

  function onScroll() {
    if (header) header.classList.toggle('is-stuck', window.scrollY > 8);
    if (toTop) toTop.classList.toggle('is-visible', window.scrollY > 520);
    if (nav && nav.classList.contains('is-open')) positionNav();
  }

  /* ----------------------------------------------------------------------
     2. Menu mobile + submenus
     ---------------------------------------------------------------------- */
  const nav = $('#mainNav');
  const navToggle = $('#navToggle');
  const backdrop = $('#navBackdrop');

  /** Alinha o topo do menu lateral à base do cabeçalho, que muda de altura. */
  function positionNav() {
    if (!header) return;
    const bottom = Math.max(0, header.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--nav-top', bottom + 'px');
  }

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
    if (backdrop) backdrop.hidden = !open;
    if (open) positionNav();
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNav(nav.classList.contains('is-open') === false);
    });
  }
  if (backdrop) backdrop.addEventListener('click', () => setNav(false));

  // Abre/fecha submenus no menu mobile.
  $$('.subnav-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = btn.closest('.nav-item');
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  // Fecha o menu ao navegar para uma âncora da mesma página.
  $$('.main-nav a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth <= 1180) setNav(false);
    });
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1180) setNav(false);
    else if (nav && nav.classList.contains('is-open')) positionNav();
  });

  /* ----------------------------------------------------------------------
     3. Busca no cabeçalho
     ---------------------------------------------------------------------- */
  const searchToggle = $('#searchToggle');
  const searchPanel = $('#searchPanel');

  if (searchToggle && searchPanel) {
    searchToggle.addEventListener('click', function () {
      const open = searchPanel.hidden;
      searchPanel.hidden = !open;
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) {
        const input = $('#siteSearch', searchPanel);
        if (input) input.focus();
      }
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (searchPanel && !searchPanel.hidden) {
      searchPanel.hidden = true;
      searchToggle.setAttribute('aria-expanded', 'false');
      searchToggle.focus();
    }
    if (nav && nav.classList.contains('is-open')) {
      setNav(false);
      navToggle.focus();
    }
  });

  /* ----------------------------------------------------------------------
     4. Carrossel da home
     ---------------------------------------------------------------------- */
  const carousel = $('#carousel');

  if (carousel) {
    const slides = $$('.slide', carousel);
    const dotsWrap = $('.carousel-dots', carousel);
    const prevBtn = $('[data-carousel="prev"]', carousel);
    const nextBtn = $('[data-carousel="next"]', carousel);
    const INTERVAL = 6000;
    let index = 0;
    let timer = null;

    const dots = slides.map(function (slide, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'car-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Ir para o slide ' + (i + 1) + ' de ' + slides.length);
      dot.addEventListener('click', function () {
        goTo(i);
        restart();
      });
      if (dotsWrap) dotsWrap.appendChild(dot);
      return dot;
    });

    function goTo(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        const active = i === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }

    function restart() {
      window.clearInterval(timer);
      if (!reduceMotion) timer = window.setInterval(() => goTo(index + 1), INTERVAL);
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1); restart(); });

    // Pausa enquanto o usuário interage.
    ['mouseenter', 'focusin'].forEach((evt) =>
      carousel.addEventListener(evt, () => window.clearInterval(timer))
    );
    ['mouseleave', 'focusout'].forEach((evt) => carousel.addEventListener(evt, restart));
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) window.clearInterval(timer);
      else restart();
    });

    // Navegação por teclado.
    carousel.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { goTo(index - 1); restart(); }
      if (event.key === 'ArrowRight') { goTo(index + 1); restart(); }
    });

    // Gesto de arrastar (touch).
    let startX = null;
    carousel.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', function (e) {
      if (startX === null) return;
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 45) { goTo(index + (delta < 0 ? 1 : -1)); restart(); }
      startX = null;
    });

    goTo(0);
    restart();
  }

  /* ----------------------------------------------------------------------
     5. Formulários (demonstração — sem back-end)
     ---------------------------------------------------------------------- */
  $$('form[data-demo-form]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const feedback = $('.form-feedback', form);
      if (!feedback) return;
      feedback.hidden = false;
      feedback.textContent = form.getAttribute('data-demo-message') ||
        'Mensagem registrada nesta demonstração — em produção, conecte a um serviço de envio de e-mail ou back-end.';
      feedback.setAttribute('role', 'status');
      form.reset();
    });
  });

  /* ----------------------------------------------------------------------
     6. Página de busca
     ---------------------------------------------------------------------- */
  const results = $('#searchResults');

  if (results && window.SEARCH_INDEX) {
    const input = $('#searchQuery');
    const summary = $('#searchSummary');

    const normalize = (value) =>
      (value || '')
        .toLowerCase()
        .normalize('NFD')
        // remove acentos para que "prevencao" encontre "prevenção"
        .replace(/[\u0300-\u036f]/g, '');

    function render(query) {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      const matches = !terms.length
        ? window.SEARCH_INDEX
        : window.SEARCH_INDEX.filter(function (item) {
            const haystack = normalize(
              [item.title, item.description, item.section, item.keywords].join(' ')
            );
            return terms.every((term) => haystack.indexOf(term) !== -1);
          });

      results.innerHTML = matches
        .map(function (item) {
          return (
            '<li><a class="result" href="' + item.url + '">' +
            '<p class="path">' + item.section + '</p>' +
            '<h3>' + item.title + '</h3>' +
            '<p>' + item.description + '</p>' +
            '</a></li>'
          );
        })
        .join('');

      if (summary) {
        if (!terms.length) {
          summary.textContent = 'Mostrando todas as ' + matches.length + ' páginas do site.';
        } else if (!matches.length) {
          summary.textContent =
            'Nenhum resultado para “' + query + '”. Tente outras palavras, como “sinais”, “tratamento” ou “consulta”.';
        } else {
          summary.textContent =
            matches.length + (matches.length === 1 ? ' resultado' : ' resultados') + ' para “' + query + '”.';
        }
      }
    }

    const initial = new URLSearchParams(window.location.search).get('q') || '';
    if (input) {
      input.value = initial;
      input.addEventListener('input', () => render(input.value));
    }
    const form = $('#searchForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); render(input ? input.value : ''); });
    render(initial);
  }

  /* ----------------------------------------------------------------------
     7. Seletor de tipo de câncer
     Navega ao escolher. Como é um <select> dentro de um <form>-less wrapper,
     funciona com teclado e leitor de tela sem JS adicional; sem JS, a lista de
     cartões da própria página continua servindo como navegação.
     ---------------------------------------------------------------------- */
  document.querySelectorAll('[data-cancer-select]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      if (sel.value) window.location.href = sel.value;
    });
  });

  /* ----------------------------------------------------------------------
     8. Voltar ao topo
     ---------------------------------------------------------------------- */
  const toTop = $('#toTop');
  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
