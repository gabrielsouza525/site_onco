/**
 * Base de conhecimento do assistente virtual, gerada a partir do próprio site.
 *
 * O build chama gerarConhecimento() e grava o resultado em
 * assistente/inc/conhecimento.md, que o assistente (PHP) envia à IA junto com
 * as regras. Assim o assistente responde com o texto real das páginas, e uma
 * página alterada em src/ atualiza a base no próximo build, sem ninguém
 * precisar lembrar.
 *
 * O que fica de fora de propósito:
 *   - dados de contato ({{TELEFONE}} e afins): o PHP acrescenta os reais, e só
 *     quando não são de exemplo — ver assistente/inc/assistente.php;
 *   - a lista de artigos: muda pelo painel, então o PHP também a acrescenta;
 *   - formulários, menus, ícones e as páginas de busca e de erro.
 */

/* Páginas fixas que entram na base com o texto inteiro, nesta ordem. A
   inicial fica só com o resumo: ela é um apanhado das outras. */
const PAGINAS_DA_BASE = ['sobre', 'atuacao', 'jornada', 'prevencao', 'contato'];

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', laquo: '«', raquo: '»',
};

function decodificar(texto) {
  return texto
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nome) => (nome in ENTIDADES ? ENTIDADES[nome] : m));
}

/** Endereço interno que vale citar: "prevencao.html" ou "prevencao.html#sinais". */
const ehEnderecoInterno = (href) => /^[a-z0-9-]+\.html(#[a-z0-9-]+)?$/.test(href);

/**
 * HTML de uma página (o conteúdo de src/pages/<slug>.html) em texto corrido,
 * com os subtítulos marcados e o endereço de cada seção que tem âncora.
 */
function textoDaPagina(html, slug) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '') // índice da página e atalhos repetidos
    .replace(/<ol class="breadcrumb">[\s\S]*?<\/ol>/gi, '')
    .replace(/<p class="eyebrow">[\s\S]*?<\/p>/gi, '')
    .replace(/<h1[\s\S]*?<\/h1>/gi, '') // o título da página já vai no cabeçalho
    .replace(/<span class="num">[\s\S]*?<\/span>/gi, '');

  // Seções com âncora: o endereço vai junto do subtítulo seguinte.
  h = h.replace(/<(section|div|article|aside)\b[^>]*\sid="([a-z0-9-]+)"[^>]*>/gi,
    (m, tag, id) => `\n@@ancora:${id}@@\n`);

  // Links internos ficam com o endereço entre parênteses.
  h = h.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, texto) => {
    const t = texto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return ehEnderecoInterno(href) && href !== `${slug}.html` ? `${t} (${href})` : t;
  });

  h = h
    .replace(/<\/?(strong|em|b|i|span|small|abbr|mark|time)\b[^>]*>/gi, '')
    .replace(/<summary\b[^>]*>/gi, '\nPergunta: ')
    .replace(/<h2\b[^>]*>/gi, '\n\n### ')
    .replace(/<h[34]\b[^>]*>/gi, '\n\n#### ')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|ul|ol|li|section|article|aside|blockquote|figure|figcaption|dl|dt|dd|table|tr)>/gi, '\n')
    .replace(/<(p|div|blockquote|figure|dt|dd|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const linhas = [];
  let ancora = null;
  for (const bruta of decodificar(h).split('\n')) {
    const linha = bruta.replace(/\s+/g, ' ').trim();
    const marca = /^@@ancora:([a-z0-9-]+)@@$/.exec(linha);
    if (marca) { ancora = marca[1]; continue; }
    // Linha com dado de contato ainda em token: o PHP cuida desses dados.
    // Numeração decorativa ("01", "02 / 05") também sai.
    if (!linha || linha.includes('{{') || /^(-|#{3,4}|[\d\s/·]+)$/.test(linha)) continue;
    if (/^#{3,4} /.test(linha)) {
      linhas.push('', ancora ? `${linha} (${slug}.html#${ancora})` : linha);
      ancora = null;
      continue;
    }
    linhas.push(linha);
  }

  // Subtítulo que ficou sem nada embaixo (o conteúdo era um dado de contato)
  // sai junto: o que vem depois dele é outro subtítulo do mesmo nível ou acima.
  const nivel = (l) => (/^(#{3,4}) /.exec(l || '') || [, ''])[1].length;
  const final = linhas.filter((l, i) => {
    if (!nivel(l)) return true;
    const seguinte = linhas.slice(i + 1).find((x) => x !== '');
    return seguinte !== undefined && !(nivel(seguinte) && nivel(seguinte) <= nivel(l));
  });
  return final.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const lista = (itens) => itens.map((i) => String(i).trim().replace(/\.$/, '')).join('; ') + '.';

function blocoDoCancer(c) {
  return [
    `### ${c.nome} (cancer-${c.slug}.html)`,
    `Grupo: ${c.grupo}.`,
    `Resumo: ${c.resumo}`,
    `Sinais e sintomas possíveis: ${lista(c.sintomas)}`,
    `Fatores de risco: ${lista(c.risco)}`,
    `Como o diagnóstico costuma ser feito: ${lista(c.diagnostico)}`,
    `Modalidades de tratamento, em geral: ${lista(c.tratamento)}`,
    `Prevenção: ${lista(c.prevencao)}`,
    c.rastreamento ? `Rastreamento: ${c.rastreamento}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * @param {object} p
 * @param {Array}  p.paginas  o mapa de páginas do build (PAGES)
 * @param {Array}  p.cancers  src/data/cancers.js
 * @param {(slug: string) => string} p.lerPagina  conteúdo de src/pages/<slug>.html
 */
function gerarConhecimento({ paginas, cancers, lerPagina }) {
  const partes = [
    '# Base de conhecimento do site',
    '',
    'Texto das páginas do site, organizado por página: assunto, pontos principais e endereço.',
    'Os endereços são relativos ao site (por exemplo, prevencao.html) e são os únicos que podem ser indicados.',
  ];

  const inicio = paginas.find((x) => x.slug === 'index');
  if (inicio) {
    partes.push('', `## ${inicio.searchTitle} (index.html)`, `Assunto: ${inicio.description}`);
  }

  for (const slug of PAGINAS_DA_BASE) {
    const p = paginas.find((x) => x.slug === slug);
    if (!p) continue;
    partes.push(
      '',
      `## ${p.searchTitle || p.title} (${slug}.html)`,
      `Assunto: ${p.description}`,
      '',
      textoDaPagina(lerPagina(slug), slug)
    );
  }

  const artigos = paginas.find((x) => x.slug === 'artigos');
  if (artigos) {
    partes.push(
      '',
      `## ${artigos.searchTitle} (artigos.html)`,
      `Assunto: ${artigos.description}`,
      'A lista dos artigos publicados está na seção "Artigos publicados", mais abaixo.'
    );
  }

  const hub = paginas.find((x) => x.slug === 'tipos-de-cancer');
  partes.push(
    '',
    `## Tipos de câncer (tipos-de-cancer.html)`,
    `Assunto: ${hub ? hub.description : 'Sintomas, fatores de risco, diagnóstico, tratamento e prevenção de cada tipo.'}`,
    `O site tem uma página para cada um dos ${cancers.length} tipos abaixo, com sintomas, fatores de risco, diagnóstico, tratamento e prevenção. ` +
      'As informações são gerais e educativas: não servem para avaliar o caso de uma pessoa.'
  );
  for (const c of cancers) partes.push('', blocoDoCancer(c));

  return partes.join('\n') + '\n';
}

module.exports = { gerarConhecimento, textoDaPagina };
