#!/usr/bin/env node
/**
 * Responde a uma pergunta só: "está tudo certo?"
 *
 * Roda o build e confere se o HTML versionado na raiz corresponde ao que o
 * gerador produz a partir de src/. Se alguém editou um arquivo gerado em vez
 * do arquivo-fonte, a mudança seria apagada no próximo build — é o erro mais
 * fácil de cometer neste projeto, e o mais difícil de perceber.
 *
 * Também confere links internos e âncoras.
 *
 * Uso: npm run verificar
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// stdio ignora o stderr: no Windows o git enche a tela de avisos sobre fim de
// linha que não dizem respeito a nada que estejamos verificando.
const git = (...args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'],
  }).trim();

let problemas = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const falha = (msg) => { problemas += 1; console.log(`  FALHA ${msg}`); };

console.log('\nVerificando o site\n');

// Só interessam os arquivos que o build produz. Uma alteração em package.json
// ou em src/ é trabalho legítimo, não divergência.
const ehGerado = (f) => /^[^/]+\.html$/.test(f) || f === 'assets/js/search-index.js';

/** Arquivos gerados com diferença real de conteúdo em relação ao commit. */
const geradosAlterados = () =>
  git('--no-pager', 'diff', '--numstat')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [add, rem, arquivo] = l.split('\t');
      return { arquivo, linhas: (parseInt(add, 10) || 0) + (parseInt(rem, 10) || 0) };
    })
    .filter((d) => ehGerado(d.arquivo) && d.linhas > 0);

/* 1. Alguém editou um arquivo gerado à mão? ---------------------------- */
// Esta checagem vem ANTES do build de propósito: o build regeneraria esses
// arquivos a partir de src/ e apagaria a edição sem avisar.
const editadosAMao = geradosAlterados();
if (editadosAMao.length) {
  falha(`${editadosAMao.length} arquivo(s) gerado(s) foram editados à mão`);
  editadosAMao.forEach((d) => console.log(`    ${d.arquivo} (${d.linhas} linha(s))`));
  console.log(
    '\n  Estes arquivos são saída do build.js e serão sobrescritos no próximo\n' +
    '  `node build.js`. Leve a alteração para o arquivo correspondente em\n' +
    '  src/ antes de rodar o build, ou ela se perde.\n'
  );
} else {
  ok('nenhum arquivo gerado foi editado à mão');
}

/* 2. O build reproduz o que está versionado? --------------------------- */
try {
  execFileSync(process.execPath, ['build.js'], { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  falha('o build.js falhou — veja o erro rodando `node build.js`');
  process.exit(1);
}

// --numstat conta linhas; fim de linha diferente não aparece aqui, que é o
// que queremos: só interessa divergência de conteúdo.
// Depois do build, o que ainda difere do commit é o HTML versionado estando
// desatualizado em relação a src/ — descontado o que já foi apontado acima.
const jaApontados = new Set(editadosAMao.map((d) => d.arquivo));
const desatualizados = geradosAlterados().filter((d) => !jaApontados.has(d.arquivo));

if (desatualizados.length === 0) {
  ok('o HTML publicado corresponde aos arquivos-fonte');
} else {
  const total = desatualizados.reduce((s, d) => s + d.linhas, 0);
  falha(`${total} linha(s) do HTML versionado estão desatualizadas`);
  console.log('\n  Arquivos afetados:');
  desatualizados.forEach((d) => console.log(`    ${d.arquivo} (${d.linhas} linha(s))`));
  console.log(
    '\n  Alguém alterou src/ sem rodar o build, ou commitou um arquivo gerado\n' +
    '  editado à mão. Rode `node build.js` e commite o resultado.\n'
  );
}

/* 2. Links internos e âncoras ------------------------------------------ */
const paginas = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const ancoras = {};
for (const p of paginas) {
  const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
  ancoras[p] = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
}

const quebrados = [];
let total = 0;
for (const p of paginas) {
  const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const alvo = m[1];
    if (/^(https?:|mailto:|tel:|data:|#$)/.test(alvo)) continue;
    total += 1;
    const [arquivo, frag] = alvo.split('#');
    const destino = arquivo || p;
    if (!fs.existsSync(path.join(ROOT, destino))) {
      quebrados.push(`${p} -> ${alvo} (arquivo inexistente)`);
    } else if (frag && destino.endsWith('.html') && !ancoras[destino].has(frag)) {
      quebrados.push(`${p} -> ${alvo} (âncora inexistente)`);
    }
  }
}

if (quebrados.length === 0) {
  ok(`${total} links e recursos, nenhum quebrado`);
} else {
  falha(`${quebrados.length} link(s) quebrado(s)`);
  quebrados.slice(0, 12).forEach((q) => console.log(`    ${q}`));
}

/* 3. Sobrou algum token sem preencher? --------------------------------- */
const pendentes = new Set();
for (const p of paginas) {
  const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
  for (const m of html.matchAll(/\{\{[A-Z_]+\}\}/g)) pendentes.add(m[0]);
}
if (pendentes.size === 0) ok('nenhum token pendente no HTML');
else falha(`tokens sem preencher: ${[...pendentes].join(', ')}`);

/* --------------------------------------------------------------------- */
console.log(
  problemas === 0
    ? `\n${paginas.length} páginas verificadas — está tudo certo.\n`
    : `\n${problemas} problema(s) encontrado(s).\n`
);
process.exit(problemas === 0 ? 0 : 1);
