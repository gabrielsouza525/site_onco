<?php
/**
 * Artigos: guardar, validar e transformar o texto do painel em HTML do site.
 *
 * ATENÇÃO: src/artigos.js repete as regras de HTML daqui em JavaScript, para
 * o build gerar os artigos do repositório. As duas versões precisam sair
 * idênticas — o teste de paridade compara página por página. Mudou aqui,
 * muda lá.
 *
 * Os artigos salvos no painel ficam em artigos.json, na pasta de dados. Até
 * o primeiro salvamento, valem os que vieram no pacote (artigos-inicial.json).
 * Depois disso, só os do painel: assim um artigo excluído aqui não volta com
 * o próximo pacote.
 */

declare(strict_types=1);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ICONE_ARTIGO = '<svg viewBox="0 0 100 100" fill="none" stroke="#ffb570" stroke-width="2.4" ' .
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="30" y="20" width="40" ' .
    'height="60" rx="4"/><path d="M40 34h20M40 46h20M40 58h12"/></svg>';

/* ---------------------------------------------------------------------------
 * HTML — espelho de src/artigos.js
 * ------------------------------------------------------------------------ */

/** Mesmo conjunto do esc() do src/artigos.js: & " < > */
function escArtigo($texto): string
{
    return htmlspecialchars((string) $texto, ENT_COMPAT | ENT_SUBSTITUTE, 'UTF-8');
}

/** Escapa e aplica o negrito. */
function emLinha(string $texto): string
{
    return (string) preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', escArtigo($texto));
}

function formatarTexto(string $corpo): string
{
    $linhas = explode("\n", (string) preg_replace('/\r\n?/', "\n", $corpo));
    $saida = [];
    $tipo = null;
    $bloco = [];

    $fechar = static function () use (&$saida, &$tipo, &$bloco): void {
        if (!$bloco) {
            return;
        }
        if ($tipo === 'p') {
            $saida[] = '<p>' . implode('<br>', array_map('emLinha', $bloco)) . '</p>';
        }
        if ($tipo === 'ul') {
            $saida[] = '<ul>' . implode('', array_map(static function ($i) {
                return '<li>' . emLinha($i) . '</li>';
            }, $bloco)) . '</ul>';
        }
        if ($tipo === 'q') {
            $saida[] = '<blockquote><p>' . implode('<br>', array_map('emLinha', $bloco)) . '</p></blockquote>';
        }
        $bloco = [];
        $tipo = null;
    };

    foreach ($linhas as $original) {
        $linha = trim($original, " \t");
        if ($linha === '') {
            $fechar();
            continue;
        }
        if (strpos($linha, '### ') === 0) {
            $fechar();
            $saida[] = '<h3>' . emLinha(trim(substr($linha, 4), " \t")) . '</h3>';
            continue;
        }
        if (strpos($linha, '## ') === 0) {
            $fechar();
            $saida[] = '<h2>' . emLinha(trim(substr($linha, 3), " \t")) . '</h2>';
            continue;
        }

        $novo = 'p';
        $conteudo = $linha;
        if (strpos($linha, '- ') === 0) {
            $novo = 'ul';
            $conteudo = trim(substr($linha, 2), " \t");
        } elseif (strpos($linha, '> ') === 0) {
            $novo = 'q';
            $conteudo = trim(substr($linha, 2), " \t");
        }

        if ($tipo !== $novo) {
            $fechar();
            $tipo = $novo;
        }
        $bloco[] = $conteudo;
    }
    $fechar();
    return implode("\n", $saida);
}

/** "2026-10-16" → "16 de outubro de 2026". */
function dataPorExtenso(string $iso): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $iso, $m)) {
        return '';
    }
    $mes = (int) $m[2];
    if ($mes < 1 || $mes > 12) {
        return '';
    }
    return ((int) $m[3]) . ' de ' . MESES[$mes - 1] . ' de ' . $m[1];
}

/** Uns 200 palavras por minuto, nunca menos de um. */
function tempoDeLeitura(string $corpo): string
{
    $palavras = count(preg_split('/[ \t\r\n]+/', $corpo, -1, PREG_SPLIT_NO_EMPTY) ?: []);
    $minutos = max(1, (int) round($palavras / 200));
    return 'Leitura de ' . $minutos . ' minuto' . ($minutos === 1 ? '' : 's');
}

/** Endereço da capa, ou '' quando não há uma válida (ou o arquivo sumiu). */
function caminhoDaCapa(array $artigo): string
{
    $capa = (string) ($artigo['capa'] ?? '');
    if (preg_match('~^fotos/capa-[a-f0-9]{8}\.jpg$~', $capa)) {
        return is_file(pastaDeFotosGuardadas() . '/' . basename($capa)) ? $capa : '';
    }
    return preg_match('~^assets/img/[a-z0-9._-]+$~', $capa) ? $capa : '';
}

function capaDoArtigo(array $artigo): string
{
    $capa = caminhoDaCapa($artigo);
    return $capa !== ''
        ? '<figure class="artigo-capa"><img src="' . escArtigo($capa) . '" alt="" width="1200" height="675"></figure>'
        : '';
}

function cartaoDeArtigo(array $artigo): string
{
    $url = 'artigo-' . escArtigo($artigo['slug']) . '.html';
    $capa = caminhoDaCapa($artigo);
    $miniatura = $capa !== ''
        ? '<img src="' . escArtigo($capa) . '" alt="" width="1200" height="675" loading="lazy">'
        : ICONE_ARTIGO;
    return '<article class="news-card">' .
        '<a class="news-thumb" href="' . $url . '" tabindex="-1" aria-hidden="true">' . $miniatura . '</a>' .
        '<div class="news-body">' .
        '<p class="news-data"><time datetime="' . escArtigo($artigo['data']) . '">' .
        escArtigo(dataPorExtenso((string) $artigo['data'])) . '</time></p>' .
        '<h3><a href="' . $url . '">' . escArtigo($artigo['titulo']) . '</a></h3>' .
        '<p>' . escArtigo($artigo['resumo']) . '</p>' .
        '<a href="' . $url . '" class="arrow-link">Ler artigo</a>' .
        '</div></article>';
}

/** Publicados, do mais novo para o mais antigo; empate fica na ordem salva. */
function artigosPublicados(array $artigos): array
{
    $lista = [];
    foreach (array_values($artigos) as $i => $a) {
        if (!empty($a['publicado'])) {
            $lista[] = [$i, $a];
        }
    }
    usort($lista, static function ($x, $y) {
        $c = strcmp((string) $y[1]['data'], (string) $x[1]['data']);
        return $c !== 0 ? $c : $x[0] - $y[0];
    });
    return array_map(static function ($p) {
        return $p[1];
    }, $lista);
}

function listaDeArtigos(array $artigos): string
{
    $lista = artigosPublicados($artigos);
    if (!$lista) {
        return '<div class="artigos-vazio"><p>Em breve, os primeiros artigos estarão aqui.</p></div>';
    }
    return '<div class="news-grid">' . "\n" . implode("\n", array_map('cartaoDeArtigo', $lista)) . "\n" . '</div>';
}

function tokensDoArtigo(array $artigo): array
{
    return [
        '{{ARTIGO_TITULO}}' => escArtigo($artigo['titulo']),
        '{{ARTIGO_RESUMO}}' => escArtigo($artigo['resumo']),
        '{{ARTIGO_DATA}}' => escArtigo(dataPorExtenso((string) $artigo['data'])),
        '{{ARTIGO_DATA_ISO}}' => escArtigo($artigo['data']),
        '{{ARTIGO_LEITURA}}' => escArtigo(tempoDeLeitura((string) $artigo['corpo'])),
        '{{ARTIGO_CAPA}}' => capaDoArtigo($artigo),
        '{{ARTIGO_CORPO}}' => formatarTexto((string) $artigo['corpo']),
    ];
}

function entradaDeBusca(array $artigo): array
{
    return [
        'title' => (string) $artigo['titulo'],
        'url' => 'artigo-' . $artigo['slug'] . '.html',
        'section' => 'Artigos',
        'description' => (string) $artigo['resumo'],
        'keywords' => 'artigo artigos ' . $artigo['titulo'],
        'sintomas' => '',
    ];
}

/* ---------------------------------------------------------------------------
 * Guardar e ler
 * ------------------------------------------------------------------------ */

function arquivoDeArtigos(): string
{
    return pastaDeDados() . '/artigos.json';
}

/** Garante os campos e os tipos de cada artigo, venha de onde vier. */
function normalizarArtigo(array $a): array
{
    return [
        'id' => preg_match('/^[a-f0-9]{8}$/', (string) ($a['id'] ?? '')) ? (string) $a['id'] : bin2hex(random_bytes(4)),
        'slug' => preg_match('/^[a-z0-9-]+$/', (string) ($a['slug'] ?? '')) ? (string) $a['slug'] : 'artigo',
        'titulo' => (string) ($a['titulo'] ?? ''),
        'resumo' => (string) ($a['resumo'] ?? ''),
        'data' => (string) ($a['data'] ?? ''),
        'capa' => (string) ($a['capa'] ?? ''),
        'publicado' => !empty($a['publicado']),
        'corpo' => (string) ($a['corpo'] ?? ''),
    ];
}

function carregarArtigos(): array
{
    $lista = lerJson(arquivoDeArtigos()) ?? lerJson(MODELOS_DIR . '/artigos-inicial.json') ?? [];
    return array_values(array_map('normalizarArtigo', array_filter($lista, 'is_array')));
}

function salvarArtigos(array $artigos): void
{
    gravarAtomico(
        arquivoDeArtigos(),
        json_encode(array_values($artigos), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
    );
}

/** O índice do artigo com este id na lista, ou null. */
function posicaoDoArtigo(array $artigos, string $id): ?int
{
    foreach ($artigos as $i => $a) {
        if ($a['id'] === $id) {
            return (int) $i;
        }
    }
    return null;
}

/** Todos, publicados e rascunhos, do mais novo para o mais antigo. */
function artigosParaOPainel(array $artigos): array
{
    $lista = array_values($artigos);
    usort($lista, static function ($a, $b) {
        return strcmp($b['data'], $a['data']);
    });
    return $lista;
}

/* ---------------------------------------------------------------------------
 * Validar e criar
 * ------------------------------------------------------------------------ */

function contarCaracteres(string $texto): int
{
    return (int) preg_match_all('/./su', $texto);
}

/**
 * Confere o formulário do editor.
 * @return array{0: array, 1: array<string, string>} [campos limpos, erros por campo]
 */
function validarArtigo(array $entrada): array
{
    $erros = [];
    $pegar = static function (string $chave) use ($entrada): string {
        $v = $entrada[$chave] ?? '';
        return is_string($v) ? $v : '';
    };
    $limpos = [
        'titulo' => $pegar('titulo'),
        'resumo' => $pegar('resumo'),
        'data' => trim($pegar('data')),
        'corpo' => $pegar('corpo'),
        'publicado' => !empty($entrada['publicado']),
    ];

    foreach (['titulo', 'resumo', 'corpo'] as $chave) {
        if (!preg_match('//u', $limpos[$chave])) {
            $erros[$chave] = 'O texto tem caracteres que o site não reconhece. Digite de novo.';
            $limpos[$chave] = '';
        }
    }
    // Título e resumo são uma linha só; o texto guarda as quebras.
    foreach (['titulo', 'resumo'] as $chave) {
        $limpos[$chave] = trim((string) preg_replace('/\s+/u', ' ', $limpos[$chave]));
    }
    // Separadores de linha do Unicode viram quebra comum: assim o PHP e o
    // JavaScript enxergam as mesmas linhas.
    $limpos['corpo'] = rtrim((string) preg_replace('/\r\n?|\x{2028}|\x{2029}/u', "\n", $limpos['corpo']));

    if (!isset($erros['titulo'])) {
        if ($limpos['titulo'] === '') {
            $erros['titulo'] = 'Dê um título ao artigo.';
        } elseif (contarCaracteres($limpos['titulo']) > 140) {
            $erros['titulo'] = 'O título passou de 140 caracteres. Tente algo mais curto.';
        }
    }
    if (!isset($erros['resumo'])) {
        if ($limpos['resumo'] === '') {
            $erros['resumo'] = 'Escreva uma ou duas frases de resumo: elas aparecem na lista de artigos.';
        } elseif (contarCaracteres($limpos['resumo']) > 280) {
            $erros['resumo'] = 'O resumo passou de 280 caracteres. Uma ou duas frases bastam.';
        }
    }
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $limpos['data'], $m)
        || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
        $erros['data'] = 'Informe a data do artigo.';
    }
    if (!isset($erros['corpo'])) {
        if (trim($limpos['corpo']) === '') {
            $erros['corpo'] = 'O artigo está sem texto.';
        } elseif (contarCaracteres($limpos['corpo']) > 60000) {
            $erros['corpo'] = 'O texto passou do limite de 60 mil caracteres. Divida em dois artigos.';
        }
    }
    return [$limpos, $erros];
}

/** Endereço do artigo a partir do título: "Câncer de mama" → "cancer-de-mama". */
function criarSlug(string $titulo, array $artigos): string
{
    static $acentos = [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'Á' => 'a', 'À' => 'a', 'Â' => 'a', 'Ã' => 'a', 'Ä' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'É' => 'e', 'È' => 'e', 'Ê' => 'e', 'Ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'Í' => 'i', 'Ì' => 'i', 'Î' => 'i', 'Ï' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o', 'Ó' => 'o', 'Ò' => 'o', 'Ô' => 'o', 'Õ' => 'o', 'Ö' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'Ú' => 'u', 'Ù' => 'u', 'Û' => 'u', 'Ü' => 'u',
        'ç' => 'c', 'Ç' => 'c', 'ñ' => 'n', 'Ñ' => 'n',
    ];
    $s = strtolower(strtr($titulo, $acentos));
    $s = trim((string) preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    if (strlen($s) > 60) {
        $s = substr($s, 0, 60);
        $corte = strrpos($s, '-');
        $s = rtrim($corte ? substr($s, 0, $corte) : $s, '-');
    }
    if ($s === '') {
        $s = 'artigo';
    }

    $usados = array_column($artigos, 'slug');
    $base = $s;
    for ($n = 2; in_array($s, $usados, true); $n++) {
        $s = $base . '-' . $n;
    }
    return $s;
}

/** Recorte da capa: paisagem 16:9, centralizada. */
function configDaCapa(): array
{
    return ['nome' => 'capa', 'largura' => 1200, 'altura' => 675, 'vies' => 0.5];
}
