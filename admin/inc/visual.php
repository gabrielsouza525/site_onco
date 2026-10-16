<?php
/**
 * Pedaços de HTML que as telas do painel repetem.
 * O visual vem do styles.css do site (cores, fontes, campos, tela de login)
 * mais o painel.css, que só existe aqui.
 */

declare(strict_types=1);

/**
 * Endereço do arquivo com a assinatura do conteúdo: "painel.css?v=3fa2c1d0".
 * A hospedagem manda o navegador guardar CSS e JS por 7 dias sem perguntar
 * de novo; sem isto, quem já abriu o painel continuaria vendo o visual antigo
 * depois de um pacote novo. Mudou o arquivo, muda o endereço.
 */
function comVersao(string $endereco): string
{
    $arquivo = ADMIN_DIR . '/' . $endereco;
    $assinatura = is_file($arquivo) ? substr((string) md5_file($arquivo), 0, 8) : '';
    return $assinatura !== '' ? $endereco . '?v=' . $assinatura : $endereco;
}

function abrirPagina(string $titulo, string $classe): void
{
    ?><!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title><?= e($titulo) ?> | Dr. Bruno Kersten</title>
  <meta name="theme-color" content="#0d1420">
  <link rel="icon" href="../assets/img/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="<?= e(comVersao('../assets/css/styles.css')) ?>">
  <link rel="stylesheet" href="<?= e(comVersao('painel.css')) ?>">
</head>
<body class="<?= e($classe) ?>">
<?php
}

function fecharPagina(): void
{
    // main.js traz a máscara de telefone; painel.js, o resto do painel.
    ?>
<script src="<?= e(comVersao('../assets/js/main.js')) ?>" defer></script>
<script src="<?= e(comVersao('painel.js')) ?>" defer></script>
</body>
</html>
<?php
}

/**
 * Ícones de traço, no mesmo desenho dos do site (24×24, traço 2).
 * Decorativos: quem lê o texto ao lado não precisa deles.
 */
function icone(string $nome): string
{
    static $desenhos = [
        'telefone' => '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
        'local' => '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        'relogio' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        'foto' => '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
        'globo' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
        'pessoas' => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        'sair' => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
        'abrir' => '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
        'alerta' => '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        'certo' => '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        'editar' => '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        'enviar' => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
        'desfazer' => '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
        'lixeira' => '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
        'chave' => '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2"/>',
        'mais' => '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
        'atualizar' => '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
        'info' => '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        'instagram' => '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
        'facebook' => '<path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l1-4h-4V7.5a.5.5 0 0 1 .5-.5H15z"/>',
        'linkedin' => '<path d="M4.5 9v11M4.5 4.5v.01M10 20V9m0 4.5c0-2 1.4-3.5 3.4-3.5S17 11.5 17 13.8V20"/>',
        'whatsapp' => '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
        'artigo' => '<path d="M4 19.5V6a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M9 8h7M9 12h5"/>',
        'voltar' => '<path d="M19 12H5M12 19l-7-7 7-7"/>',
        'olho' => '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    ];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' .
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' .
        ($desenhos[$nome] ?? '') . '</svg>';
}

/**
 * Barra lateral do painel. `$ativa` marca onde a pessoa está ('artigos' no
 * editor de artigo); `$pendentes` vira o contador ao lado de Contato.
 */
function barraLateral(string $eu, int $pendentes, string $ativa = ''): void
{
    $itens = [
        'contato' => ['index.php#contato', 'telefone', 'Contato'],
        'artigos' => ['index.php#artigos', 'artigo', 'Artigos'],
        'fotos' => ['index.php#fotos', 'foto', 'Fotos'],
        'site' => ['index.php#site', 'globo', 'Publicação'],
        'acessos' => ['index.php#acessos', 'pessoas', 'Acessos'],
    ];
    ?>
  <aside class="app-lateral">
    <a class="app-marca" href="../index.html">
      <img src="../assets/img/logo.svg" alt="" width="40" height="40">
      <span>
        <strong>Dr. Bruno Kersten</strong>
        <small>Área administrativa</small>
      </span>
    </a>

    <nav class="app-nav" aria-label="Partes do painel">
<?php foreach ($itens as $chave => [$endereco, $icone, $rotulo]): ?>
      <a href="<?= e($endereco) ?>"<?= $chave === $ativa ? ' aria-current="page"' : '' ?>><?= icone($icone) ?><span><?= e($rotulo) ?></span><?php if ($chave === 'contato' && $pendentes): ?><span class="app-nav-conta" aria-label="<?= $pendentes ?> pendente<?= $pendentes > 1 ? 's' : '' ?>"><?= $pendentes ?></span><?php endif; ?></a>
<?php endforeach; ?>
    </nav>

    <div class="app-usuario">
      <span class="app-avatar" aria-hidden="true"><?= e(strtoupper(substr($eu, 0, 1))) ?></span>
      <span class="app-email painel-quem"><?= e($eu) ?></span>
      <form method="post" action="sair.php">
        <?= campoCsrf() ?>
        <button type="submit" class="app-sair" title="Sair do painel"><?= icone('sair') ?><span>Sair</span></button>
      </form>
    </div>
  </aside>
<?php
}

/** Painel de marca da tela de login e da de criar acesso. */
function painelDeMarca(): void
{
    $n = contagens();
    ?>
  <section class="auth-brand">
    <div class="auth-brand-inner">
      <a class="auth-logo" href="../index.html">
        <img src="../assets/img/logo.svg" alt="" width="44" height="44">
        <span>
          <strong>Dr. Bruno Kersten</strong>
          <small>Oncologia Clínica</small>
        </span>
      </a>

      <h1>Área administrativa<br>do site.</h1>
      <p class="auth-sub">
        Acesso restrito à equipe responsável pelo conteúdo. O site público continua
        disponível a qualquer visitante, sem login.
      </p>

      <ul class="auth-features">
        <li>
          <span class="auth-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg></span>
          <span><strong>Dados de contato</strong>
          <small>Telefone, WhatsApp, endereço e redes, em todas as páginas de uma vez</small></span>
        </li>
        <li>
          <span class="auth-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span>
          <span><strong>Publicação na hora</strong>
          <small>Salvou, o site já mostra — sem esperar ninguém</small></span>
        </li>
        <li>
          <span class="auth-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.6 3.4 8.3 8 9 4.6-.7 8-4.4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg></span>
          <span><strong>Acesso por pessoa</strong>
          <small>Cada um entra com o próprio e-mail e senha</small></span>
        </li>
      </ul>

      <?php if ($n['paginas'] > 0): ?>
      <div class="auth-stats">
        <div><strong><?= (int) $n['paginas'] ?></strong><small>páginas<br>publicadas</small></div>
        <div><strong><?= (int) $n['canceres'] ?></strong><small>tipos de<br>câncer</small></div>
      </div>
      <?php endif; ?>
    </div>
  </section>
<?php
}

/** Mostra o aviso se ele for deste bloco do painel ('' = topo da página). */
function blocoDeAviso(?array $aviso, string $secao = ''): void
{
    if (!$aviso || ($aviso['secao'] ?? '') !== $secao) {
        return;
    }
    $papel = $aviso['tipo'] === 'erro' ? 'alert' : 'status';
    echo '<p class="painel-aviso" data-tipo="', e($aviso['tipo']), '" role="', $papel, '">',
        e($aviso['texto']), "</p>\n";
}

/** Botão de mostrar/ocultar senha, igual ao da tela de login do site. */
function botaoRevelar(string $idDoCampo): void
{
    ?>
            <button type="button" class="reveal" data-revelar="<?= e($idDoCampo) ?>"
                    aria-label="Mostrar senha" aria-pressed="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
<?php
}
