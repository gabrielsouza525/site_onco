/**
 * Artigos: do texto escrito no painel para o HTML do site.
 *
 * ATENÇÃO: admin/inc/artigos.php repete estas mesmas regras em PHP, porque o
 * painel da hospedagem publica os artigos sem passar pelo build. As duas
 * versões precisam gerar exatamente o mesmo HTML — o teste de paridade
 * compara página por página. Mudou aqui, muda lá.
 *
 * Formato do texto (o mesmo explicado no editor do painel):
 *   linha em branco      novo parágrafo
 *   ## Título            subtítulo          ### Título   subtítulo menor
 *   - item               lista
 *   > texto              quadro de destaque
 *   **palavra**          negrito
 *   quebra de linha simples dentro de um parágrafo vira <br>.
 */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/* Mesmo conjunto do htmlspecialchars com ENT_COMPAT, que o PHP usa. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escapa e aplica o negrito. */
function emLinha(texto) {
  return esc(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Só espaço e tabulação: trim() do JS também tiraria espaços Unicode. */
const aparar = (s) => s.replace(/^[ \t]+|[ \t]+$/g, '');

function formatarTexto(corpo) {
  const linhas = String(corpo || '').replace(/\r\n?/g, '\n').split('\n');
  const saida = [];
  let tipo = null;
  let bloco = [];

  const fechar = () => {
    if (!bloco.length) return;
    if (tipo === 'p') saida.push('<p>' + bloco.map(emLinha).join('<br>') + '</p>');
    if (tipo === 'ul') saida.push('<ul>' + bloco.map((i) => '<li>' + emLinha(i) + '</li>').join('') + '</ul>');
    if (tipo === 'q') saida.push('<blockquote><p>' + bloco.map(emLinha).join('<br>') + '</p></blockquote>');
    bloco = [];
    tipo = null;
  };

  for (const original of linhas) {
    const linha = aparar(original);
    if (linha === '') { fechar(); continue; }
    if (linha.startsWith('### ')) { fechar(); saida.push('<h3>' + emLinha(aparar(linha.slice(4))) + '</h3>'); continue; }
    if (linha.startsWith('## ')) { fechar(); saida.push('<h2>' + emLinha(aparar(linha.slice(3))) + '</h2>'); continue; }

    let novo = 'p';
    let conteudo = linha;
    if (linha.startsWith('- ')) { novo = 'ul'; conteudo = aparar(linha.slice(2)); }
    else if (linha.startsWith('> ')) { novo = 'q'; conteudo = aparar(linha.slice(2)); }

    if (tipo !== novo) { fechar(); tipo = novo; }
    bloco.push(conteudo);
  }
  fechar();
  return saida.join('\n');
}

/** "2026-10-16" → "16 de outubro de 2026". */
function dataPorExtenso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m || !MESES[Number(m[2]) - 1]) return '';
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** Uns 200 palavras por minuto, nunca menos de um. */
function tempoDeLeitura(corpo) {
  const palavras = String(corpo || '').split(/[ \t\r\n]+/).filter(Boolean).length;
  const minutos = Math.max(1, Math.round(palavras / 200));
  return `Leitura de ${minutos} minuto${minutos === 1 ? '' : 's'}`;
}

/**
 * Endereço da capa, ou '' quando não há uma válida. No build só existem as
 * do repositório (assets/img/...); as enviadas pelo painel (fotos/capa-...)
 * o PHP ainda confere se o arquivo existe.
 */
function caminhoDaCapa(artigo) {
  const capa = String(artigo.capa || '');
  return /^fotos\/capa-[a-f0-9]{8}\.jpg$/.test(capa) || /^assets\/img\/[a-z0-9._-]+$/.test(capa)
    ? capa : '';
}

function capaDoArtigo(artigo) {
  const capa = caminhoDaCapa(artigo);
  return capa
    ? `<figure class="artigo-capa"><img src="${esc(capa)}" alt="" width="1200" height="675"></figure>`
    : '';
}

const ICONE_ARTIGO = '<svg viewBox="0 0 100 100" fill="none" stroke="#ffb570" stroke-width="2.4" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="30" y="20" width="40" ' +
  'height="60" rx="4"/><path d="M40 34h20M40 46h20M40 58h12"/></svg>';

function cartao(artigo) {
  const url = `artigo-${esc(artigo.slug)}.html`;
  const capa = caminhoDaCapa(artigo);
  const miniatura = capa
    ? `<img src="${esc(capa)}" alt="" width="1200" height="675" loading="lazy">`
    : ICONE_ARTIGO;
  return '<article class="news-card">' +
    `<a class="news-thumb" href="${url}" tabindex="-1" aria-hidden="true">${miniatura}</a>` +
    '<div class="news-body">' +
    `<p class="news-data"><time datetime="${esc(artigo.data)}">${esc(dataPorExtenso(artigo.data))}</time></p>` +
    `<h3><a href="${url}">${esc(artigo.titulo)}</a></h3>` +
    `<p>${esc(artigo.resumo)}</p>` +
    `<a href="${url}" class="arrow-link">Ler artigo</a>` +
    '</div></article>';
}

/** Publicados, do mais novo para o mais antigo; empate fica na ordem salva. */
function publicados(artigos) {
  return artigos
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.publicado)
    .sort((x, y) => (x.a.data > y.a.data ? -1 : x.a.data < y.a.data ? 1 : x.i - y.i))
    .map(({ a }) => a);
}

function listaDeArtigos(artigos) {
  const lista = publicados(artigos);
  if (!lista.length) {
    return '<div class="artigos-vazio"><p>Em breve, os primeiros artigos estarão aqui.</p></div>';
  }
  return '<div class="news-grid">\n' + lista.map(cartao).join('\n') + '\n</div>';
}

function tokensDoArtigo(artigo) {
  return {
    ARTIGO_TITULO: esc(artigo.titulo),
    ARTIGO_RESUMO: esc(artigo.resumo),
    ARTIGO_DATA: esc(dataPorExtenso(artigo.data)),
    ARTIGO_DATA_ISO: esc(artigo.data),
    ARTIGO_LEITURA: esc(tempoDeLeitura(artigo.corpo)),
    ARTIGO_CAPA: capaDoArtigo(artigo),
    ARTIGO_CORPO: formatarTexto(artigo.corpo),
  };
}

/** Troca os tokens informados numa passada só, sem reprocessar o que entrou. */
function aplicarTokens(html, tokens) {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(tokens, k) ? tokens[k] : m);
}

function entradaDeBusca(artigo) {
  return {
    title: artigo.titulo,
    url: `artigo-${artigo.slug}.html`,
    section: 'Artigos',
    description: artigo.resumo,
    keywords: `artigo artigos ${artigo.titulo}`,
    sintomas: '',
  };
}

module.exports = {
  formatarTexto, dataPorExtenso, tempoDeLeitura, listaDeArtigos, publicados,
  tokensDoArtigo, aplicarTokens, entradaDeBusca,
};
