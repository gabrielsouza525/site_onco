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
     8. Área administrativa — o que o login e o painel compartilham

     Quem autentica é o Netlify Identity. O widget, carregado no <head> das
     duas páginas, guarda a sessão no navegador, e o mesmo login vale para o
     painel e para o /admin/. O serviço só existe no site hospedado na
     Netlify; em qualquer outro endereço as duas telas dizem isso de frente
     em vez de falhar com um erro do widget.
     ---------------------------------------------------------------------- */
  const identity = window.netlifyIdentity;

  /* O widget lê do endereço o token do convite e o da senha nova, e logo em
     seguida o apaga. Este script roda antes disso, então guarda aqui. */
  const chegouComToken =
    /(confirmation|invite|recovery|email_change)_token=/.test(window.location.hash);

  function loginDisponivel() {
    if (!identity || window.location.protocol === 'file:') return false;
    const host = window.location.hostname;
    // Na máquina local o widget pediria o endereço do site numa janela
    // própria; no GitHub Pages o serviço simplesmente não existe.
    return !/\.github\.io$/.test(host) &&
      ['localhost', '127.0.0.1', '[::1]', ''].indexOf(host) === -1;
  }

  /* "Manter conectado" desmarcado: a sessão vale só enquanto a aba estiver
     aberta. O widget sempre grava a sessão no navegador — sem isso ela não
     passaria da tela de login para o painel —, então quem limita é isto:
     uma marca permanente diz que a sessão é curta, e uma marca da aba diz
     que ela continua viva. Sessão curta sem a marca da aba já venceu. */
  const SESSAO_CURTA = 'painel.sessaoCurta';
  const SESSAO_ABA = 'painel.abaAtiva';

  const guardar = (onde, chave, valor) => {
    try {
      if (valor === null) window[onde].removeItem(chave);
      else window[onde].setItem(chave, valor);
    } catch (e) { /* janela anônima pode recusar; a sessão segue normal */ }
  };
  const ler = (onde, chave) => {
    try { return window[onde].getItem(chave); } catch (e) { return null; }
  };

  function marcarSessao(manter) {
    guardar('localStorage', SESSAO_CURTA, manter ? null : '1');
    guardar('sessionStorage', SESSAO_ABA, manter ? null : '1');
  }

  function sessaoVencida() {
    return ler('localStorage', SESSAO_CURTA) === '1' &&
      ler('sessionStorage', SESSAO_ABA) !== '1';
  }

  /* Chama de volta com quem está conectado (ou null) quando o widget inicia.
     Ele inicia no DOMContentLoaded, que vem depois deste script — por isso
     o evento nunca escapa. */
  function quandoIniciar(callback) {
    identity.on('init', function (usuario) {
      if (usuario && sessaoVencida()) {
        marcarSessao(true);
        identity.logout();
        usuario = null;
      }
      callback(usuario);
    });
  }

  function mensagemDeLogin(erro) {
    const json = (erro && erro.json) || {};
    const texto = String(json.error_description || json.msg || (erro && erro.message) || '');
    const status = erro && erro.status;
    if (/not confirmed/i.test(texto)) {
      return 'Este e-mail ainda não aceitou o convite. Abra o link que chegou no ' +
        'seu e-mail para criar a senha.';
    }
    if (json.error === 'invalid_grant' || /no user|password/i.test(texto)) {
      return 'E-mail ou senha incorretos.';
    }
    if (status === 404) {
      return 'O serviço de login ainda não foi ativado neste site. Avise quem ' +
        'cuida da parte técnica.';
    }
    if (!status) {
      return 'Sem resposta do serviço de login. Verifique a internet e tente de novo.';
    }
    return 'O login não funcionou (código ' + status + '). Tente de novo em instantes.';
  }

  /* ----------------------------------------------------------------------
     8a. Tela de login
     ---------------------------------------------------------------------- */
  const loginForm = $('#loginForm');
  if (loginForm) {
    const email = $('#loginEmail');
    const senha = $('#loginSenha');
    const manter = $('#manterConectado');
    const entrar = $('#loginEntrar');
    const entrarTexto = entrar ? $('span', entrar) : null;
    const esqueci = $('#esqueciSenha');
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
    const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    const ocupado = (sim) => {
      entrar.disabled = sim;
      entrar.setAttribute('aria-busy', String(sim));
      if (entrarTexto) entrarTexto.textContent = sim ? 'Entrando…' : 'Entrar';
    };

    // Só existe depois que o widget inicia. Ler identity.gotrue antes disso
    // abriria a janela de login do próprio widget.
    let gotrue = null;
    const aindaCarregando = () =>
      dizer('O serviço de login ainda está carregando. Tente de novo em um instante.', 'erro');

    if (!loginDisponivel()) {
      $$('input, button', loginForm).forEach(function (el) { el.disabled = true; });
      dizer('Este endereço não tem o serviço de login: ele só existe no site ' +
        'publicado na Netlify.', 'erro');
    } else {
      identity.setLocale('pt');
      quandoIniciar(function (usuario) {
        if (usuario) {
          window.location.replace('painel.html');
          return;
        }
        gotrue = identity.gotrue;
      });

      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!gotrue) { aindaCarregando(); return; }

        const endereco = (email.value || '').trim();
        if (!emailValido(endereco)) {
          dizer('Informe um e-mail válido.', 'erro');
          email.focus();
          return;
        }
        if (!senha.value) {
          dizer('Digite sua senha.', 'erro');
          senha.focus();
          return;
        }

        feedback.hidden = true;
        ocupado(true);
        gotrue.login(endereco, senha.value, true)
          .then(function () {
            marcarSessao(manter ? manter.checked : true);
            window.location.replace('painel.html');
          })
          .catch(function (erro) {
            ocupado(false);
            senha.value = '';
            dizer(mensagemDeLogin(erro), 'erro');
            senha.focus();
          });
      });

      if (esqueci) {
        esqueci.addEventListener('click', function () {
          if (!gotrue) { aindaCarregando(); return; }
          const endereco = (email.value || '').trim();
          if (!emailValido(endereco)) {
            dizer('Digite seu e-mail no campo acima e clique de novo em ' +
              '"Esqueci minha senha".', 'erro');
            email.focus();
            return;
          }
          esqueci.disabled = true;
          // A resposta é a mesma para e-mail com ou sem acesso: dizer "não
          // encontrado" revelaria quem tem conta no painel.
          const avisar = function () {
            dizer('Se ' + endereco + ' tiver acesso ao painel, chega em instantes ' +
              'um e-mail com o link para criar uma senha nova.', 'ok');
          };
          gotrue.requestPasswordRecovery(endereco)
            .then(avisar, function (erro) {
              if (erro && erro.status) avisar();
              else dizer(mensagemDeLogin(erro), 'erro');
            })
            .then(function () { esqueci.disabled = false; });
        });
      }
    }
  }

  /* ----------------------------------------------------------------------
     8b. Painel — acesso

     Esconder conteúdo no navegador não é proteção: o HTML é público. Por
     isso o painel só exibe o que já está publicado no site. O que protege
     de verdade é o Git Gateway, que só grava para quem está conectado.
     ---------------------------------------------------------------------- */
  const painel = $('#painelShell');
  if (painel) {
    const estado = (valor) => painel.setAttribute('data-estado', valor);
    const quem = $('#painelQuem');
    const sair = $('#painelSair');
    const irParaLogin = () => window.location.replace('login.html');

    if (!loginDisponivel()) {
      estado('indisponivel');
    } else {
      identity.setLocale('pt');

      let iniciado = false;
      let aberto = false;
      const abrir = function (usuario) {
        if (aberto) return;
        aberto = true;
        if (quem && usuario.email) {
          quem.textContent = usuario.email;
          quem.hidden = false;
        }
        if (sair) sair.hidden = false;
        estado('aberto');
        iniciarEditor();
      };

      quandoIniciar(function (usuario) {
        iniciado = true;
        if (usuario) abrir(usuario);
        // Com token no endereço, a janela do convite ou da senha nova abre
        // por cima da espera, e o painel aguarda o 'login'.
        else if (!chegouComToken) irParaLogin();
      });

      // O widget também dispara 'login' ao restaurar uma sessão, antes do
      // 'init'. Só depois dele é que 'login' quer dizer "acabou de entrar" —
      // pelo convite ou pela senha nova.
      identity.on('login', function (usuario) {
        if (!iniciado) return;
        marcarSessao(true);
        identity.close();
        abrir(usuario);
      });
      identity.on('close', function () {
        if (iniciado && !identity.currentUser()) irParaLogin();
      });
      identity.on('logout', function () {
        marcarSessao(true);
        irParaLogin();
      });

      if (sair) {
        sair.addEventListener('click', function () {
          sair.disabled = true;
          identity.logout();
        });
      }

      // Se o serviço não responder, a tela não fica presa em "verificando".
      window.setTimeout(function () {
        if (painel.getAttribute('data-estado') === 'carregando' && !chegouComToken) {
          const texto = $('#painelIndisponivel');
          if (texto) {
            texto.textContent = 'O serviço de login não respondeu. Verifique a ' +
              'internet e recarregue a página.';
          }
          estado('indisponivel');
        }
      }, 8000);
    }
  }

  /* ----------------------------------------------------------------------
     8c. Painel — dados de contato

     Lê e grava src/data/site.json pelo Git Gateway da Netlify, que repassa a
     API de arquivos do GitHub com o login de quem está no painel. Cada
     gravação vira um commit na main; o build da Netlify e o workflow
     "Gerar site" regeneram as páginas a partir dele.
     ---------------------------------------------------------------------- */
  const paraBase64 = (texto) => {
    let binario = '';
    new TextEncoder().encode(texto).forEach(function (b) { binario += String.fromCharCode(b); });
    return window.btoa(binario);
  };
  const deBase64 = (b64) => {
    const binario = window.atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
  };

  // Colchetes ou quatro zeros seguidos: o texto de exemplo deixado no lugar
  // do dado real, como "[Endereço completo a inserir]" e "(18) 0000-0000".
  const ehExemplo = (v) => /\[|0{4}/.test(String(v));

  function estadoDoCampo(campo, valor) {
    const v = String(valor || '').trim();
    if (!v) return campo.opcional ? 'vazio' : 'falta';
    if (ehExemplo(v)) return 'exemplo';
    return 'ok';
  }

  function iniciarEditor() {
    const fonte = $('#painelDados');
    let dados;
    try { dados = JSON.parse(fonte.textContent); } catch (e) { return; }

    const campos = dados.campos;
    const lista = $('#painelLista');
    const resumo = $('#painelResumo');
    const aviso = $('#painelAviso');
    const leitura = $('#painelLeitura');
    const editar = $('#painelEditar');
    const form = $('#painelForm');
    const salvar = $('#painelSalvar');
    const cancelar = $('#painelCancelar');
    const erroEl = $('#painelErro');
    const API = '/.netlify/git/github/contents/' + dados.arquivo;

    let atual = Object.assign({}, dados.publicado); // o que a lista mostra
    let base = null; // o arquivo como está no repositório
    let sha = null; // a versão dele, para não gravar por cima de outra

    const NUMEROS = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito'];

    const paraExibir = (campo, valor) =>
      campo.tipo === 'whatsapp'
        ? (formatarTelefone(String(valor).replace(/\D/g, '')) || valor)
        : valor;

    function desenharLista() {
      lista.textContent = '';
      let pendentes = 0;
      campos.forEach(function (campo) {
        const valor = String(atual[campo.chave] || '').trim();
        const est = estadoDoCampo(campo, valor);
        if (est === 'falta' || est === 'exemplo') pendentes += 1;

        const li = document.createElement('li');
        li.className = 'painel-linha';
        li.setAttribute('data-estado', est);

        const rotulo = document.createElement('span');
        rotulo.className = 'painel-rotulo';
        rotulo.textContent = campo.rotulo;

        const conteudo = document.createElement('span');
        conteudo.className = 'painel-valor';
        conteudo.textContent =
          est === 'falta' ? 'falta preencher' :
          est === 'vazio' ? 'não usado' : paraExibir(campo, valor);
        if (est === 'exemplo') {
          const marca = document.createElement('span');
          marca.className = 'painel-marca';
          marca.textContent = 'ainda é exemplo';
          conteudo.appendChild(marca);
        }

        li.appendChild(rotulo);
        li.appendChild(conteudo);
        if (campo.nota && est !== 'ok') {
          const nota = document.createElement('p');
          nota.className = 'painel-nota';
          nota.textContent = campo.nota;
          li.appendChild(nota);
        }
        lista.appendChild(li);
      });

      resumo.textContent = pendentes === 0
        ? 'Todas as informações de contato estão preenchidas.'
        : pendentes === 1
          ? 'Uma informação de contato ainda precisa da sua atenção.'
          : (NUMEROS[pendentes] || pendentes) + ' informações de contato ainda precisam da sua atenção.';
    }

    function mostrarAviso(texto, tipo) {
      aviso.textContent = texto;
      aviso.setAttribute('data-tipo', tipo || '');
      aviso.hidden = !texto;
    }

    function chamar(metodo, corpo) {
      const usuario = identity.currentUser();
      if (!usuario) return Promise.reject(Object.assign(new Error('sem sessão'), { sessao: true }));
      return usuario.jwt()
        .catch(function () {
          throw Object.assign(new Error('sessão vencida'), { sessao: true });
        })
        .then(function (token) {
          return fetch(API + (metodo === 'GET' ? '?ref=' + dados.ramo : ''), {
            method: metodo,
            cache: 'no-store',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: corpo ? JSON.stringify(corpo) : undefined,
          });
        })
        .then(function (resposta) {
          if (!resposta.ok) throw Object.assign(new Error('HTTP ' + resposta.status), { status: resposta.status });
          return resposta.json();
        });
    }

    function lerDoRepositorio() {
      return chamar('GET').then(function (r) {
        sha = r.sha;
        base = JSON.parse(deBase64(r.content));
        return base;
      });
    }

    function mensagemDoGateway(erro, acao) {
      const falha = 'Não foi possível ' + acao;
      if (erro && erro.sessao) return 'Sua sessão expirou. Saia e entre de novo.';
      const s = erro && erro.status;
      if (s === 409) {
        return 'Os dados mudaram desde que você abriu o formulário. Cancele e ' +
          'abra de novo para ver a versão atual.';
      }
      if (s === 401) return 'Sua sessão expirou. Saia e entre de novo.';
      if (s === 403 || s === 404) {
        return falha + ': o site não tem permissão para gravar no repositório ' +
          '(código ' + s + '). Avise quem cuida da parte técnica.';
      }
      if (!s) return falha + ': sem resposta do servidor. Verifique a internet e tente de novo.';
      return falha + ' (código ' + s + '). Tente de novo em instantes.';
    }

    const difere = (a, b) =>
      campos.some((c) => String(a[c.chave] || '') !== String(b[c.chave] || ''));

    /* Ao abrir, confere o repositório: se alguém salvou e a publicação ainda
       não terminou, a lista mostra o que foi salvo e avisa. Se a leitura
       falhar, a lista continua certa — mostra o que está publicado. */
    desenharLista();
    lerDoRepositorio().then(function (repo) {
      if (difere(repo, dados.publicado)) {
        atual = Object.assign({}, repo);
        desenharLista();
        mostrarAviso('Há alterações salvas que ainda estão sendo publicadas. ' +
          'O site atualiza em alguns minutos.', '');
      }
    }, function () { /* o botão Editar tenta de novo e explica o erro */ });

    /* Formulário -------------------------------------------------------- */
    function preencher(valores) {
      campos.forEach(function (campo) {
        const input = form.elements[campo.chave];
        if (!input) return;
        let v = String(valores[campo.chave] || '');
        if (campo.tipo === 'whatsapp') v = formatarTelefone(v.replace(/\D/g, ''));
        input.value = v;
        input.removeAttribute('aria-invalid');
        // Avisa a máscara do valor novo, senão ela compara com o antigo.
        if (input.type === 'tel') input.dispatchEvent(new Event('input'));
      });
    }

    function abrirFormulario() {
      mostrarAviso('', '');
      erroEl.hidden = true;
      leitura.hidden = true;
      form.hidden = false;
      const primeiro = form.elements[campos[0].chave];
      if (primeiro) primeiro.focus();
    }

    function fecharFormulario() {
      form.hidden = true;
      leitura.hidden = false;
      editar.focus();
    }

    editar.addEventListener('click', function () {
      editar.disabled = true;
      editar.textContent = 'Abrindo…';
      lerDoRepositorio()
        .then(function (repo) {
          preencher(repo);
          abrirFormulario();
        }, function (erro) {
          mostrarAviso(mensagemDoGateway(erro, 'abrir os dados'), 'erro');
        })
        .then(function () {
          editar.disabled = false;
          editar.textContent = 'Editar estas informações';
        });
    });

    cancelar.addEventListener('click', fecharFormulario);

    function coletar() {
      const novo = {};
      const erros = [];
      campos.forEach(function (campo) {
        const input = form.elements[campo.chave];
        let v = (input.value || '').trim();
        let problema = '';

        if (campo.tipo === 'whatsapp' && v) {
          let d = v.replace(/\D/g, '');
          if (d.indexOf('55') === 0 && d.length >= 12) d = d.slice(2);
          if (d.length < 10 || d.length > 11) {
            problema = 'O WhatsApp precisa do DDD e do número, como (18) 99123-4567.';
          }
          // O site guarda só os dígitos, com o código do Brasil na frente:
          // é o formato que o link do WhatsApp espera.
          v = '55' + d;
        }
        if (campo.tipo === 'tel' && v && v.replace(/\D/g, '').length < 10) {
          problema = 'O telefone precisa do DDD e do número, como (18) 3621-0000.';
        }
        if (campo.tipo === 'link' && v) {
          if (!/^https?:\/\//i.test(v)) v = 'https://' + v.replace(/^\/+/, '');
          if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(v)) {
            problema = 'O endereço do ' + campo.rotulo + ' não parece um link. Copie ' +
              'da barra do navegador, começando por https://.';
          }
        }
        if (campo.obrigatorio && !v) {
          problema = 'Preencha o campo "' + campo.rotulo + '": ele aparece no rodapé ' +
            'de todas as páginas.';
        }

        if (problema) {
          input.setAttribute('aria-invalid', 'true');
          erros.push({ input: input, texto: problema });
        } else {
          input.removeAttribute('aria-invalid');
        }
        novo[campo.chave] = v;
      });
      return { novo: novo, erros: erros };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const resultado = coletar();

      if (resultado.erros.length) {
        erroEl.textContent = resultado.erros[0].texto;
        erroEl.hidden = false;
        resultado.erros[0].input.focus();
        return;
      }
      erroEl.hidden = true;

      if (!difere(resultado.novo, base)) {
        fecharFormulario();
        mostrarAviso('Nenhum campo mudou, então não havia o que salvar.', '');
        return;
      }

      // Parte do arquivo como está no repositório: a ordem das chaves e
      // qualquer campo que o painel não conheça ficam como estavam.
      const conteudo = Object.assign({}, base, resultado.novo);

      salvar.disabled = true;
      cancelar.disabled = true;
      salvar.textContent = 'Salvando…';
      chamar('PUT', {
        message: 'Atualiza os dados de contato pelo painel',
        content: paraBase64(JSON.stringify(conteudo, null, 2) + '\n'),
        sha: sha,
        branch: dados.ramo,
      })
        .then(function (r) {
          sha = r && r.content ? r.content.sha : null;
          base = conteudo;
          atual = Object.assign({}, conteudo);
          desenharLista();
          fecharFormulario();
          mostrarAviso('Alterações salvas. O site publicado atualiza em cerca de ' +
            'dois minutos.', 'ok');
        }, function (erro) {
          erroEl.textContent = mensagemDoGateway(erro, 'salvar');
          erroEl.hidden = false;
        })
        .then(function () {
          salvar.disabled = false;
          cancelar.disabled = false;
          salvar.textContent = 'Salvar alterações';
        });
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
