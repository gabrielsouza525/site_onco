<?php
/**
 * Pedaços de HTML que as telas do painel repetem.
 * O visual vem do styles.css do site (cores, fontes, campos, tela de login)
 * mais o painel.css, que só existe aqui.
 */

declare(strict_types=1);

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
  <link rel="stylesheet" href="../assets/css/styles.css">
  <link rel="stylesheet" href="painel.css">
</head>
<body class="<?= e($classe) ?>">
<?php
}

function fecharPagina(): void
{
    // main.js traz a máscara de telefone; painel.js, o resto do painel.
    ?>
<script src="../assets/js/main.js" defer></script>
<script src="painel.js" defer></script>
</body>
</html>
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
