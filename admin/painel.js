/* ==========================================================================
   Painel administrativo — conforto, não função.
   Tudo no painel funciona sem este arquivo; ele só mostra a senha digitada
   e pede confirmação antes de remover um acesso.
   ========================================================================== */
(function () {
  'use strict';

  /* Confirmação à vista ---------------------------------------------------
     Depois de salvar, a mensagem aparece dentro do bloco onde a ação foi
     feita, e a página volta com #bloco no endereço para o navegador rolar
     até lá. Por garantia — há navegador que restaura a rolagem antiga depois
     de um envio — a rolagem é refeita daqui, depois do primeiro quadro
     desenhado, quando a restauração já passou. */
  const confirmacao = document.querySelector('.cartao .painel-aviso');
  if (confirmacao) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const mostrar = function () {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          confirmacao.scrollIntoView({ block: 'center' });
        });
      });
    };
    if (document.readyState === 'complete') mostrar();
    else window.addEventListener('load', mostrar);
  }

  /* Mostrar / ocultar senha ------------------------------------------------ */
  document.querySelectorAll('[data-revelar]').forEach(function (botao) {
    const campo = document.getElementById(botao.getAttribute('data-revelar'));
    if (!campo) return;
    botao.addEventListener('click', function () {
      const visivel = campo.type === 'text';
      campo.type = visivel ? 'password' : 'text';
      botao.setAttribute('aria-pressed', String(!visivel));
      botao.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
      campo.focus();
    });
  });

  /* Confirmar antes de remover -------------------------------------------- */
  document.querySelectorAll('form[data-confirmar]').forEach(function (form) {
    form.addEventListener('submit', function (evento) {
      if (!window.confirm(form.getAttribute('data-confirmar'))) evento.preventDefault();
    });
  });

  /* Fotos: prévia e redução antes de enviar --------------------------------
     Foto de celular passa fácil de 5 MB, e hospedagem compartilhada costuma
     recusar envios grandes. Reduzir aqui, no navegador, resolve antes de virar
     erro — e o navegador já desvira a foto que o celular gravou deitada. Sem
     JavaScript a foto sobe como está, e o servidor faz o mesmo trabalho. */
  const LADO_MAXIMO = 2400;
  const AVISO_PREVIA = 'Prévia: a foto ainda não está no site. Clique em “Enviar foto”.';

  document.querySelectorAll('input[type="file"][data-previa]').forEach(function (campo) {
    const previa = document.getElementById(campo.getAttribute('data-previa'));
    const moldura = previa ? previa.closest('.foto-moldura') : null;
    const selo = moldura ? moldura.querySelector('.foto-selo') : null;
    const rotulo = document.querySelector('label[for="' + campo.id + '"] span');
    const situacao = document.getElementById(campo.id + '-situacao');
    const botao = campo.form ? campo.form.querySelector('button[type="submit"]') : null;
    const fotoAtual = previa ? previa.src : '';
    const seloAtual = selo ? selo.textContent : '';
    const rotuloAtual = rotulo ? rotulo.textContent : '';
    const dizer = function (texto) { if (situacao) situacao.textContent = texto; };

    const marcarPrevia = function (arquivo) {
      if (campo.form) campo.form.toggleAttribute('data-esperando', !arquivo);
      if (moldura) moldura.toggleAttribute('data-previa', !!arquivo);
      if (selo) selo.textContent = arquivo ? 'Prévia' : seloAtual;
      if (rotulo) rotulo.textContent = arquivo ? arquivo.name : rotuloAtual;
    };

    if (campo.form) campo.form.setAttribute('data-esperando', '');

    campo.addEventListener('change', function () {
      const arquivo = campo.files && campo.files[0];
      if (!arquivo) {
        if (previa) previa.src = fotoAtual;
        marcarPrevia(null);
        dizer('');
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) {
        dizer('Escolha uma foto em JPG, PNG ou WebP.');
        return;
      }

      const endereco = URL.createObjectURL(arquivo);
      if (previa) previa.src = endereco;
      marcarPrevia(arquivo);
      dizer(AVISO_PREVIA);

      const imagem = new Image();
      imagem.onload = function () {
        const maior = Math.max(imagem.naturalWidth, imagem.naturalHeight);
        const pequena = maior <= LADO_MAXIMO && arquivo.size <= 1.5 * 1024 * 1024;
        if (pequena || !window.DataTransfer || !HTMLCanvasElement.prototype.toBlob) return;

        const escala = Math.min(1, LADO_MAXIMO / maior);
        const tela = document.createElement('canvas');
        tela.width = Math.round(imagem.naturalWidth * escala);
        tela.height = Math.round(imagem.naturalHeight * escala);
        const desenho = tela.getContext('2d');
        desenho.fillStyle = '#fff'; // PNG transparente não vira fundo preto
        desenho.fillRect(0, 0, tela.width, tela.height);
        desenho.drawImage(imagem, 0, 0, tela.width, tela.height);

        if (botao) botao.disabled = true;
        dizer('Preparando a foto para enviar…');
        tela.toBlob(function (blob) {
          if (botao) botao.disabled = false;
          dizer(AVISO_PREVIA);
          if (!blob) return; // fica a foto original; o servidor reduz
          const lista = new DataTransfer();
          const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg';
          lista.items.add(new File([blob], nome, { type: 'image/jpeg' }));
          campo.files = lista.files;
        }, 'image/jpeg', 0.9);
      };
      imagem.src = endereco;
    });

    /* Arrastar a foto para cima da moldura: o mesmo que escolher. */
    if (moldura && window.DataTransfer) {
      const marcar = function (sim) { moldura.toggleAttribute('data-arrastando', sim); };
      moldura.addEventListener('dragover', function (evento) {
        evento.preventDefault();
        marcar(true);
      });
      moldura.addEventListener('dragleave', function () { marcar(false); });
      moldura.addEventListener('drop', function (evento) {
        evento.preventDefault();
        marcar(false);
        const arquivo = evento.dataTransfer && evento.dataTransfer.files[0];
        if (!arquivo) return;
        const lista = new DataTransfer();
        lista.items.add(arquivo);
        campo.files = lista.files;
        campo.dispatchEvent(new Event('change'));
      });
    }
  });

  /* Vitrine: a miniatura do site acompanha o que se digita ----------------
     Enquanto o formulário do contato está aberto, a vitrine mostra o texto
     novo antes de salvar — é a resposta para "como vai ficar?". */
  const formVitrine = document.querySelector('form[data-vitrine-form]');
  if (formVitrine) {
    const pegar = function (chave) {
      const campo = formVitrine.querySelector('[data-vitrine="' + chave + '"]');
      return campo ? campo.value.trim() : '';
    };
    const atualizar = function () {
      document.querySelectorAll('[data-vitrine-campo]').forEach(function (alvo) {
        alvo.textContent = pegar(alvo.getAttribute('data-vitrine-campo')) || '—';
      });
      document.querySelectorAll('[data-vitrine-rede]').forEach(function (rede) {
        rede.hidden = !pegar(rede.getAttribute('data-vitrine-rede'));
      });
    };
    formVitrine.addEventListener('input', atualizar);
  }

  /* Artigo: prévia que acompanha a digitação -------------------------------
     Mesmas regras de src/artigos.js e admin/inc/artigos.php, aqui só para
     mostrar como vai ficar — quem publica de verdade é o PHP. */
  const formArtigo = document.querySelector('form[data-artigo-form]');
  if (formArtigo) {
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
      'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const emLinha = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const aparar = (s) => s.replace(/^[ \t]+|[ \t]+$/g, '');

    const formatarTexto = function (corpo) {
      const saida = [];
      let tipo = null;
      let bloco = [];
      const fechar = function () {
        if (!bloco.length) return;
        if (tipo === 'p') saida.push('<p>' + bloco.map(emLinha).join('<br>') + '</p>');
        if (tipo === 'ul') saida.push('<ul>' + bloco.map((i) => '<li>' + emLinha(i) + '</li>').join('') + '</ul>');
        if (tipo === 'q') saida.push('<blockquote><p>' + bloco.map(emLinha).join('<br>') + '</p></blockquote>');
        bloco = [];
        tipo = null;
      };
      String(corpo || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (original) {
        const linha = aparar(original);
        if (linha === '') { fechar(); return; }
        if (linha.startsWith('### ')) { fechar(); saida.push('<h3>' + emLinha(aparar(linha.slice(4))) + '</h3>'); return; }
        if (linha.startsWith('## ')) { fechar(); saida.push('<h2>' + emLinha(aparar(linha.slice(3))) + '</h2>'); return; }
        let novo = 'p';
        let conteudo = linha;
        if (linha.startsWith('- ')) { novo = 'ul'; conteudo = aparar(linha.slice(2)); }
        else if (linha.startsWith('> ')) { novo = 'q'; conteudo = aparar(linha.slice(2)); }
        if (tipo !== novo) { fechar(); tipo = novo; }
        bloco.push(conteudo);
      });
      fechar();
      return saida.join('\n');
    };

    const porExtenso = function (iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      return m && MESES[Number(m[2]) - 1] ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : '';
    };

    const alvo = (nome) => document.querySelector('[data-previa-alvo="' + nome + '"]');
    const valor = (nome) => {
      const campo = formArtigo.querySelector('[data-previa-campo="' + nome + '"]');
      return campo ? campo.value : '';
    };
    const atualizar = function () {
      const titulo = alvo('titulo');
      const resumo = alvo('resumo');
      const data = alvo('data');
      const corpo = alvo('corpo');
      if (titulo) titulo.textContent = valor('titulo').trim() || 'Título do artigo';
      if (resumo) resumo.textContent = valor('resumo').trim();
      if (data) data.textContent = porExtenso(valor('data'));
      if (corpo) corpo.innerHTML = formatarTexto(valor('corpo'));
    };
    formArtigo.addEventListener('input', atualizar);

    // Escolher uma capa nova desfaz o "Tirar a capa".
    const capa = formArtigo.querySelector('input[name="capa"]');
    const remover = formArtigo.querySelector('input[name="remover_capa"]');
    if (capa && remover) {
      capa.addEventListener('change', function () { if (capa.files.length) remover.checked = false; });
    }
  }

  /* Um envio por vez: o botão trava até a página responder, para um clique
     duplo não publicar duas vezes. */
  document.querySelectorAll('.app form, .auth-card form').forEach(function (form) {
    form.addEventListener('submit', function (evento) {
      if (evento.defaultPrevented) return;
      const botao = form.querySelector('button[type="submit"]');
      if (botao) window.setTimeout(function () { botao.disabled = true; }, 0);
    });
  });
})();
