#!/usr/bin/env node
/**
 * Monta o pacote para a hospedagem (DirectAdmin): pacote/site-drbrunokersten.zip
 *
 * O que vai no zip, para extrair dentro da public_html:
 *   assets/          imagens, CSS, JS e o índice da busca
 *   admin/           o painel em PHP
 *   admin/modelos/   cada página SEM os dados de contato ({{TELEFONE}} etc.),
 *                    mais versao.json e site-inicial.json
 *
 * O HTML final não vai. Quem gera é o painel, na primeira vez que alguém o
 * abre depois do envio, aplicando os dados salvos nele. É isso que impede um
 * pacote novo de apagar o telefone que o Dr. Bruno salvou pelo painel.
 *
 * Uso: npm run pacote
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { build } = require('../build');

const ROOT = path.join(__dirname, '..');
const SAIDA = path.join(ROOT, 'pacote');
const NOME = 'site-drbrunokersten.zip';

/* Lixo que o Windows e o macOS deixam pelas pastas. */
const IGNORAR = new Set(['Thumbs.db', 'desktop.ini', '.DS_Store']);

/* 1. Páginas-modelo ------------------------------------------------------ */
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'pacote-site-'));
const modelos = path.join(temporaria, 'modelos');
build({ modelos });

const git = (comando) => {
  try {
    return execSync(`git ${comando}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    return '';
  }
};
const commit = git('rev-parse --short HEAD') || 'sem-git';
const alterado = git('status --porcelain') ? '+alteracoes' : '';
const agora = new Date();
// A data entra na versão para que todo pacote novo seja publicado, mesmo
// gerado duas vezes do mesmo commit.
const versao = `${commit}${alterado}-${agora.toISOString()}`;

fs.writeFileSync(
  path.join(modelos, 'versao.json'),
  JSON.stringify({ versao, gerado: agora.toISOString() }, null, 2) + '\n'
);
fs.copyFileSync(path.join(ROOT, 'src', 'data', 'site.json'), path.join(modelos, 'site-inicial.json'));

/* 2. O que entra no zip -------------------------------------------------- */
function listar(pasta, prefixo, filtro) {
  const saida = [];
  for (const nome of fs.readdirSync(pasta).sort()) {
    if (IGNORAR.has(nome)) continue;
    const completo = path.join(pasta, nome);
    const relativo = `${prefixo}${nome}`;
    if (fs.statSync(completo).isDirectory()) {
      saida.push(...listar(completo, `${relativo}/`, filtro));
    } else if (!filtro || filtro(relativo)) {
      saida.push({ nome: relativo, origem: completo });
    }
  }
  return saida;
}

// Da pasta admin do repositório vão só o código e os .htaccess: dados e
// modelos que alguém tenha gerado testando na própria máquina ficam de fora.
const doAdmin = (relativo) =>
  !/^admin\/(dados|modelos)\//.test(relativo) || /\/\.htaccess$/.test(relativo);

const arquivos = [
  ...listar(path.join(ROOT, 'assets'), 'assets/'),
  ...listar(path.join(ROOT, 'admin'), 'admin/', doAdmin),
  ...listar(modelos, 'admin/modelos/'),
];

/* 3. Zip ------------------------------------------------------------------ */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = TABELA_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data e hora no formato do MS-DOS, que o zip usa. */
function dataDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Zip mínimo, sem dependências. Os nomes usam "/" e as permissões vão no
 * padrão Unix (0644 para arquivos, 0755 para pastas): o servidor é Linux, e
 * uma página gravada sem permissão de leitura daria erro 403.
 */
function gerarZip(entradas) {
  const { hora, dia } = dataDos(agora);
  const locais = [];
  const central = [];
  let deslocamento = 0;

  for (const entrada of entradas) {
    const nome = Buffer.from(entrada.nome, 'utf8');
    const ehPasta = entrada.nome.endsWith('/');
    const dados = ehPasta ? Buffer.alloc(0) : entrada.dados;
    const comprimido = ehPasta ? dados : zlib.deflateRawSync(dados, { level: 9 });
    const deflate = !ehPasta && comprimido.length < dados.length;
    const corpo = deflate ? comprimido : dados;
    const crc = ehPasta ? 0 : crc32(dados);
    const metodo = deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária: 2.0
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(corpo.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nome, corpo);

    const modo = ehPasta ? 0o40755 : 0o100644;
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE((3 << 8) | 20, 4); // feito em Unix, versão 2.0
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(metodo, 10);
    c.writeUInt16LE(hora, 12);
    c.writeUInt16LE(dia, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(corpo.length, 20);
    c.writeUInt32LE(dados.length, 24);
    c.writeUInt16LE(nome.length, 28);
    c.writeUInt32LE((modo * 0x10000 + (ehPasta ? 0x10 : 0)) >>> 0, 38);
    c.writeUInt32LE(deslocamento, 42);
    central.push(c, nome);

    deslocamento += local.length + nome.length + corpo.length;
  }

  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

// Pastas entram explicitamente: alguns extratores não criam pasta sozinhos.
const pastas = new Set();
for (const { nome } of arquivos) {
  const partes = nome.split('/');
  for (let i = 1; i < partes.length; i++) pastas.add(`${partes.slice(0, i).join('/')}/`);
}

const entradas = [
  ...[...pastas].sort().map((nome) => ({ nome })),
  ...arquivos.map(({ nome, origem }) => ({ nome, dados: fs.readFileSync(origem) })),
];

fs.mkdirSync(SAIDA, { recursive: true });
const destino = path.join(SAIDA, NOME);
fs.writeFileSync(destino, gerarZip(entradas));
fs.rmSync(temporaria, { recursive: true, force: true });

const paginas = arquivos.filter((a) => /^admin\/modelos\/.+\.html$/.test(a.nome)).length;
const tamanho = (fs.statSync(destino).size / 1024 / 1024).toFixed(2);
console.log(`✓ ${path.relative(ROOT, destino)} — ${arquivos.length} arquivos, ${paginas} páginas, ${tamanho} MB`);
console.log(`  versão ${versao}`);
