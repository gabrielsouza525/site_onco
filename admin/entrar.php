<?php
/** Tela de login do painel. */

declare(strict_types=1);

require __DIR__ . '/inc/nucleo.php';
require __DIR__ . '/inc/visual.php';

if (usuarioAtual() !== null) {
    ir('index.php');
}

$semAcessos = carregarUsuarios() === [];
$email = '';
$erro = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$semAcessos) {
    exigirCsrf();
    $email = trim((string) ($_POST['email'] ?? ''));
    $senha = (string) ($_POST['senha'] ?? '');
    $manter = !empty($_POST['manter']);

    if (bloqueadoAte()) {
        $minutos = max(1, (int) ceil((bloqueadoAte() - time()) / 60));
        $erro = 'Muitas tentativas erradas. Tente de novo em ' . $minutos .
            ($minutos === 1 ? ' minuto.' : ' minutos.');
    } elseif ($email === '' || $senha === '') {
        $erro = 'Preencha o e-mail e a senha.';
    } elseif (conferirSenha($email, $senha)) {
        limparFalhas();
        entrarComo($email, $manter);
        ir('index.php');
    } else {
        registrarFalha();
        $erro = bloqueadoAte()
            ? 'Muitas tentativas erradas. Este aparelho fica 15 minutos sem poder tentar.'
            : 'E-mail ou senha incorretos.';
    }
}

$aviso = retirarAviso();
if ($aviso === null && isset($_GET['saiu'])) {
    $aviso = ['tipo' => 'ok', 'texto' => 'Você saiu do painel.'];
}

abrirPagina('Entrar — Área administrativa', 'page-login');
?>
<main class="auth">
<?php painelDeMarca(); ?>

  <section class="auth-form-panel">
    <div class="auth-card">
<?php if ($semAcessos): ?>
      <h2 class="auth-titulo">Ninguém tem acesso ainda</h2>
      <p class="auth-texto">
        O painel acabou de ser instalado. O primeiro acesso é criado por quem cuida
        da hospedagem do site.
      </p>
      <a class="btn btn--primary btn--block auth-submit" href="criar-acesso.php">Criar o primeiro acesso</a>
<?php else: ?>
      <div class="auth-tabs" role="presentation">
        <span class="auth-tab is-active">Entrar</span>
        <span class="auth-tab is-disabled" title="Quem já tem acesso cria o seu pelo painel">Criar conta</span>
      </div>

      <form method="post" action="entrar.php" novalidate>
        <?= campoCsrf() ?>
        <div class="field">
          <label for="loginEmail">E-mail</label>
          <input type="email" id="loginEmail" name="email" value="<?= e($email) ?>"
                 placeholder="voce@exemplo.com" autocomplete="username" required
                 <?= $email === '' ? 'autofocus' : '' ?>>
        </div>

        <div class="field">
          <label for="loginSenha">Senha</label>
          <div class="input-with-action">
            <input type="password" id="loginSenha" name="senha" placeholder="Sua senha"
                   autocomplete="current-password" required <?= $email !== '' ? 'autofocus' : '' ?>>
<?php botaoRevelar('loginSenha'); ?>
          </div>
        </div>

        <div class="auth-row">
          <label class="checkbox">
            <input type="checkbox" name="manter" value="1" checked>
            <span>Manter conectado</span>
          </label>
          <a href="criar-acesso.php?senha">Esqueci minha senha</a>
        </div>

        <button type="submit" class="btn btn--primary btn--block auth-submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          Entrar
        </button>

<?php if ($erro !== null): ?>
        <p class="auth-feedback" data-tipo="erro" role="alert"><?= e($erro) ?></p>
<?php elseif ($aviso !== null): ?>
        <p class="auth-feedback" data-tipo="<?= $aviso['tipo'] === 'erro' ? 'erro' : 'ok' ?>" role="status"><?= e($aviso['texto']) ?></p>
<?php endif; ?>
      </form>
<?php endif; ?>

      <div class="auth-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>
        <p>
          Desmarque <em>Manter conectado</em> em computador compartilhado: a sessão
          termina ao fechar o navegador.
        </p>
      </div>
    </div>

    <p class="auth-footnote"><a href="../index.html">Voltar ao site</a></p>
  </section>
</main>
<?php
fecharPagina();
