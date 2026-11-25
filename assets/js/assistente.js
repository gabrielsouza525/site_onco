/* ==========================================================================
   Assistente virtual — janela de conversa do site
   --------------------------------------------------------------------------
   Monta o botão e a janela, guarda a conversa só nesta aba (sessionStorage)
   e conversa com assistente/responder.php, que chama a IA no servidor. A
   chave da API nunca passa por aqui.

   Segurança: a resposta da IA nunca entra como HTML. Ela é quebrada em
   parágrafos e listas, e o texto entra sempre como texto; só viram link as
   páginas do próprio site (algo.html) e o site do CVV.
   ========================================================================== */
(function () {
  'use strict';

  /* Endereços do site calculados a partir deste arquivo (assets/js/), e não
     da página: assim funcionam em qualquer endereço — inclusive na página de
     erro 404, que a hospedagem mostra até dentro de pastas que não existem. */
  const RAIZ = (function () {
    const src = document.currentScript && document.currentScript.src;
    try { return src ? new URL('../../', src).href : ''; } catch (e) { return ''; }
  })();
  const doSite = (caminho) => RAIZ + caminho;
  const ENDERECO = doSite('assistente/responder.php');
  const CHAVE_CONVERSA = 'assistente-conversa';
  const CHAVE_REABRIR = 'assistente-reabrir';
  const MAX_CARACTERES = 800;
  const HISTORICO = 10; // mensagens enviadas a cada pergunta
  const ESPERA_MAXIMA = 30000; // o servidor desiste em 20 s; aqui, com folga

  const BOAS_VINDAS = 'Sou um assistente virtual com informações gerais. ' +
    'Não substituo uma consulta médica e não faço diagnósticos.';
  const PRIVACIDADE = 'Suas mensagens são enviadas ao Google Gemini só para gerar a resposta e não ficam ' +
    'guardadas neste site. Não escreva dados pessoais nem informações sobre a sua saúde.';
  const SUGESTOES = ['Como funciona a consulta?', 'Sinais de alerta', 'Segunda opinião'];
  const ERRO_PADRAO = 'O assistente está indisponível no momento. Tente de novo em instantes ' +
    'ou fale com a equipe pela página contato.html.';
  const ERRO_DEMORA = 'A resposta demorou mais que o esperado. Tente de novo em instantes ' +
    'ou fale com a equipe pela página contato.html.';

  const telaCheia = window.matchMedia('(max-width: 600px)');

  /* ----------------------------------------------------------------------
     Utilidades
     ---------------------------------------------------------------------- */

  /** Cria um elemento. Filhos em texto entram sempre como texto. */
  function el(tag, atributos, filhos) {
    const n = document.createElement(tag);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'class') n.className = atributos[k];
      else n.setAttribute(k, atributos[k]);
    });
    [].concat(filhos || []).forEach(function (f) {
      n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return n;
  }

  /** Ícone SVG a partir de um caminho fixo deste arquivo (nunca de texto de fora). */
  function icone(d) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  const ICONES = {
    conversa: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
    fechar: 'M6 6l12 12M18 6 6 18',
    nova: 'M4 4v6h6M20 20v-6h-6M5.6 15A7.5 7.5 0 0 0 18.4 17M18.4 9A7.5 7.5 0 0 0 5.6 7',
    enviar: 'M5 12h13M13 6l6 6-6 6',
  };

  /* sessionStorage pode faltar (janela anônima, bloqueio): sem ele, a
     conversa só não sobrevive à troca de página. */
  function ler(chave) {
    try { return window.sessionStorage.getItem(chave); } catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try {
      if (valor === null) window.sessionStorage.removeItem(chave);
      else window.sessionStorage.setItem(chave, valor);
    } catch (e) { /* segue sem guardar */ }
  }

  function carregarConversa() {
    try {
      const dados = JSON.parse(ler(CHAVE_CONVERSA) || '[]');
      return Array.isArray(dados) ? dados.filter(function (m) {
        return m && (m.papel === 'usuario' || m.papel === 'assistente') && typeof m.texto === 'string';
      }) : [];
    } catch (e) {
      return [];
    }
  }
  function salvarConversa() {
    gravar(CHAVE_CONVERSA, conversa.length ? JSON.stringify(conversa.slice(-40)) : null);
  }

  /* ----------------------------------------------------------------------
     Texto da resposta → elementos, sem HTML
     ---------------------------------------------------------------------- */

  const PAGINA_DO_SITE = /^[a-z0-9-]+\.html(#[a-z0-9-]+)?$/;
  const PADRAO_LINK = /(https:\/\/[^\s<>"']+)|\b(cvv\.org\.br)\b|\b([a-z0-9-]+\.html(?:#[a-z0-9-]+)?)/gi;

  /** Texto com os endereços transformados em link. */
  function textoComLinks(texto) {
    const frag = document.createDocumentFragment();
    let inicio = 0;
    let m;
    PADRAO_LINK.lastIndex = 0;
    while ((m = PADRAO_LINK.exec(texto))) {
      let alvo = m[0];
      // Pontuação colada no fim do endereço não faz parte dele.
      const sobra = (/[.,;:!?)\]]+$/.exec(alvo) || [''])[0];
      alvo = alvo.slice(0, alvo.length - sobra.length);
      let href = null;
      let externo = false;

      if (m[1]) {
        // Endereço completo só vira link se for do próprio site ou do CVV: um
        // endereço qualquer que a IA escreva (ou seja levada a escrever) fica
        // como texto.
        try {
          const url = new URL(alvo);
          const host = url.hostname.toLowerCase();
          if (url.protocol === 'https:' && (host === window.location.hostname ||
              host === 'cvv.org.br' || host === 'www.cvv.org.br')) {
            href = url.href;
            externo = host !== window.location.hostname;
          }
        } catch (e) { /* não é endereço válido: fica como texto */ }
      } else if (m[2]) {
        href = 'https://cvv.org.br/';
        externo = true;
      } else if (PAGINA_DO_SITE.test(alvo.toLowerCase())) {
        href = doSite(alvo.toLowerCase());
      }

      if (!href) continue;
      frag.appendChild(document.createTextNode(texto.slice(inicio, m.index)));
      const a = el('a', { href: href }, alvo);
      if (externo) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.appendChild(el('span', { class: 'visually-hidden' }, ' (abre em outra aba)'));
      } else {
        a.addEventListener('click', function () { gravar(CHAVE_REABRIR, '1'); });
      }
      frag.appendChild(a);
      inicio = m.index + alvo.length;
      PADRAO_LINK.lastIndex = inicio;
    }
    frag.appendChild(document.createTextNode(texto.slice(inicio)));
    return frag;
  }

  /** Limpa o Markdown que a IA às vezes usa mesmo instruída a não usar. */
  function semMarkdown(texto) {
    return texto
      .replace(/\r\n?/g, '\n')
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
      .replace(/\*\*|__/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/`/g, '');
  }

  /** Parágrafos e listas, montados com elementos — nada de innerHTML. */
  function blocosDaResposta(texto) {
    const frag = document.createDocumentFragment();
    semMarkdown(texto).split(/\n\s*\n/).forEach(function (bloco) {
      const linhas = bloco.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      let paragrafo = null;
      let lista = null;
      linhas.forEach(function (linha) {
        const item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(linha);
        if (item) {
          paragrafo = null;
          if (!lista) { lista = el('ul'); frag.appendChild(lista); }
          lista.appendChild(el('li', {}, textoComLinks(item[1])));
        } else {
          lista = null;
          if (paragrafo) paragrafo.appendChild(el('br'));
          else { paragrafo = el('p'); frag.appendChild(paragrafo); }
          paragrafo.appendChild(textoComLinks(linha));
        }
      });
    });
    return frag;
  }

  /* ----------------------------------------------------------------------
     Montagem
     ---------------------------------------------------------------------- */

  let conversa = carregarConversa();
  let ocupado = false;

  const botao = el('button', {
    type: 'button',
    class: 'assistente-botao',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-controls': 'assistente',
    'aria-label': 'Tire suas dúvidas com o assistente virtual',
  }, [icone(ICONES.conversa), el('span', { class: 'assistente-botao-texto' }, 'Tire suas dúvidas')]);

  const titulo = el('h2', { id: 'assistente-titulo' }, 'Assistente virtual');
  const btnNova = el('button', {
    type: 'button', class: 'assistente-acao', 'aria-label': 'Começar nova conversa', title: 'Nova conversa',
  }, icone(ICONES.nova));
  const btnFechar = el('button', {
    type: 'button', class: 'assistente-acao', 'aria-label': 'Fechar o assistente', title: 'Fechar',
  }, icone(ICONES.fechar));

  const topo = el('div', { class: 'assistente-topo' }, [
    el('span', { class: 'assistente-avatar', 'aria-hidden': 'true' }, icone(ICONES.conversa)),
    el('div', { class: 'assistente-identidade' }, [
      titulo,
      el('p', { id: 'assistente-descricao' }, 'Informações gerais · não substitui a consulta'),
    ]),
    btnNova,
    btnFechar,
  ]);

  const log = el('div', {
    class: 'assistente-conversa',
    role: 'log',
    'aria-live': 'polite',
    'aria-label': 'Conversa com o assistente',
    tabindex: '0',
  });

  const sugestoes = el('div', { class: 'assistente-sugestoes', role: 'group', 'aria-label': 'Sugestões de perguntas' },
    SUGESTOES.map(function (s) {
      const b = el('button', { type: 'button', class: 'assistente-sugestao' }, s);
      b.addEventListener('click', function () { perguntar(s); });
      return b;
    }).concat(el('a', { class: 'assistente-sugestao assistente-sugestao--contato', href: doSite('contato.html') },
      'Falar com a equipe')));

  const campo = el('textarea', {
    id: 'assistente-pergunta',
    rows: '1',
    maxlength: String(MAX_CARACTERES),
    placeholder: 'Escreva sua pergunta…',
    autocomplete: 'off',
    'aria-describedby': 'assistente-limite assistente-emergencia',
  });
  const contador = el('span', { class: 'assistente-contador', 'aria-hidden': 'true' }, '0/' + MAX_CARACTERES);
  const btnEnviar = el('button', { type: 'submit', class: 'assistente-enviar', 'aria-label': 'Enviar pergunta' },
    icone(ICONES.enviar));
  const form = el('form', { class: 'assistente-form', novalidate: '' }, [
    el('label', { for: 'assistente-pergunta', class: 'visually-hidden' }, 'Sua pergunta'),
    campo,
    btnEnviar,
    el('span', { id: 'assistente-limite', class: 'visually-hidden' },
      'Até ' + MAX_CARACTERES + ' caracteres. Enter envia; Shift e Enter pulam linha.'),
    contador,
  ]);

  const janela = el('section', {
    id: 'assistente',
    class: 'assistente',
    role: 'dialog',
    'aria-modal': 'false',
    'aria-labelledby': 'assistente-titulo',
    'aria-describedby': 'assistente-descricao',
    hidden: '',
  }, [
    topo,
    log,
    form,
    el('p', { id: 'assistente-emergencia', class: 'assistente-rodape' },
      'Em emergência, ligue 192 (SAMU) ou procure o pronto-socorro.'),
  ]);

  /* ----------------------------------------------------------------------
     Mensagens na tela
     ---------------------------------------------------------------------- */

  function mostrarMensagem(papel, texto) {
    const caixa = el('div', { class: 'assistente-msg assistente-msg--' + papel }, [
      el('span', { class: 'visually-hidden' }, papel === 'usuario' ? 'Você: ' : 'Assistente: '),
    ]);
    if (papel === 'usuario') caixa.appendChild(el('p', {}, texto));
    else caixa.appendChild(blocosDaResposta(texto));
    log.appendChild(caixa);
    return caixa;
  }

  function mostrarErro(texto) {
    const caixa = el('div', { class: 'assistente-msg assistente-msg--erro' }, [
      el('span', { class: 'visually-hidden' }, 'Aviso: '),
    ]);
    caixa.appendChild(el('p', {}, textoComLinks(texto)));
    log.appendChild(caixa);
  }

  function rolarParaOFim() {
    log.scrollTop = log.scrollHeight;
  }

  /** Começo de toda conversa: boas-vindas, aviso de privacidade e sugestões. */
  function mostrarInicio() {
    log.textContent = '';
    log.appendChild(el('div', { class: 'assistente-msg assistente-msg--assistente assistente-boas-vindas' }, [
      el('p', {}, BOAS_VINDAS),
      el('p', { class: 'assistente-privacidade' }, PRIVACIDADE),
    ]));
    log.appendChild(sugestoes);
    conversa.forEach(function (m) { mostrarMensagem(m.papel, m.texto); });
    sugestoes.hidden = conversa.length > 0;
  }

  const digitando = el('div', { class: 'assistente-msg assistente-msg--assistente assistente-digitando' }, [
    el('span', { class: 'visually-hidden' }, 'O assistente está '),
    el('span', { class: 'assistente-pontos', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]),
    'digitando…',
  ]);

  /* ----------------------------------------------------------------------
     Conversa com o servidor
     ---------------------------------------------------------------------- */

  function marcarOcupado(sim) {
    ocupado = sim;
    btnEnviar.disabled = sim;
    log.setAttribute('aria-busy', sim ? 'true' : 'false');
    sugestoes.querySelectorAll('button').forEach(function (b) { b.disabled = sim; });
  }

  function perguntar(textoBruto) {
    const texto = String(textoBruto || '').trim();
    if (ocupado || !texto) return;
    if (texto.length > MAX_CARACTERES) {
      mostrarErro('A mensagem passou de ' + MAX_CARACTERES + ' caracteres. Tente resumir a pergunta.');
      rolarParaOFim();
      return;
    }

    conversa.push({ papel: 'usuario', texto: texto });
    salvarConversa();
    sugestoes.hidden = true;
    const minhaMensagem = mostrarMensagem('usuario', texto);
    campo.value = '';
    ajustarCampo();
    marcarOcupado(true);
    log.appendChild(digitando);
    rolarParaOFim();

    const controle = 'AbortController' in window ? new AbortController() : null;
    const relogio = window.setTimeout(function () { if (controle) controle.abort(); }, ESPERA_MAXIMA);

    fetch(ENDERECO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ mensagens: conversa.slice(-HISTORICO) }),
      signal: controle ? controle.signal : undefined,
    })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (dados) {
          return { ok: r.ok, dados: dados };
        });
      })
      .then(function (res) {
        const d = res.dados || {};
        if (res.ok && typeof d.resposta === 'string' && d.resposta && typeof d.assinatura === 'string') {
          conversa.push({ papel: 'assistente', texto: d.resposta, assinatura: d.assinatura });
          salvarConversa();
          digitando.remove();
          mostrarMensagem('assistente', d.resposta);
          return;
        }
        desfazerPergunta(texto, minhaMensagem);
        // O histórico guardado não vale mais (por exemplo, a chave da API mudou):
        // a conversa recomeça, e a pergunta volta para o campo.
        if (d.codigo === 'historico') { conversa = []; salvarConversa(); }
        mostrarErro(typeof d.erro === 'string' && d.erro ? d.erro : ERRO_PADRAO);
      })
      .catch(function (erro) {
        desfazerPergunta(texto, minhaMensagem);
        mostrarErro(erro && erro.name === 'AbortError' ? ERRO_DEMORA : ERRO_PADRAO);
      })
      .then(function () {
        window.clearTimeout(relogio);
        digitando.remove();
        marcarOcupado(false);
        rolarParaOFim();
      });
  }

  /** A pergunta não teve resposta: sai da conversa e volta para o campo. */
  function desfazerPergunta(texto, mensagem) {
    const ultima = conversa[conversa.length - 1];
    if (ultima && ultima.papel === 'usuario' && ultima.texto === texto) conversa.pop();
    salvarConversa();
    mensagem.classList.add('assistente-msg--nao-enviada');
    if (!campo.value) { campo.value = texto; ajustarCampo(); }
  }

  /* ----------------------------------------------------------------------
     Abrir, fechar e teclado
     ---------------------------------------------------------------------- */

  function aplicarModo() {
    const cheia = telaCheia.matches;
    janela.setAttribute('aria-modal', cheia ? 'true' : 'false');
    document.documentElement.classList.toggle('assistente-tela-cheia', cheia && !janela.hidden);
  }

  function abrir(focar) {
    janela.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('assistente-aberto');
    aplicarModo();
    rolarParaOFim();
    if (focar !== false) campo.focus();
  }

  function fechar() {
    janela.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('assistente-aberto', 'assistente-tela-cheia');
    gravar(CHAVE_REABRIR, null);
    botao.focus();
  }

  function focaveis() {
    return Array.prototype.filter.call(
      janela.querySelectorAll('button, a[href], textarea, [tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.disabled && !n.closest('[hidden]'); }
    );
  }

  function ajustarCampo() {
    campo.style.height = 'auto';
    campo.style.height = Math.min(campo.scrollHeight, 132) + 'px';
    const n = campo.value.length;
    contador.textContent = n + '/' + MAX_CARACTERES;
    contador.classList.toggle('is-perto', n > MAX_CARACTERES - 80);
  }

  botao.addEventListener('click', function () { abrir(); });
  btnFechar.addEventListener('click', fechar);
  btnNova.addEventListener('click', function () {
    if (ocupado) return;
    conversa = [];
    salvarConversa();
    mostrarInicio();
    campo.focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    perguntar(campo.value);
  });
  campo.addEventListener('input', ajustarCampo);
  campo.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      perguntar(campo.value);
    }
  });

  janela.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
      return;
    }
    // Em tela cheia a janela cobre a página: o Tab fica preso dentro dela.
    if (e.key === 'Tab' && telaCheia.matches) {
      const lista = focaveis();
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  });

  if (telaCheia.addEventListener) telaCheia.addEventListener('change', aplicarModo);
  else if (telaCheia.addListener) telaCheia.addListener(aplicarModo);

  mostrarInicio();
  document.body.appendChild(botao);
  document.body.appendChild(janela);

  // Quem seguiu um link de dentro da conversa encontra a janela aberta na
  // página nova — só no computador: no celular ela cobriria a página.
  if (ler(CHAVE_REABRIR) && !telaCheia.matches && conversa.length) abrir(false);
  else gravar(CHAVE_REABRIR, null);
})();
