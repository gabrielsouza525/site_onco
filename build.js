#!/usr/bin/env node
/**
 * Gerador estático do site do Dr. Bruno Kersten.
 *
 * Monta cada página a partir de `src/layout.html` + `src/partials/*.html`
 * + `src/pages/<slug>.html` e grava o HTML final na raiz do projeto, de
 * modo que o site possa ser publicado em qualquer hospedagem estática
 * (GitHub Pages, Netlify, S3, hospedagem tradicional) sem dependências.
 *
 * Uso: npm run build   (ou: node build.js)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const CANCERS = require('./src/data/cancers');
// Dados de contato e redes, editaveis pelo CMS sem mexer em codigo.
const SITE = require('./src/data/site.json');

/* --------------------------------------------------------------------------
 * Mapa de páginas
 * `nav` marca o item de menu ativo; `search` alimenta o índice de busca.
 * ------------------------------------------------------------------------ */
const PAGES = [
  {
    slug: 'index',
    nav: 'home',
    title: 'Dr. Bruno Kersten — Oncologia Clínica em Araçatuba/SP',
    description:
      'Cuidado oncológico atento, humano e baseado em evidências. Diagnóstico, tratamento e acompanhamento de pacientes com câncer em Araçatuba/SP.',
    searchTitle: 'Página inicial',
    section: 'Início',
    keywords: 'oncologista araçatuba consulta oncológica câncer tratamento início home',
    headExtra: `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Physician",
    "name": "Dr. Bruno Kersten",
    "medicalSpecialty": "Oncologic",
    "description": "Médico oncologista com atuação em diagnóstico, tratamento e acompanhamento de pacientes com câncer.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Araçatuba",
      "addressRegion": "SP",
      "addressCountry": "BR"
    },
    "openingHours": "Mo-Fr 08:00-18:00"
  }
  </script>`,
  },
  {
    slug: 'sobre',
    nav: 'sobre',
    title: 'Sobre o Dr. Bruno Kersten — trajetória e formação',
    description:
      'Conheça a trajetória do Dr. Bruno Kersten, médico oncologista dedicado ao diagnóstico, tratamento e acompanhamento de pacientes com câncer.',
    searchTitle: 'Sobre o Dr. Bruno Kersten',
    section: 'Sobre',
    keywords: 'sobre médico oncologista trajetória formação crm currículo quem é bruno kersten',
  },
  {
    slug: 'atuacao',
    nav: 'atuacao',
    title: 'Áreas de atuação — Oncologia clínica | Dr. Bruno Kersten',
    description:
      'Oncologia clínica geral, tumores de mama, gastrointestinais e geniturinários, cuidados de suporte e segunda opinião oncológica.',
    searchTitle: 'Áreas de atuação',
    section: 'Áreas de atuação',
    keywords:
      'especialidades oncologia clínica mama gastrointestinais geniturinários cuidados de suporte segunda opinião tumores',
  },
  {
    slug: 'jornada',
    nav: 'jornada',
    title: 'A jornada do cuidado — como funciona o acompanhamento',
    description:
      'Quatro etapas conduzem o acompanhamento oncológico: prevenção e rastreio, diagnóstico, tratamento e acompanhamento.',
    searchTitle: 'A jornada do cuidado',
    section: 'Jornada do cuidado',
    keywords: 'jornada etapas prevenção rastreio diagnóstico tratamento acompanhamento como funciona consulta',
  },
  {
    slug: 'prevencao',
    nav: 'prevencao',
    title: 'Prevenção e diagnóstico precoce | Dr. Bruno Kersten',
    description:
      'Sinais de alerta que merecem avaliação médica, importância dos exames de rotina e hábitos de vida que reduzem fatores de risco.',
    searchTitle: 'Prevenção e diagnóstico precoce',
    section: 'Prevenção',
    keywords:
      'prevenção diagnóstico precoce sinais de alerta nódulo caroço perda de peso sangramento tosse exames de rotina hábitos de vida rastreamento',
  },
  {
    slug: 'direitos',
    nav: 'direitos',
    title: 'Leis e direitos do paciente oncológico | Dr. Bruno Kersten',
    description:
      'Prazos de tratamento, benefícios do INSS, saque do FGTS e isenções de impostos: os direitos previstos em lei para quem tem diagnóstico de câncer.',
    searchTitle: 'Leis e direitos do paciente oncológico',
    section: 'Leis e direitos',
    keywords:
      'direitos leis paciente oncologico beneficios inss fgts pis pasep isencao imposto de renda ipi ipva bpc loas auxilio doenca aposentadoria tfd reconstrucao mamaria defensoria servico social 60 dias',
  },
  {
    slug: 'contato',
    nav: 'contato',
    title: 'Entre em contato | Dr. Bruno Kersten',
    description:
      'Fale com a equipe do Dr. Bruno Kersten para agendar consulta oncológica em Araçatuba/SP. Atendimento de segunda a sexta, das 8h às 18h.',
    searchTitle: 'Contato e agendamento',
    section: 'Contato',
    keywords: 'contato agendar consulta telefone whatsapp endereço horário araçatuba consultório localização',
  },
  {
    slug: 'login',
    nav: null,
    bare: true,
    title: 'Entrar — Área administrativa | Dr. Bruno Kersten',
    description: 'Acesso restrito à equipe responsável pelo conteúdo do site.',
    indexable: false,
    section: 'Área administrativa',
  },
  {
    slug: 'busca',
    nav: null,
    title: 'Busca no site | Dr. Bruno Kersten',
    description: 'Encontre conteúdos sobre prevenção, diagnóstico, tratamento e acompanhamento oncológico.',
    indexable: false,
    section: 'Busca',
  },
  {
    slug: '404',
    nav: null,
    title: 'Página não encontrada | Dr. Bruno Kersten',
    description: 'A página procurada não foi encontrada.',
    indexable: false,
    section: 'Erro 404',
  },
];

/* --------------------------------------------------------------------------
 * Tipos de câncer
 * Cada entrada de `src/data/cancers.js` vira uma página `cancer-<slug>.html`.
 * O conteúdo é montado aqui (não há arquivo em `src/pages/` para elas), e a
 * página-índice `tipos-de-cancer.html` recebe o seletor com todas as opções.
 * ------------------------------------------------------------------------ */

const TOKEN_SELETOR = '{{SELETOR_CANCER}}';

/* Tokens preenchidos a partir de src/data/site.json. Uma rede social sem
   endereco vira '#', para o link nao apontar para lugar nenhum. */
const rede = (v) => (v && v.trim()) ? v.trim() : '#';
const TOKENS_SITE = {
  TELEFONE: SITE.telefone || '',
  ENDERECO: SITE.endereco || '',
  CIDADE: SITE.cidade || '',
  HORARIO: SITE.horario || '',
  INSTAGRAM: rede(SITE.instagram),
  FACEBOOK: rede(SITE.facebook),
  LINKEDIN: rede(SITE.linkedin),
  // O campo guarda so os digitos (ex.: 5518991234567). Daqui saem duas
  // coisas: o link do icone no rodape e o numero que os formularios usam.
  WHATSAPP: SITE.whatsapp ? `https://wa.me/${String(SITE.whatsapp).replace(/\D/g, '')}` : '#',
  WHATSAPP_NUMERO: SITE.whatsapp ? String(SITE.whatsapp).replace(/\D/g, '') : '',
};

/** Troca os {{TOKENS}} do site, sem tocar nos demais. */
function aplicarTokensSite(html) {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(TOKENS_SITE, k) ? TOKENS_SITE[k] : m
  );
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const lista = (itens, classe) =>
  `<ul${classe ? ` class="${classe}"` : ''}>` +
  itens.map((i) => `<li>${esc(i)}</li>`).join('') +
  `</ul>`;

/** Seletor de tipo de câncer, agrupado por região do corpo. */
function seletor(atual, id) {
  const grupos = [];
  for (const c of CANCERS) {
    let g = grupos.find((x) => x.nome === c.grupo);
    if (!g) { g = { nome: c.grupo, itens: [] }; grupos.push(g); }
    g.itens.push(c);
  }
  const opts = grupos
    .map(
      (g) =>
        `<optgroup label="${esc(g.nome)}">` +
        g.itens
          .map(
            (c) =>
              `<option value="cancer-${c.slug}.html"${c.slug === atual ? ' selected' : ''}>${esc(c.nome)}</option>`
          )
          .join('') +
        `</optgroup>`
    )
    .join('');
  return (
    `<div class="field cancer-picker">` +
    `<label for="${id}">Selecione o tipo de câncer</label>` +
    `<select id="${id}" data-cancer-select>` +
    `<option value="">Selecione…</option>${opts}</select>` +
    `<p class="field-hint">São ${CANCERS.length} tipos. A página abre ao escolher.</p>` +
    `</div>`
  );
}

const AVISO =
  `<div class="alert-box" style="margin-top:30px;">` +
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17v.01"/></svg>` +
  `<p>Este conteúdo é <strong>educativo</strong> e descreve situações gerais. Ele não ` +
  `estabelece diagnóstico nem substitui a avaliação médica individual. Sintomas ` +
  `semelhantes aos descritos aqui têm, na maioria das vezes, causas benignas — o que ` +
  `define a conduta é a consulta.</p></div>`;

/** Página de um tipo de câncer. */
function paginaCancer(c) {
  const outros = CANCERS.filter((o) => o.grupo === c.grupo && o.slug !== c.slug).slice(0, 4);
  const relacionados = outros.length
    ? `<div class="side-box"><h3>Outros tipos em ${esc(c.grupo.toLowerCase())}</h3><ul class="side-nav">` +
      outros.map((o) => `<li><a href="cancer-${o.slug}.html">${esc(o.nome)}</a></li>`).join('') +
      `</ul></div>`
    : '';

  return `<div class="page-head">
  <div class="wrap">
    <ol class="breadcrumb">
      <li><a href="index.html">Início</a></li>
      <li><a href="tipos-de-cancer.html">Tipos de câncer</a></li>
      <li aria-current="page">${esc(c.nome)}</li>
    </ol>
    <p class="eyebrow">${esc(c.grupo)}</p>
    <h1>${esc(c.nome)}</h1>
    <p class="lead">${esc(c.resumo)}</p>
  </div>
</div>

<section class="section">
  <div class="wrap">
    <div class="content-layout">
      <article class="prose">
        <div class="article-meta">
          <span class="chip chip--pink">Tipos de câncer</span>
          <span>Conteúdo educativo</span>
        </div>

        <div class="key-points">
          <h2>Em resumo</h2>
          <ul>
            <li>${esc(c.resumo)}</li>
            <li>Sinais persistentes por mais de duas ou três semanas merecem avaliação médica.</li>
            <li>O tratamento é definido caso a caso, conforme o tipo, o estágio e as condições de saúde.</li>
          </ul>
        </div>

        <h2 id="sintomas">Sintomas e sinais de alerta</h2>
        <p>
          Nenhum sinal isolado significa que a pessoa tem câncer — a maioria tem causas benignas.
          O que pede avaliação é a <strong>persistência</strong>: queixas que não melhoram,
          que voltam com frequência ou que mudam de padrão.
        </p>
        ${lista(c.sintomas, 'signs-list-plain')}

        <h2 id="risco">Fatores de risco</h2>
        <p>
          Ter um fator de risco não significa que a doença vá aparecer, assim como sua ausência
          não a descarta. Eles ajudam a definir quem se beneficia de acompanhamento mais próximo.
        </p>
        ${lista(c.risco)}

        <h2 id="diagnostico">Como o diagnóstico é feito</h2>
        ${lista(c.diagnostico)}

        <h2 id="tratamento">Tratamento</h2>
        <p>
          As modalidades abaixo podem ser usadas isoladamente ou combinadas. A escolha depende do
          estágio, das características do tumor e das condições clínicas de cada pessoa.
        </p>
        ${lista(c.tratamento)}

        <h2 id="prevencao">Como prevenir</h2>
        ${lista(c.prevencao)}
${
  c.rastreamento
    ? `
        <div class="alert-box alert-box--blue" style="margin-top:26px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.6 3.4 8.3 8 9 4.6-.7 8-4.4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>
          <p><strong>Rastreamento:</strong> ${esc(c.rastreamento)}</p>
        </div>`
    : ''
}
        ${AVISO}
      </article>

      <aside class="sidebar">
        <div class="side-box side-box--cta">
          <h3>Converse sobre seu caso</h3>
          <p>Uma consulta define quais exames fazem sentido para o seu histórico e com que frequência.</p>
          <a href="contato.html" class="btn btn--primary btn--sm btn--block">Entre em contato</a>
        </div>

        <div class="side-box">
          <h3>Ver outro tipo</h3>
          ${seletor(c.slug, `seletor-${c.slug}`)}
        </div>

        ${relacionados}

        <div class="side-box">
          <h3>Leia também</h3>
          <ul class="side-nav">
            <li><a href="prevencao.html#sinais">Sinais de alerta</a></li>
            <li><a href="prevencao.html#exames">Exames de rotina e rastreamento</a></li>
            <li><a href="direitos.html">Leis e direitos do paciente</a></li>
            <li><a href="jornada.html">A jornada do cuidado</a></li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</section>`;
}

/** Página-índice: o seletor dá acesso a todos os tipos; o texto se detém nos
 *  três mais frequentes, em prosa — sem cartões. */
function paginaHub() {
  const destaques = CANCERS.filter((c) => c.destaque);

  const blocos = destaques
    .map(
      (c) => `
        <h2 id="${esc(c.slug)}">${esc(c.nome)}</h2>
        <p>${esc(c.destaque)}</p>
        <p><a class="arrow-link" href="cancer-${c.slug}.html">Sintomas, tratamento e prevenção</a></p>`
    )
    .join('');

  return `<div class="page-head">
  <div class="wrap">
    <ol class="breadcrumb">
      <li><a href="index.html">Início</a></li>
      <li aria-current="page">Tipos de câncer</li>
    </ol>
    <p class="eyebrow">Selecione o</p>
    <h1>Tipo de câncer</h1>
    <p class="lead">
      Escolha um tipo para ver os sintomas que merecem atenção, como o diagnóstico é conduzido,
      quais são as modalidades de tratamento e o que reduz o risco.
    </p>
    <div class="picker-shell">
      ${seletor(null, 'seletor-topo')}
    </div>
  </div>
</div>

<section class="section">
  <div class="wrap">
    <div class="content-layout">
      <article class="prose">
        <p class="lead">
          Entre os ${CANCERS.length} tipos reunidos aqui, três respondem pela maior parte dos
          diagnósticos no Brasil. Vale conhecê-los mesmo que não sejam o motivo da sua busca —
          são também aqueles em que o diagnóstico precoce mais muda o desfecho.
        </p>
${blocos}
        ${AVISO}
      </article>

      <aside class="sidebar">
        <div class="side-box side-box--cta">
          <h3>Converse sobre seu caso</h3>
          <p>Uma consulta define quais exames fazem sentido para o seu histórico e com que frequência.</p>
          <a href="contato.html" class="btn btn--primary btn--sm btn--block">Entre em contato</a>
        </div>

        <div class="side-box">
          <h3>Ver outro tipo</h3>
          ${seletor(null, 'seletor-lateral')}
        </div>

        <div class="side-box">
          <h3>Leia também</h3>
          <ul class="side-nav">
            <li><a href="prevencao.html#sinais">Sinais de alerta</a></li>
            <li><a href="prevencao.html#exames">Exames de rotina e rastreamento</a></li>
            <li><a href="direitos.html">Leis e direitos do paciente</a></li>
            <li><a href="jornada.html">A jornada do cuidado</a></li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</section>`;
}

/* Acrescenta a página-índice e uma página por tipo ao mapa de páginas. */
PAGES.push({
  slug: 'tipos-de-cancer',
  nav: 'tipos',
  title: 'Tipos de câncer — sintomas, tratamento e prevenção | Dr. Bruno Kersten',
  description:
    'Selecione o tipo de câncer e veja sintomas, fatores de risco, como o diagnóstico é feito, as modalidades de tratamento e como prevenir.',
  searchTitle: 'Tipos de câncer',
  section: 'Tipos de câncer',
  keywords: 'tipos de cancer lista selecionar sintomas tratamento prevencao ' + CANCERS.map((c) => c.nome).join(' '),
  content: paginaHub(),
});

for (const c of CANCERS) {
  PAGES.push({
    slug: `cancer-${c.slug}`,
    nav: 'tipos',
    title: `${c.nome} — sintomas, tratamento e prevenção | Dr. Bruno Kersten`,
    description: c.resumo,
    searchTitle: c.nome,
    section: 'Tipos de câncer',
    // Os sintomas ficam fora de `keywords` de propósito: guardados à parte, a
    // busca consegue distinguir quem chegou pelo assunto de quem chegou por um
    // sintoma — e tratar os dois casos de forma diferente.
    keywords: `${c.nome} ${c.grupo} sintomas tratamento prevencao diagnostico fatores de risco`,
    sintomas: c.sintomas.join(' '),
    content: paginaCancer(c),
  });
}

/* ------------------------------------------------------------------------ */

const read = (p) => fs.readFileSync(p, 'utf8');

/** Substitui {{CHAVE}} pelos valores informados. */
function applyTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ''
  );
}

/** Marca no menu o item correspondente à página atual. */
function markActiveNav(html, nav) {
  if (!nav) return html.replace(/ data-nav="[\w-]+"/g, '');
  return html.replace(/ data-nav="([\w-]+)"/g, (match, name) =>
    name === nav ? ' aria-current="page"' : ''
  );
}

function buildSearchIndex() {
  const entries = PAGES.filter((p) => p.indexable !== false).map((p) => ({
    title: p.searchTitle || p.title,
    url: `${p.slug}.html`,
    section: p.section,
    description: p.description,
    keywords: p.keywords || '',
    sintomas: p.sintomas || '',
  }));

  const file = `/* Gerado automaticamente por build.js — não editar à mão. */
window.SEARCH_INDEX = ${JSON.stringify(entries, null, 2)};
`;
  fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'search-index.js'), file);
  return entries.length;
}

function build() {
  const layout = read(path.join(SRC, 'layout.html'));
  // Layout sem cabeçalho e rodapé, para telas que ocupam a janela inteira.
  const layoutBare = read(path.join(SRC, 'layout-bare.html'));
  const header = aplicarTokensSite(read(path.join(SRC, 'partials', 'header.html')));
  // O rodapé é resolvido antes de entrar no layout: o conteúdo injetado não é
  // reprocessado pelo template, então {{YEAR}} precisa ser aplicado aqui.
  const footer = applyTemplate(aplicarTokensSite(read(path.join(SRC, 'partials', 'footer.html'))), {
    YEAR: String(new Date().getFullYear()),
  });

  let built = 0;
  for (const page of PAGES) {
    // Páginas com `content` são montadas em memória (tipos de câncer); as demais
    // vêm de um arquivo em src/pages/.
    let corpo;
    if (typeof page.content === 'string') {
      corpo = page.content.trimEnd();
    } else {
      const pageFile = path.join(SRC, 'pages', `${page.slug}.html`);
      if (!fs.existsSync(pageFile)) {
        console.warn(`  ! ignorada: src/pages/${page.slug}.html não existe`);
        continue;
      }
      corpo = aplicarTokensSite(read(pageFile).trimEnd());
      // Único token aceito no conteúdo das páginas: o seletor de tipo de câncer,
      // que precisa ser gerado a partir dos dados. Substituição por função para
      // que cifrões no HTML gerado não sejam interpretados.
      if (corpo.includes(TOKEN_SELETOR)) {
        corpo = corpo.split(TOKEN_SELETOR).join(seletor(null, `seletor-${page.slug}`));
      }
    }

    const html = applyTemplate(page.bare ? layoutBare : layout, {
      TITLE: page.title,
      DESCRIPTION: page.description,
      HEAD_EXTRA: page.headExtra || '',
      BODY_CLASS: page.slug === 'index' ? 'page-home' : `page-${page.slug}`,
      HEADER: markActiveNav(header, page.nav),
      CONTENT: corpo,
      FOOTER: footer,
      YEAR: String(new Date().getFullYear()),
      NOINDEX: page.indexable === false ? '\n  <meta name="robots" content="noindex">' : '',
    });

    fs.writeFileSync(path.join(ROOT, `${page.slug}.html`), html);
    built += 1;
  }

  // Remove páginas de tipo que existiam em builds anteriores e não estão mais
  // em src/data/cancers.js — sem isso, renomear ou desdobrar um tipo deixaria
  // um arquivo órfão publicado.
  // Todo .html da raiz é saída deste gerador, então qualquer um que não esteja
  // mais em PAGES é sobra de um build anterior.
  const esperadas = new Set(PAGES.map((p) => `${p.slug}.html`));
  let removidas = 0;
  for (const arquivo of fs.readdirSync(ROOT)) {
    if (!/\.html$/.test(arquivo)) continue;
    if (esperadas.has(arquivo)) continue;
    fs.unlinkSync(path.join(ROOT, arquivo));
    console.log(`  - removida página órfã: ${arquivo}`);
    removidas += 1;
  }

  const indexed = buildSearchIndex();
  console.log(
    `✓ ${built} páginas geradas${removidas ? ` · ${removidas} órfãs removidas` : ''} · ${indexed} itens no índice de busca`
  );
}

build();
