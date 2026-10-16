<?php
/**
 * Editor de artigo: criar, editar e excluir.
 *
 * Salvar publica na hora: a página do artigo, a lista de artigos e o índice
 * da busca são regravados por publicar(). Um rascunho fica guardado, mas não
 * aparece no site.
 */

declare(strict_types=1);

require __DIR__ . '/inc/nucleo.php';
require __DIR__ . '/inc/visual.php';

$eu = exigirLogin();
$artigos = carregarArtigos();

$id = (string) ($_POST['id'] ?? $_GET['id'] ?? '');
$posicao = $id !== '' ? posicaoDoArtigo($artigos, $id) : null;
if ($id !== '' && $posicao === null) {
    avisar('erro', 'Esse artigo não existe mais. Talvez alguém tenha excluído.', 'artigos');
    ir('index.php#artigos');
}
$novo = $posicao === null;
$artigo = $novo
    ? ['id' => '', 'slug' => '', 'titulo' => '', 'resumo' => '', 'data' => date('Y-m-d'),
       'capa' => '', 'publicado' => true, 'corpo' => '']
    : $artigos[$posicao];
$erros = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Envio maior que o post_max_size chega vazio — nem o token vem.
    if (!$_POST && !$_FILES && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        $erros['capa'] = 'A foto de capa é maior que o limite que a hospedagem aceita (' .
            ini_get('post_max_size') . '). Envie uma versão menor.';
    } else {
        exigirCsrf();
        $acao = (string) ($_POST['acao'] ?? '');

        if ($acao === 'excluir' && !$novo) {
            $titulo = $artigos[$posicao]['titulo'];
            array_splice($artigos, $posicao, 1);
            try {
                salvarArtigos($artigos);
                publicar();
                avisar('ok', '“' . $titulo . '” foi excluído e saiu do site.', 'artigos');
            } catch (Throwable $erro) {
                avisar('erro', 'Não foi possível excluir: ' . $erro->getMessage(), 'artigos');
            }
            ir('index.php#artigos');
        }

        if ($acao === 'salvar') {
            [$limpos, $erros] = validarArtigo($_POST);
            $artigo = array_merge($artigo, $limpos);

            // A capa só é processada se o resto estiver certo: assim um erro no
            // título não joga fora o trabalho de reduzir a foto à toa.
            $envio = $_FILES['capa'] ?? null;
            if (!$erros) {
                if (!empty($_POST['remover_capa'])) {
                    $artigo['capa'] = '';
                } elseif (is_array($envio) && (int) ($envio['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                    try {
                        $artigo['capa'] = processarFoto(configDaCapa(), $envio);
                    } catch (Throwable $erro) {
                        $erros['capa'] = $erro->getMessage();
                    }
                }
            }

            if (!$erros) {
                if ($novo) {
                    $artigo['id'] = bin2hex(random_bytes(4));
                    $artigo['slug'] = criarSlug($artigo['titulo'], $artigos);
                    $artigos[] = normalizarArtigo($artigo);
                } else {
                    $artigos[$posicao] = normalizarArtigo($artigo);
                }
                try {
                    salvarArtigos($artigos);
                    publicar();
                    avisar('ok', $artigo['publicado']
                        ? '“' . $artigo['titulo'] . '” foi salvo e já está no site.'
                        : '“' . $artigo['titulo'] . '” foi salvo como rascunho. Ele só aparece no site quando você marcar “Publicar no site”.',
                        'artigos');
                } catch (Throwable $erro) {
                    avisar('erro', 'O artigo foi salvo, mas a publicação falhou: ' . $erro->getMessage(), 'artigos');
                }
                ir('index.php#artigos');
            }
        }
    }
}

/* Leitura ------------------------------------------------------------------ */
$pendentes = 0;
$dados = carregarDados();
foreach (campos() as $c) {
    $estado = estadoDoCampo($c, $dados[$c['chave']] ?? '');
    if ($estado === 'falta' || $estado === 'exemplo') {
        $pendentes++;
    }
}
$capaAtual = caminhoDaCapa($artigo);
$titulo = $novo ? 'Novo artigo' : 'Editar artigo';

/** Mensagem de erro de um campo, já com o id para o aria-describedby. */
function erroDoCampo(array $erros, string $campo): string
{
    return isset($erros[$campo])
        ? '<p class="painel-erro-campo" id="erro-' . e($campo) . '">' . e($erros[$campo]) . '</p>'
        : '';
}

/** Atributos de acessibilidade de um campo, com a dica e o erro dele. */
function descricaoDoCampo(array $erros, string $campo, bool $temDica): string
{
    $ids = trim(($temDica ? 'dica-' . $campo . ' ' : '') . (isset($erros[$campo]) ? 'erro-' . $campo : ''));
    return ($ids ? ' aria-describedby="' . e($ids) . '"' : '') . (isset($erros[$campo]) ? ' aria-invalid="true"' : '');
}

abrirPagina($titulo . ' — Área administrativa', 'page-painel');
?>
<div class="app">
<?php barraLateral($eu, $pendentes, 'artigos'); ?>

  <main class="app-principal">
    <header class="app-topo">
      <div>
        <p class="app-voltar"><a class="painel-link" href="index.php#artigos"><?= icone('voltar') ?>Todos os artigos</a></p>
        <h1><?= e($titulo) ?></h1>
        <p class="app-subtitulo">
          <?= $novo
              ? 'Escreva o texto e veja ao lado como ele vai ficar no site.'
              : 'As mudanças vão para o site assim que você salvar.' ?>
        </p>
      </div>
<?php if (!$novo && $artigo['publicado']): ?>
      <a class="painel-acao painel-acao--leve" href="../artigo-<?= e($artigo['slug']) ?>.html" target="_blank" rel="noopener"><?= icone('abrir') ?>Ver no site</a>
<?php endif; ?>
    </header>

<?php if ($erros): ?>
    <p class="painel-aviso" data-tipo="erro" role="alert">
      O artigo não foi salvo. Confira <?= count($erros) === 1 ? 'o campo marcado' : 'os campos marcados' ?> abaixo.
    </p>
<?php endif; ?>

    <form class="artigo-editor" method="post" action="artigo.php<?= $novo ? '' : '?id=' . e($artigo['id']) ?>"
          enctype="multipart/form-data" novalidate data-artigo-form>
      <?= campoCsrf() ?>
      <input type="hidden" name="acao" value="salvar">
      <input type="hidden" name="id" value="<?= e($artigo['id']) ?>">

      <div class="cartao artigo-campos">
        <!-- Importar de PDF: o texto é extraído no navegador (painel.js) e vai
             para o campo Texto, para revisar antes de salvar. O campo de
             arquivo não tem name, então o PDF nunca é enviado ao servidor.
             Sem JavaScript não há como ler o PDF; por isso começa escondido. -->
        <div class="artigo-importar" data-importar hidden>
          <span class="cartao-ico"><?= icone('pdf') ?></span>
          <div>
            <p class="artigo-importar-titulo">Importar de um PDF</p>
            <p class="painel-dica" id="importarPdf-dica">
              O texto do PDF vem para os campos abaixo, para você revisar antes de salvar.
              O arquivo não vai para o site. Imagens e tabelas ficam de fora.
            </p>
            <input class="painel-arquivo" id="importarPdf" type="file" accept="application/pdf,.pdf"
                   aria-describedby="importarPdf-dica importarPdf-situacao">
            <label class="botao-arquivo" for="importarPdf"><?= icone('enviar') ?><span>Escolher PDF</span></label>
            <p class="painel-dica painel-foto-situacao" id="importarPdf-situacao" aria-live="polite"></p>
          </div>
        </div>

        <div class="painel-campo"<?= isset($erros['titulo']) ? ' data-erro' : '' ?>>
          <label for="titulo">Título</label>
          <input id="titulo" name="titulo" type="text" value="<?= e($artigo['titulo']) ?>" maxlength="140"
                 required autocomplete="off" data-previa-campo="titulo"<?= descricaoDoCampo($erros, 'titulo', false) ?>>
          <?= erroDoCampo($erros, 'titulo') ?>
        </div>

        <div class="painel-campo"<?= isset($erros['resumo']) ? ' data-erro' : '' ?>>
          <label for="resumo">Resumo</label>
          <textarea id="resumo" name="resumo" rows="3" maxlength="280" required
                    data-previa-campo="resumo"<?= descricaoDoCampo($erros, 'resumo', true) ?>><?= e($artigo['resumo']) ?></textarea>
          <?= erroDoCampo($erros, 'resumo') ?>
          <p class="painel-dica" id="dica-resumo">Uma ou duas frases. Aparece na lista de artigos e logo abaixo do título.</p>
        </div>

        <div class="painel-campo painel-campo--data"<?= isset($erros['data']) ? ' data-erro' : '' ?>>
          <label for="data">Data</label>
          <input id="data" name="data" type="date" value="<?= e($artigo['data']) ?>" required
                 data-previa-campo="data"<?= descricaoDoCampo($erros, 'data', false) ?>>
          <?= erroDoCampo($erros, 'data') ?>
        </div>

        <div class="painel-campo"<?= isset($erros['corpo']) ? ' data-erro' : '' ?>>
          <label for="corpo">Texto</label>
          <textarea id="corpo" name="corpo" rows="20" required class="artigo-texto"
                    data-previa-campo="corpo"<?= descricaoDoCampo($erros, 'corpo', true) ?>><?= e($artigo['corpo']) ?></textarea>
          <?= erroDoCampo($erros, 'corpo') ?>
          <div class="painel-dica artigo-formatos" id="dica-corpo">
            <p>Como formatar:</p>
            <ul>
              <li>Pule uma linha para começar outro parágrafo.</li>
              <li><code>## </code> no começo da linha: subtítulo. <code>### </code>: subtítulo menor.</li>
              <li><code>- </code> no começo da linha: item de lista.</li>
              <li><code>&gt; </code> no começo da linha: quadro de destaque.</li>
              <li><code>**palavra**</code>: negrito.</li>
            </ul>
          </div>
        </div>

        <div class="painel-campo"<?= isset($erros['capa']) ? ' data-erro' : '' ?>>
          <span class="painel-rotulo-campo">Foto de capa <span class="painel-opcional">opcional</span></span>
          <div class="artigo-capa-campo">
            <div class="foto-moldura foto-moldura--capa" data-soltar="capa">
<?php if ($capaAtual !== ''): ?>
              <img id="capa-previa" class="painel-foto-imagem" src="../<?= e($capaAtual) ?>" alt="Capa atual do artigo" width="1200" height="675">
              <span class="foto-selo">Capa atual</span>
<?php else: ?>
              <img id="capa-previa" class="painel-foto-imagem painel-foto-imagem--vazia" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" width="1200" height="675">
              <span class="foto-selo">Sem capa</span>
<?php endif; ?>
              <span class="foto-soltar" aria-hidden="true"><?= icone('enviar') ?>Solte a foto aqui</span>
            </div>
            <div>
              <input class="painel-arquivo" id="capa" type="file" name="capa" accept="image/jpeg,image/png,image/webp"
                     data-previa="capa-previa"<?= descricaoDoCampo($erros, 'capa', true) ?>>
              <label class="botao-arquivo" for="capa"><?= icone('foto') ?><span>Escolher foto</span></label>
              <p class="painel-dica painel-foto-situacao" id="capa-situacao" aria-live="polite"></p>
              <p class="painel-dica" id="dica-capa">Cortada em formato paisagem (16 × 9). Sem capa, o artigo aparece com um ícone.</p>
              <?= erroDoCampo($erros, 'capa') ?>
<?php if ($capaAtual !== ''): ?>
              <label class="checkbox artigo-remover-capa">
                <input type="checkbox" name="remover_capa" value="1">
                <span>Tirar a capa</span>
              </label>
<?php endif; ?>
            </div>
          </div>
        </div>

        <label class="checkbox artigo-publicar">
          <input type="checkbox" name="publicado" value="1"<?= $artigo['publicado'] ? ' checked' : '' ?>>
          <span><strong>Publicar no site</strong>
            <small>Desmarcado, o artigo fica guardado como rascunho, só aqui no painel.</small></span>
        </label>

        <div class="painel-form-acoes">
          <button type="submit" class="painel-acao"><?= icone('certo') ?>Salvar</button>
          <a class="painel-link" href="index.php#artigos">Cancelar</a>
        </div>
      </div>

      <!-- Prévia com as classes do site: o que aparece aqui é o que o
           paciente vai ler. O PHP desenha a primeira versão; o painel.js
           acompanha a digitação. -->
      <aside class="artigo-previa" aria-label="Como o artigo vai ficar no site">
        <figure class="vitrine">
          <figcaption>
            Como vai ficar no site
            <span class="vitrine-endereco"><?= $novo ? 'artigo novo' : 'drbrunokersten.com.br/artigo-' . e($artigo['slug']) . '.html' ?></span>
          </figcaption>
          <div class="vitrine-tela artigo-previa-tela">
            <p class="artigo-previa-data" data-previa-alvo="data"><?= e(dataPorExtenso($artigo['data'])) ?></p>
            <h2 class="artigo-previa-titulo" data-previa-alvo="titulo"><?= e($artigo['titulo'] !== '' ? $artigo['titulo'] : 'Título do artigo') ?></h2>
            <p class="artigo-previa-resumo" data-previa-alvo="resumo"><?= e($artigo['resumo']) ?></p>
            <div class="prose" data-previa-alvo="corpo"><?= formatarTexto($artigo['corpo']) ?></div>
          </div>
        </figure>
      </aside>
    </form>

<?php if (!$novo): ?>
    <form class="artigo-excluir" method="post" action="artigo.php?id=<?= e($artigo['id']) ?>"
          data-confirmar="Excluir “<?= e($artigo['titulo']) ?>”? Ele sai do site na hora, e não dá para desfazer.">
      <?= campoCsrf() ?>
      <input type="hidden" name="acao" value="excluir">
      <input type="hidden" name="id" value="<?= e($artigo['id']) ?>">
      <button type="submit" class="painel-link painel-link--perigo"><?= icone('lixeira') ?>Excluir este artigo</button>
    </form>
<?php endif; ?>
  </main>
</div>
<?php
fecharPagina();
