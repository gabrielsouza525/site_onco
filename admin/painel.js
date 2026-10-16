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

    /* Importar de PDF ------------------------------------------------------
       O PDF é lido aqui mesmo, no navegador, com o PDF.js da Mozilla: o
       arquivo não vai para o servidor. A versão é fixa e o conteúdo baixado é
       conferido pela assinatura (SRI) — se o CDN entregar qualquer outra
       coisa, o navegador recusa e nada roda dentro do painel. As assinaturas
       foram conferidas contra o pacote oficial (pdfjs-dist) no npm. */
    const caixaImportar = formArtigo.querySelector('[data-importar]');
    const campoPdf = document.getElementById('importarPdf');
    if (caixaImportar && campoPdf && window.fetch && window.Blob) {
      caixaImportar.hidden = false;
      const situacaoPdf = document.getElementById('importarPdf-situacao');
      const dizerPdf = function (texto) { if (situacaoPdf) situacaoPdf.textContent = texto; };
      const MAX_PAGINAS = 80;

      const PDFJS = {
        base: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/',
        principal: ['pdf.min.mjs', 'sha384-QCvhu/UPp22U/TNLVbQNONL82ES2yY717GAiqP9VVu37Y7+m9VPKvadGx9XlFvcp'],
        worker: ['pdf.worker.min.mjs', 'sha384-NfW/OTMWezITv4oaALvfH7MFLwzPxEvpySmDpoALa1mtTY8MC200l0ZNFD+SOlrM'],
      };

      // Baixa uma vez só; um erro de rede deixa tentar de novo.
      let carregando = null;
      const carregarPdfJs = function () {
        if (!carregando) {
          const buscar = async function (par) {
            const resposta = await fetch(PDFJS.base + par[0], { integrity: par[1], credentials: 'omit' });
            if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
            return URL.createObjectURL(new Blob([await resposta.blob()], { type: 'text/javascript' }));
          };
          carregando = Promise.all([buscar(PDFJS.principal), buscar(PDFJS.worker)])
            .then(async function (enderecos) {
              const pdfjs = await import(enderecos[0]);
              pdfjs.GlobalWorkerOptions.workerSrc = enderecos[1];
              return pdfjs;
            })
            .catch(function (erro) {
              carregando = null;
              throw Object.assign(erro, { carregar: true });
            });
        }
        return carregando;
      };

      /* 1. Linhas: o PDF.js entrega pedaços de texto com posição e tamanho. */
      const extrairLinhas = async function (doc) {
        const linhas = [];
        for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGINAS); p++) {
          const pagina = await doc.getPage(p);
          const conteudo = await pagina.getTextContent();
          let atual = null;
          const fechar = function () {
            if (atual) {
              const texto = atual.partes.join('').replace(/\s+/g, ' ').trim();
              if (texto) linhas.push({ texto: texto, tamanho: atual.tamanho, y: atual.y, x: atual.x, pagina: p });
            }
            atual = null;
          };
          conteudo.items.forEach(function (item) {
            if (typeof item.str !== 'string') return;
            const tamanho = Math.hypot(item.transform[2], item.transform[3]) || item.height || 0;
            const y = item.transform[5];
            const temTexto = item.str.trim() !== '';
            if (atual && temTexto && Math.abs(y - atual.y) > Math.max(atual.tamanho, tamanho) * 0.4) fechar();
            if (!atual) {
              if (!temTexto) return;
              atual = { partes: [], tamanho: 0, y: y, x: item.transform[4] };
            }
            atual.partes.push(item.str);
            if (temTexto) atual.tamanho = Math.max(atual.tamanho, tamanho);
            if (item.hasEOL) fechar();
          });
          fechar();
        }
        return linhas;
      };

      /* 2. Fora: número de página e cabeçalho/rodapé repetido nas páginas. */
      const limpar = function (linhas, paginas) {
        const vezes = new Map();
        linhas.forEach(function (l) { vezes.set(l.texto, (vezes.get(l.texto) || 0) + 1); });
        const repetida = Math.max(2, Math.ceil(paginas * 0.6));
        return linhas.filter(function (l) {
          if (/^\d{1,4}$/.test(l.texto)) return false;
          return !(paginas >= 2 && l.texto.length < 120 && vezes.get(l.texto) >= repetida);
        });
      };

      /* O tamanho de letra mais usado (contado por caractere) é o do corpo. */
      const tamanhoDoCorpo = function (linhas) {
        const peso = new Map();
        linhas.forEach(function (l) {
          const t = Math.round(l.tamanho * 2) / 2;
          peso.set(t, (peso.get(t) || 0) + l.texto.length);
        });
        let corpo = 0;
        let maior = -1;
        peso.forEach(function (p, t) { if (p > maior) { maior = p; corpo = t; } });
        return corpo || 11;
      };

      /* Linha que termina em "palavra-" continua na seguinte: junta sem o hífen. */
      const juntar = function (a, b) {
        return /[A-Za-zÀ-ÿ]-$/.test(a) && /^[a-zà-ÿ]/.test(b) ? a.slice(0, -1) + b : a + ' ' + b;
      };

      /* 3. Título, subtítulos, listas e parágrafos, no formato do editor. */
      const montar = function (linhas) {
        const corpo = tamanhoDoCorpo(linhas);
        const intervalos = [];
        for (let i = 1; i < linhas.length; i++) {
          const a = linhas[i - 1];
          const b = linhas[i];
          if (a.pagina === b.pagina && Math.abs(a.tamanho - corpo) < 0.6 && Math.abs(b.tamanho - corpo) < 0.6 && a.y > b.y) {
            intervalos.push(a.y - b.y);
          }
        }
        intervalos.sort(function (a, b) { return a - b; });
        const entrelinha = intervalos.length ? intervalos[Math.floor(intervalos.length / 2)] : corpo * 1.4;

        // Título: as primeiras linhas, se forem bem maiores que o corpo.
        let titulo = '';
        let inicio = 0;
        if (linhas.length && linhas[0].tamanho >= corpo * 1.3) {
          const t = linhas[0].tamanho;
          while (inicio < linhas.length && Math.abs(linhas[inicio].tamanho - t) < 0.5 && linhas[inicio].pagina === linhas[0].pagina) {
            titulo = titulo ? juntar(titulo, linhas[inicio].texto) : linhas[inicio].texto;
            inicio++;
          }
        }

        const blocos = [];
        let anterior = null;
        for (let i = inicio; i < linhas.length; i++) {
          const l = linhas[i];
          const ultimo = blocos[blocos.length - 1];
          const relativo = l.tamanho / corpo;
          const marcador = /^[•◦▪▫●○■□►▶–—*-]\s+/.exec(l.texto);
          // Novo bloco: espaço maior que o normal entre as linhas; na virada de
          // página, só se a frase anterior tiver terminado.
          const quebra = !anterior || (l.pagina !== anterior.pagina
            ? /[.!?:]$/.test(anterior.texto)
            : anterior.y - l.y > entrelinha * 1.45);

          if (relativo >= 1.1 && l.texto.length < 120) {
            const tipo = relativo >= 1.25 ? 'h2' : 'h3';
            const continua = ultimo && ultimo.tipo === tipo && anterior && anterior.pagina === l.pagina &&
              Math.abs(anterior.tamanho - l.tamanho) < 0.5 && anterior.y - l.y < l.tamanho * 1.6;
            if (continua) ultimo.texto = juntar(ultimo.texto, l.texto);
            else blocos.push({ tipo: tipo, texto: l.texto, x: l.x });
          } else if (marcador) {
            blocos.push({ tipo: 'li', texto: l.texto.slice(marcador[0].length), x: l.x });
          } else if (ultimo && ultimo.tipo === 'li' && !quebra && l.x > ultimo.x + 1) {
            ultimo.texto = juntar(ultimo.texto, l.texto); // linha recuada: continuação do item
          } else if (ultimo && ultimo.tipo === 'p' && !quebra) {
            ultimo.texto = juntar(ultimo.texto, l.texto);
          } else {
            blocos.push({ tipo: 'p', texto: l.texto, x: l.x });
          }
          anterior = l;
        }

        let texto = '';
        blocos.forEach(function (b, i) {
          const prefixo = { h2: '## ', h3: '### ', li: '- ', p: '' }[b.tipo];
          if (i > 0) texto += b.tipo === 'li' && blocos[i - 1].tipo === 'li' ? '\n' : '\n\n';
          texto += prefixo + b.texto;
        });
        const primeiro = blocos.find(function (b) { return b.tipo === 'p'; });
        return { titulo: titulo, texto: texto, primeiroParagrafo: primeiro ? primeiro.texto : '' };
      };

      /* Resumo: frases inteiras do primeiro parágrafo, até 280 caracteres. */
      const resumoDe = function (paragrafo) {
        if (paragrafo.length <= 280) return paragrafo;
        let resumo = '';
        (paragrafo.match(/[^.!?]+[.!?]+/g) || []).some(function (frase) {
          if ((resumo + frase).trim().length > 280) return true;
          resumo += frase;
          return false;
        });
        return resumo.trim() || paragrafo.slice(0, 277).trim() + '…';
      };

      const motivo = function (erro) {
        if (erro && erro.tipo) return 'Escolha um arquivo PDF.';
        if (erro && erro.carregar) return 'Não foi possível carregar o leitor de PDF. Verifique a internet e tente de novo.';
        if (erro && erro.name === 'PasswordException') return 'Este PDF tem senha. Abra-o, salve uma cópia sem senha e tente de novo.';
        if (erro && erro.name === 'InvalidPDFException') return 'Este arquivo não é um PDF válido, ou está corrompido.';
        return 'Não foi possível ler este PDF.';
      };

      campoPdf.addEventListener('change', async function () {
        const arquivo = campoPdf.files && campoPdf.files[0];
        if (!arquivo) return;
        const campoTexto = formArtigo.querySelector('[data-previa-campo="corpo"]');
        if (campoTexto.value.trim() && !window.confirm('O campo Texto já tem conteúdo. Trocar pelo texto do PDF?')) {
          campoPdf.value = '';
          return;
        }

        caixaImportar.setAttribute('data-lendo', '');
        dizerPdf('Lendo o PDF…');
        try {
          if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== 'application/pdf') {
            throw Object.assign(new Error('não é PDF'), { tipo: true });
          }
          const pdfjs = await carregarPdfJs();
          const doc = await pdfjs.getDocument({
            data: new Uint8Array(await arquivo.arrayBuffer()),
            isEvalSupported: false, // só texto: nada de código vindo do arquivo
          }).promise;
          const paginas = Math.min(doc.numPages, MAX_PAGINAS);
          const linhas = limpar(await extrairLinhas(doc), paginas);
          if (!linhas.length) {
            dizerPdf('Este PDF não tem texto para copiar: parece uma digitalização (uma foto do papel). ' +
              'Nesse caso, o texto precisa ser digitado.');
            return;
          }

          const lido = montar(linhas);
          campoTexto.value = lido.texto;
          const campoTitulo = formArtigo.querySelector('[data-previa-campo="titulo"]');
          const campoResumo = formArtigo.querySelector('[data-previa-campo="resumo"]');
          if (lido.titulo && campoTitulo && !campoTitulo.value.trim()) campoTitulo.value = lido.titulo.slice(0, 140);
          if (lido.primeiroParagrafo && campoResumo && !campoResumo.value.trim()) campoResumo.value = resumoDe(lido.primeiroParagrafo);
          formArtigo.dispatchEvent(new Event('input')); // atualiza a prévia

          const palavras = lido.texto.split(/\s+/).filter(Boolean).length;
          dizerPdf('Pronto: ' + doc.numPages + (doc.numPages === 1 ? ' página, ' : ' páginas, ') + palavras +
            ' palavras. Confira antes de salvar: títulos e listas são reconhecidos pelo formato do PDF e podem precisar de ajuste.' +
            (doc.numPages > MAX_PAGINAS ? ' Só as primeiras ' + MAX_PAGINAS + ' páginas foram importadas.' : ''));
        } catch (erro) {
          dizerPdf(motivo(erro));
        } finally {
          caixaImportar.removeAttribute('data-lendo');
          campoPdf.value = ''; // deixa escolher o mesmo arquivo de novo
        }
      });
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
