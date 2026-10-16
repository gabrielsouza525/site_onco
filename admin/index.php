<?php
/**
 * Painel: o que o site mostra hoje, edição dos dados de contato, publicação
 * e acessos. Tudo funciona sem JavaScript — o painel.js só acrescenta
 * conforto (mostrar senha, confirmar remoção).
 */

declare(strict_types=1);

require __DIR__ . '/inc/nucleo.php';
require __DIR__ . '/inc/visual.php';

$eu = exigirLogin();
$campos = campos();
$dados = carregarDados();

$editando = isset($_GET['editar']);
$valoresDoFormulario = $dados;
$errosDosDados = [];
$gavetaAberta = null; // 'acesso' ou 'senha', quando um desses formulários volta com erro
$errosDaGaveta = [];
$emailDoNovoAcesso = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    exigirCsrf();
    $acao = (string) ($_POST['acao'] ?? '');

    if ($acao === 'salvar') {
        [$limpos, $errosDosDados] = validarDados($_POST);
        if ($errosDosDados) {
            $editando = true;
            foreach ($campos as $c) {
                $valoresDoFormulario[$c['chave']] = is_string($_POST[$c['chave']] ?? null) ? $_POST[$c['chave']] : '';
            }
        } else {
            $mudou = false;
            foreach ($campos as $c) {
                if ((string) ($dados[$c['chave']] ?? '') !== $limpos[$c['chave']]) {
                    $mudou = true;
                }
            }
            if (!$mudou) {
                avisar('info', 'Nenhum campo mudou, então não havia o que salvar.');
                ir('index.php');
            }
            try {
                salvarDados(array_merge($dados, $limpos));
            } catch (Throwable $erro) {
                avisar('erro', 'Nada foi salvo: ' . $erro->getMessage());
                ir('index.php');
            }
            try {
                publicar();
                avisar('ok', 'Salvo e publicado. O site já mostra os dados novos.');
            } catch (Throwable $erro) {
                avisar('erro', 'Os dados foram salvos, mas a publicação falhou: ' . $erro->getMessage() .
                    ' Tente “Publicar de novo”, mais abaixo.');
            }
            ir('index.php');
        }
    }

    if ($acao === 'publicar') {
        try {
            publicar();
            avisar('ok', 'Site publicado de novo, com os dados atuais.');
        } catch (Throwable $erro) {
            avisar('erro', 'A publicação falhou: ' . $erro->getMessage());
        }
        ir('index.php#site');
    }

    if ($acao === 'acesso_novo') {
        $gavetaAberta = 'acesso';
        $emailDoNovoAcesso = trim((string) ($_POST['email'] ?? ''));
        if (!filter_var($emailDoNovoAcesso, FILTER_VALIDATE_EMAIL)) {
            $errosDaGaveta['email'] = 'Informe um e-mail válido.';
        }
        $problema = problemaNaSenha((string) ($_POST['senha'] ?? ''), (string) ($_POST['confirmacao'] ?? ''));
        if ($problema !== null) {
            $errosDaGaveta['senha'] = $problema;
        }
        if (!$errosDaGaveta) {
            $alvo = normalizarEmail($emailDoNovoAcesso);
            $jaTinha = isset(carregarUsuarios()[$alvo]);
            definirSenha($alvo, (string) $_POST['senha']);
            avisar('ok', $jaTinha
                ? 'A senha de ' . $alvo . ' foi trocada.'
                : $alvo . ' agora tem acesso ao painel.');
            ir('index.php#acessos');
        }
    }

    if ($acao === 'acesso_remover') {
        $alvo = normalizarEmail((string) ($_POST['email'] ?? ''));
        $usuarios = carregarUsuarios();
        if ($alvo === $eu) {
            avisar('erro', 'Você não pode remover o próprio acesso. Peça para outra pessoa da equipe.');
        } elseif (isset($usuarios[$alvo])) {
            unset($usuarios[$alvo]);
            salvarUsuarios($usuarios);
            avisar('ok', $alvo . ' não tem mais acesso ao painel.');
        }
        ir('index.php#acessos');
    }

    if ($acao === 'senha') {
        $gavetaAberta = 'senha';
        $nova = (string) ($_POST['nova'] ?? '');
        if (!conferirSenha($eu, (string) ($_POST['atual'] ?? ''))) {
            $errosDaGaveta['atual'] = 'A senha atual não confere.';
        } else {
            $problema = problemaNaSenha($nova, (string) ($_POST['confirmacao'] ?? ''));
            if ($problema !== null) {
                $errosDaGaveta['nova'] = $problema;
            } else {
                definirSenha($eu, $nova);
                session_regenerate_id(true);
                avisar('ok', 'Sua senha foi trocada.');
                ir('index.php#acessos');
            }
        }
    }
}

/* Leitura ------------------------------------------------------------------ */
$pendentes = 0;
foreach ($campos as $c) {
    $estado = estadoDoCampo($c, $dados[$c['chave']] ?? '');
    if ($estado === 'falta' || $estado === 'exemplo') {
        $pendentes++;
    }
}
$numeros = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito'];
$resumo = $pendentes === 0
    ? 'Todas as informações de contato estão preenchidas.'
    : ($pendentes === 1
        ? 'Uma informação de contato ainda precisa da sua atenção.'
        : ($numeros[$pendentes] ?? (string) $pendentes) . ' informações de contato ainda precisam da sua atenção.');

$aviso = retirarAviso();
$publicacao = ultimaPublicacao();
$n = contagens();
$usuarios = carregarUsuarios();

/** Um campo de formulário do painel, com dica e erro. */
function campoDoPainel(string $id, string $nome, string $rotulo, string $tipo, string $valor,
                       ?string $dica, ?string $erro, string $extras = '', bool $opcional = false): void
{
    $descricao = trim(($dica ? $id . '-dica ' : '') . ($erro ? $id . '-erro' : ''));
    ?>
        <div class="painel-campo"<?= $erro ? ' data-erro' : '' ?>>
          <label for="<?= e($id) ?>"><?= e($rotulo) ?><?php if ($opcional): ?> <span class="painel-opcional">opcional</span><?php endif; ?></label>
          <input id="<?= e($id) ?>" name="<?= e($nome) ?>" type="<?= e($tipo) ?>" value="<?= e($valor) ?>"
                 <?= $extras ?><?= $descricao ? ' aria-describedby="' . e($descricao) . '"' : '' ?><?= $erro ? ' aria-invalid="true"' : '' ?>>
<?php if ($erro): ?>
          <p class="painel-erro-campo" id="<?= e($id) ?>-erro"><?= e($erro) ?></p>
<?php endif; ?>
<?php if ($dica): ?>
          <p class="painel-dica" id="<?= e($id) ?>-dica"><?= e($dica) ?></p>
<?php endif; ?>
        </div>
<?php
}

abrirPagina('Painel — Área administrativa', 'page-painel');
?>
<header class="painel-bar">
  <a class="painel-logo" href="../index.html">
    <img src="../assets/img/logo.svg" alt="" width="30" height="30">
    <span>Área administrativa</span>
  </a>
  <div class="painel-bar-acoes">
    <span class="painel-quem"><?= e($eu) ?></span>
    <a class="painel-link" href="../index.html">Ver o site</a>
    <form method="post" action="sair.php">
      <?= campoCsrf() ?>
      <button type="submit" class="painel-link">Sair</button>
    </form>
  </div>
</header>

<main class="painel">
  <h1>Painel</h1>
  <p class="painel-resumo"><?= e($resumo) ?></p>

<?php blocoDeAviso($aviso); ?>
<?php if (!empty($GLOBALS['erroDePublicacao'])): ?>
  <p class="painel-aviso" data-tipo="erro" role="alert">
    O site não pôde ser publicado: <?= e($GLOBALS['erroDePublicacao']) ?>
  </p>
<?php endif; ?>

  <section class="painel-bloco" id="contato" aria-labelledby="tituloContato">
    <h2 id="tituloContato">O que o site mostra hoje</h2>
    <p class="painel-legenda">
      Estes valores aparecem no rodapé de todas as páginas e na página de
      contato. Mudar aqui muda em todas de uma vez.
    </p>

<?php if (!$editando): ?>
    <ul class="painel-lista">
<?php foreach ($campos as $c):
    $valor = $dados[$c['chave']] ?? '';
    $estado = estadoDoCampo($c, $valor);
?>
      <li class="painel-linha" data-estado="<?= e($estado) ?>">
        <span class="painel-rotulo"><?= e($c['rotulo']) ?></span>
        <span class="painel-valor"><?php
            if ($estado === 'falta') {
                echo 'falta preencher';
            } elseif ($estado === 'vazio') {
                echo 'não usado';
            } else {
                echo e(valorParaExibir($c, $valor));
            }
            if ($estado === 'exemplo') {
                echo '<span class="painel-marca">ainda é exemplo</span>';
            }
        ?></span>
<?php if (!empty($c['nota']) && $estado !== 'ok'): ?>
        <p class="painel-nota"><?= e($c['nota']) ?></p>
<?php endif; ?>
      </li>
<?php endforeach; ?>
    </ul>
    <a class="painel-acao" href="index.php?editar#contato">Editar estas informações</a>

<?php else: ?>
    <form class="painel-form" method="post" action="index.php#contato" novalidate>
      <?= campoCsrf() ?>
      <input type="hidden" name="acao" value="salvar">
<?php foreach ($campos as $c):
    $valor = (string) ($valoresDoFormulario[$c['chave']] ?? '');
    if ($c['tipo'] === 'whatsapp' && !$errosDosDados) {
        $valor = valorParaExibir($c, $valor);
    }
    $tipo = $c['tipo'] === 'link' ? 'url' : ($c['tipo'] === 'texto' ? 'text' : 'tel');
    $extras = 'autocomplete="off"' . ($tipo === 'tel' ? ' inputmode="tel"' : '')
        . (!empty($c['exemplo']) ? ' placeholder="' . e($c['exemplo']) . '"' : '')
        . (!empty($c['obrigatorio']) ? ' required' : '');
    campoDoPainel('campo-' . $c['chave'], $c['chave'], $c['rotulo'], $tipo, $valor,
        $c['dica'] ?? null, $errosDosDados[$c['chave']] ?? null, $extras, !empty($c['opcional']));
endforeach; ?>
      <div class="painel-form-acoes">
        <button type="submit" class="painel-acao">Salvar e publicar</button>
        <a class="painel-link" href="index.php#contato">Cancelar</a>
      </div>
    </form>
<?php endif; ?>
  </section>

  <section class="painel-bloco" id="site" aria-labelledby="tituloSite">
    <h2 id="tituloSite">O site</h2>
    <p class="painel-numeros">
      <strong><?= (int) $n['paginas'] ?></strong> páginas publicadas, sendo
      <strong><?= (int) $n['canceres'] ?></strong> sobre tipos de câncer.
    </p>
    <p class="painel-legenda">
<?php if ($publicacao): ?>
      Última publicação em <?= e(date('d/m/Y', (int) $publicacao['em'])) ?> às
      <?= e(date('H:i', (int) $publicacao['em'])) ?>.
<?php else: ?>
      O site ainda não foi publicado por este painel.
<?php endif; ?>
      Depois de enviar um pacote novo para a hospedagem, basta abrir o painel:
      ele publica sozinho.
    </p>
    <form class="painel-republicar" method="post" action="index.php#site">
      <?= campoCsrf() ?>
      <input type="hidden" name="acao" value="publicar">
      <button type="submit" class="painel-acao painel-acao--leve">Publicar de novo</button>
    </form>
  </section>

  <section class="painel-bloco" id="acessos" aria-labelledby="tituloAcessos">
    <h2 id="tituloAcessos">Acessos</h2>
    <p class="painel-legenda">Quem consegue entrar neste painel.</p>

    <ul class="painel-acessos">
<?php foreach (array_keys($usuarios) as $email): ?>
      <li>
        <span><?= e($email) ?><?php if ($email === $eu): ?><span class="painel-voce">você</span><?php endif; ?></span>
<?php if ($email !== $eu): ?>
        <form method="post" action="index.php#acessos"
              data-confirmar="Remover o acesso de <?= e($email) ?>? A pessoa sai do painel na hora.">
          <?= campoCsrf() ?>
          <input type="hidden" name="acao" value="acesso_remover">
          <input type="hidden" name="email" value="<?= e($email) ?>">
          <button type="submit" class="painel-link">Remover</button>
        </form>
<?php endif; ?>
      </li>
<?php endforeach; ?>
    </ul>

    <details class="painel-gaveta"<?= $gavetaAberta === 'acesso' ? ' open' : '' ?>>
      <summary>Adicionar acesso ou trocar a senha de alguém</summary>
      <form method="post" action="index.php#acessos" novalidate>
        <?= campoCsrf() ?>
        <input type="hidden" name="acao" value="acesso_novo">
<?php
campoDoPainel('acesso-email', 'email', 'E-mail', 'email', $emailDoNovoAcesso,
    'Se o e-mail já tiver acesso, a senha dele passa a ser esta — serve para quem esqueceu a senha.',
    $errosDaGaveta['email'] ?? null, 'autocomplete="off" required');
campoDoPainel('acesso-senha', 'senha', 'Senha', 'password', '',
    'Pelo menos 8 caracteres. Combine com a pessoa por telefone ou pessoalmente, não por e-mail.',
    $errosDaGaveta['senha'] ?? null, 'autocomplete="new-password" minlength="8" required');
campoDoPainel('acesso-confirmacao', 'confirmacao', 'Repita a senha', 'password', '',
    null, null, 'autocomplete="new-password" required');
?>
        <div class="painel-form-acoes">
          <button type="submit" class="painel-acao">Salvar acesso</button>
        </div>
      </form>
    </details>

    <details class="painel-gaveta"<?= $gavetaAberta === 'senha' ? ' open' : '' ?>>
      <summary>Trocar minha senha</summary>
      <form method="post" action="index.php#acessos" novalidate>
        <?= campoCsrf() ?>
        <input type="hidden" name="acao" value="senha">
<?php
campoDoPainel('senha-atual', 'atual', 'Senha atual', 'password', '', null,
    $errosDaGaveta['atual'] ?? null, 'autocomplete="current-password" required');
campoDoPainel('senha-nova', 'nova', 'Senha nova', 'password', '', 'Pelo menos 8 caracteres.',
    $errosDaGaveta['nova'] ?? null, 'autocomplete="new-password" minlength="8" required');
campoDoPainel('senha-confirmacao', 'confirmacao', 'Repita a senha nova', 'password', '', null, null,
    'autocomplete="new-password" required');
?>
        <div class="painel-form-acoes">
          <button type="submit" class="painel-acao">Trocar senha</button>
        </div>
      </form>
    </details>
  </section>

  <section class="painel-bloco painel-bloco--fim">
    <h2>O que não se edita por aqui</h2>
    <p>
      O texto das páginas e o conteúdo clínico dos tipos de câncer ficam no
      código do site. Para alterar qualquer um dos dois, fale com quem cuida
      da parte técnica.
    </p>
  </section>
</main>
<?php
fecharPagina();
