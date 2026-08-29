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
     5. Máscara dos campos de telefone

     Formata enquanto a pessoa digita: (18) 99999-9999 para celular e
     (18) 3621-0000 para fixo. O formato só se decide no 11º dígito, então
     um número de 10 fica com quatro dígitos antes do hífen.
     ---------------------------------------------------------------------- */
  function formatarTelefone(digitos) {
    // Número brasileiro tem 10 ou 11 dígitos. Com 12 ou 13 e começando em 55,
    // o que veio junto só pode ser o código do país — normalmente de quem
    // colou "+55 18 99999-8888". Sem isso o 55 viraria o DDD.
    if (digitos.indexOf('55') === 0 && (digitos.length === 12 || digitos.length === 13)) {
      digitos = digitos.slice(2);
    }
    const d = digitos.slice(0, 11);
    if (!d.length) return '';
    if (d.length <= 2) return '(' + d;
    const ddd = d.slice(0, 2);
    const resto = d.slice(2);
    if (resto.length <= 4) return '(' + ddd + ') ' + resto;
    const corte = d.length > 10 ? 5 : 4;
    return '(' + ddd + ') ' + resto.slice(0, corte) + '-' + resto.slice(corte);
  }

  $$('input[type="tel"]').forEach(function (campo) {
    // Conta dígitos, e não caracteres, para o cursor não pular quando os
    // parênteses e o hífen entram ou saem.
    const digitosAte = (texto, pos) => (texto.slice(0, pos).match(/\d/g) || []).length;
    const posDepoisDe = (texto, quantos) => {
      if (quantos <= 0) return 0;
      let vistos = 0;
      for (let i = 0; i < texto.length; i++) {
        if (/\d/.test(texto[i])) {
          vistos += 1;
          if (vistos === quantos) return i + 1;
        }
      }
      return texto.length;
    };

    let anterior = campo.value.replace(/\D/g, '');

    campo.addEventListener('input', function (evento) {
      const apagando = !!evento.inputType && evento.inputType.indexOf('delete') === 0;
      let digitos = campo.value.replace(/\D/g, '');

      // Apagar em cima de um separador não mudaria dígito nenhum, e a tecla
      // pareceria travada. Nesse caso, remove o dígito anterior a ele.
      if (apagando && digitos === anterior) digitos = digitos.slice(0, -1);
      anterior = digitos;

      const alvo = digitosAte(campo.value, campo.selectionStart);
      const formatado = formatarTelefone(digitos);
      if (formatado === campo.value) return;

      campo.value = formatado;
      const p = posDepoisDe(formatado, apagando ? Math.min(alvo, digitos.length) : alvo);
      try { campo.setSelectionRange(p, p); } catch (e) { /* alguns navegadores recusam em type=tel */ }
    });
  });

  /* ----------------------------------------------------------------------
     5a. Formulários de contato — abrem o WhatsApp

     O site é estático e não tem servidor para receber envios. Em vez de
     fingir que a mensagem foi enviada, o formulário monta o texto e abre a
     conversa no WhatsApp da clínica, já preenchida. A pessoa revisa e envia
     pelo próprio aplicativo, então nada trafega por aqui.
     ---------------------------------------------------------------------- */
  $$('form[data-whatsapp-form]').forEach(function (form) {
    const numero = (form.getAttribute('data-whatsapp') || '').replace(/\D/g, '');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const feedback = $('.form-feedback', form);
      const dizer = (texto) => {
        if (!feedback) return;
        feedback.hidden = false;
        feedback.textContent = texto;
        feedback.setAttribute('role', 'status');
      };

      const valor = (nome) => {
        const campo = form.querySelector('[name="' + nome + '"]');
        if (!campo) return '';
        // Num <select>, o que interessa é o rótulo que a pessoa leu na tela,
        // não o valor interno da opção.
        if (campo.tagName === 'SELECT') {
          const op = campo.options[campo.selectedIndex];
          return op ? op.text.trim() : '';
        }
        return campo.value.trim();
      };

      const nome = valor('nome');
      const email = valor('email');
      if (!nome || !email) {
        dizer('Preencha ao menos o nome e o e-mail para continuar.');
        return;
      }

      if (!numero) {
        dizer(
          'O WhatsApp da clínica ainda não foi configurado. Use os dados de ' +
          'contato desta página para falar com a equipe.'
        );
        return;
      }

      const linhas = ['Olá! Vim pelo site.', ''];
      const juntar = (rotulo, v) => { if (v) linhas.push(rotulo + ': ' + v); };
      juntar('Nome', nome);
      juntar('Telefone', valor('telefone'));
      juntar('E-mail', email);
      juntar('Assunto', valor('assunto'));
      const msg = valor('mensagem');
      if (msg) { linhas.push('', 'Mensagem:', msg); }

      const url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(linhas.join('\n'));
      const aba = window.open(url, '_blank', 'noopener');
      if (aba) {
        dizer('Abrimos o WhatsApp com sua mensagem pronta. Revise e envie por lá.');
        form.reset();
      } else {
        // Bloqueador de pop-up: em vez de perder a mensagem, dá o link.
        dizer('Seu navegador bloqueou a janela. Toque no botão de novo ou fale pelo telefone desta página.');
      }
    });
  });

  /* ----------------------------------------------------------------------
     5b. Demais formulários (demonstração — sem back-end)
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

    const contexto = $('#searchContext');
    const escapar = (s) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const cartao = (item) =>
      '<li><a class="result" href="' + item.url + '">' +
      '<p class="path">' + item.section + '</p>' +
      '<h3>' + item.title + '</h3>' +
      '<p>' + item.description + '</p>' +
      '</a></li>';

    function render(query) {
      const terms = normalize(query).split(/\s+/).filter(Boolean);

      // Duas buscas distintas: por assunto (título, seção, palavras-chave) e
      // por sintoma. Saber por qual via a página casou é o que permite não
      // devolver uma lista de cânceres para quem digitou "náusea".
      const porAssunto = [];
      const porSintoma = [];
      if (!terms.length) {
        porAssunto.push.apply(porAssunto, window.SEARCH_INDEX);
      } else {
        window.SEARCH_INDEX.forEach(function (item) {
          const assunto = normalize([item.title, item.description, item.section, item.keywords].join(' '));
          const sintomas = normalize(item.sintomas || '');
          if (terms.every((t) => assunto.indexOf(t) !== -1)) porAssunto.push(item);
          else if (terms.every((t) => sintomas.indexOf(t) !== -1)) porSintoma.push(item);
        });
      }
      const total = porAssunto.length + porSintoma.length;

      let html = porAssunto.map(cartao).join('');
      if (porSintoma.length) {
        html +=
          '<li class="results-divider"><h2>Tipos de câncer em que esse sintoma pode aparecer</h2>' +
          '<p>Aparecer nesta lista não indica probabilidade — apenas que o sintoma consta ' +
          'entre as manifestações possíveis.</p></li>' +
          porSintoma.map(cartao).join('');
      }
      results.innerHTML = html;

      // Aviso de enquadramento: só quando a pessoa chegou por sintoma.
      if (contexto) {
        if (porSintoma.length) {
          contexto.innerHTML =
            '<div class="alert-box alert-box--blue">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>' +
            '<div><p><strong>Antes de ler os resultados.</strong> Sintomas isolados quase sempre têm ' +
            'causas comuns e benignas — e “' + escapar(query.trim()) + '” não é exceção. O que pede ' +
            'avaliação médica é a <strong>persistência</strong>: queixas que não melhoram em algumas ' +
            'semanas, que voltam com frequência ou que mudam de padrão.</p>' +
            '<p style="margin-bottom:0;"><a href="prevencao.html#sinais">Ver quando um sinal merece avaliação</a> · ' +
            '<a href="contato.html">Falar com a equipe</a></p></div></div>';
          contexto.hidden = false;
        } else {
          contexto.innerHTML = '';
          contexto.hidden = true;
        }
      }

      if (summary) {
        if (!terms.length) {
          summary.textContent = 'Mostrando todas as ' + total + ' páginas do site.';
        } else if (!total) {
          summary.textContent =
            'Nenhum resultado para “' + query + '”. Tente outras palavras, como “sinais”, “tratamento” ou “consulta”.';
        } else {
          summary.textContent =
            total + (total === 1 ? ' resultado' : ' resultados') + ' para “' + query + '”.';
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
     8. Tela de acesso (área administrativa)

     ATENÇÃO: isto NÃO é autenticação. O site é estático e não tem servidor,
     então qualquer verificação roda no navegador do visitante e pode ser
     burlada abrindo o código-fonte. Serve para desenhar o fluxo; a proteção
     de verdade exige um serviço de autenticação (ver README).
     ---------------------------------------------------------------------- */
  const loginForm = $('#loginForm');
  if (loginForm) {
    const email = $('#loginEmail');
    const senha = $('#loginSenha');
    const feedback = $('#loginFeedback');
    const revelar = $('#revelarSenha');

    if (revelar) {
      revelar.addEventListener('click', function () {
        const visivel = senha.type === 'text';
        senha.type = visivel ? 'password' : 'text';
        revelar.setAttribute('aria-pressed', String(!visivel));
        revelar.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
        senha.focus();
      });
    }

    const dizer = (texto, tipo) => {
      if (!feedback) return;
      feedback.textContent = texto;
      feedback.setAttribute('data-tipo', tipo);
      feedback.hidden = false;
    };

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const e1 = (email.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e1)) {
        dizer('Informe um e-mail válido.', 'erro');
        email.focus();
        return;
      }
      if ((senha.value || '').length < 6) {
        dizer('A senha precisa ter ao menos 6 caracteres.', 'erro');
        senha.focus();
        return;
      }
      dizer(
        'Dados válidos. Não há área administrativa para abrir ainda, e nenhuma ' +
        'informação foi enviada ou guardada.',
        'ok'
      );
      senha.value = '';
    });
  }

  /* ----------------------------------------------------------------------
     9. Voltar ao topo
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
