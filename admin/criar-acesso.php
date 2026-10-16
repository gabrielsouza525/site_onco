<?php
/**
 * Primeiro acesso, ou senha nova para quem esqueceu a sua.
 *
 * Só funciona enquanto existir, na pasta de dados, o arquivo
 * liberar-cadastro.txt criado há menos de 2 horas — ver cadastroLiberado()
 * em inc/nucleo.php. Criar esse arquivo exige entrar na hospedagem, então
 * ninguém de fora consegue se cadastrar.
 */

declare(strict_types=1);

require __DIR__ . '/inc/nucleo.php';
require __DIR__ . '/inc/visual.php';

$semAcessos = carregarUsuarios() === [];
$liberado = cadastroLiberado();
$email = '';
$erros = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $liberado) {
    exigirCsrf();
    $email = trim((string) ($_POST['email'] ?? ''));
    $senha = (string) ($_POST['senha'] ?? '');
    $confirmacao = (string) ($_POST['confirmacao'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $erros['email'] = 'Informe um e-mail válido.';
    }
    $problema = problemaNaSenha($senha, $confirmacao);
    if ($problema !== null) {
        $erros['senha'] = $problema;
    }

    if (!$erros) {
        $jaTinha = isset(carregarUsuarios()[normalizarEmail($email)]);
        definirSenha($email, $senha);
        encerrarLiberacao();
        entrarComo($email, false);
        avisar('ok', $jaTinha
            ? 'Senha nova definida. Você já está no painel.'
            : 'Acesso criado. Você já está no painel.');
        ir('index.php');
    }
}

$titulo = $semAcessos ? 'Criar o primeiro acesso' : 'Criar acesso ou senha nova';
abrirPagina($titulo, 'page-login');
?>
<main class="auth">
<?php painelDeMarca(); ?>

  <section class="auth-form-panel">
    <div class="auth-card">
      <h2 class="auth-titulo"><?= e($titulo) ?></h2>

<?php if ($liberado): ?>
      <p class="auth-texto">
        Escolha o e-mail e a senha de quem vai entrar no painel. Se o e-mail já
        tiver acesso, a senha dele passa a ser esta.
      </p>

      <form method="post" action="criar-acesso.php" novalidate>
        <?= campoCsrf() ?>
        <div class="field">
          <label for="novoEmail">E-mail</label>
          <input type="email" id="novoEmail" name="email" value="<?= e($email) ?>"
                 autocomplete="username" required autofocus
                 <?= isset($erros['email']) ? 'aria-invalid="true" aria-describedby="erroEmail"' : '' ?>>
<?php if (isset($erros['email'])): ?>
          <p class="painel-erro-campo" id="erroEmail"><?= e($erros['email']) ?></p>
<?php endif; ?>
        </div>

        <div class="field">
          <label for="novaSenha">Senha</label>
          <div class="input-with-action">
            <input type="password" id="novaSenha" name="senha" placeholder="Pelo menos 8 caracteres"
                   autocomplete="new-password" minlength="8" required
                   <?= isset($erros['senha']) ? 'aria-invalid="true" aria-describedby="erroSenha"' : '' ?>>
<?php botaoRevelar('novaSenha'); ?>
          </div>
<?php if (isset($erros['senha'])): ?>
          <p class="painel-erro-campo" id="erroSenha"><?= e($erros['senha']) ?></p>
<?php endif; ?>
        </div>

        <div class="field">
          <label for="confirmaSenha">Repita a senha</label>
          <input type="password" id="confirmaSenha" name="confirmacao"
                 autocomplete="new-password" required>
        </div>

        <button type="submit" class="btn btn--primary btn--block auth-submit">Salvar e entrar</button>
      </form>

<?php else: ?>
<?php if (!$semAcessos): ?>
      <p class="auth-texto">
        O painel não manda senha por e-mail. Se alguém da equipe já tem acesso,
        peça para essa pessoa definir uma senha nova para você, na parte
        <strong>Acessos</strong> do painel. Se ninguém tiver, quem cuida da
        hospedagem libera assim:
      </p>
<?php else: ?>
      <p class="auth-texto">
        Só quem cuida da hospedagem consegue liberar o cadastro — é o que impede
        um estranho de criar acesso antes de você. Faça assim:
      </p>
<?php endif; ?>
      <ol class="auth-passos">
        <li>Entre no DirectAdmin e abra o <strong>Gerenciador de arquivos</strong>.</li>
        <li>Crie um arquivo vazio chamado <code><?= e(ARQUIVO_LIBERACAO) ?></code>
          <?= e(ondeFicaADados()) ?>.</li>
        <li>Volte aqui e recarregue a página.</li>
      </ol>
<?php if (liberacaoVencida()): ?>
      <p class="auth-feedback" data-tipo="erro" role="alert">
        O arquivo <?= e(ARQUIVO_LIBERACAO) ?> que está lá foi criado há mais de 2 horas
        e não vale mais. Apague e crie de novo.
      </p>
<?php endif; ?>
      <p class="auth-texto auth-texto--fim">
        O arquivo vale por 2 horas e é apagado assim que o acesso for criado.
      </p>
<?php endif; ?>
    </div>

    <p class="auth-footnote">
<?php if (!$semAcessos): ?>
      <a href="entrar.php">Voltar para o login</a> &nbsp;·&nbsp;
<?php endif; ?>
      <a href="../index.html">Voltar ao site</a>
    </p>
  </section>
</main>
<?php
fecharPagina();
