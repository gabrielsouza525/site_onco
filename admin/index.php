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
    // Envio maior que o post_max_size da hospedagem chega sem nada — nem o
    // token. Sem este aviso, a pessoa leria "o formulário expirou".
    if (!$_POST && !$_FILES && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        avisar('erro', 'A foto é maior que o limite que a hospedagem aceita (' .
            ini_get('post_max_size') . '). Envie uma versão menor.', 'fotos');
        ir('index.php#fotos');
    }
    exigirCsrf();
    $acao = (string) ($_POST['acao'] ?? '');

    if ($acao === 'foto' || $acao === 'foto_original') {
        $foto = null;
        foreach (fotos() as $f) {
            if ($f['chave'] === ($_POST['foto'] ?? '')) {
                $foto = $f;
            }
        }
        if ($foto !== null) {
            try {
                $novo = $acao === 'foto' ? processarFoto($foto, $_FILES['arquivo'] ?? []) : $foto['padrao'];
                salvarDados(array_merge($dados, [$foto['chave'] => $novo]));
                publicar();
                avisar('ok', $acao === 'foto'
                    ? $foto['rotulo'] . ' trocada. O site já mostra a nova.'
                    : $foto['rotulo'] . ' voltou a ser a original.', 'fotos');
            } catch (Throwable $erro) {
                avisar('erro', $erro->getMessage(), 'fotos');
            }
        }
        ir('index.php#fotos');
    }

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
                avisar('info', 'Nenhum campo mudou, então não havia o que salvar.', 'contato');
                ir('index.php#contato');
            }
            try {
                salvarDados(array_merge($dados, $limpos));
            } catch (Throwable $erro) {
                avisar('erro', 'Nada foi salvo: ' . $erro->getMessage(), 'contato');
                ir('index.php#contato');
            }
            try {
                publicar();
                avisar('ok', 'Salvo e publicado. O site já mostra os dados novos.', 'contato');
            } catch (Throwable $erro) {
                avisar('erro', 'Os dados foram salvos, mas a publicação falhou: ' . $erro->getMessage() .
                    ' Tente “Publicar de novo”, mais abaixo.', 'contato');
            }
            ir('index.php#contato');
        }
    }

    if ($acao === 'publicar') {
        try {
            publicar();
            avisar('ok', 'Site publicado de novo, com os dados atuais.', 'site');
        } catch (Throwable $erro) {
            avisar('erro', 'A publicação falhou: ' . $erro->getMessage(), 'site');
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
                : $alvo . ' agora tem acesso ao painel.', 'acessos');
            ir('index.php#acessos');
        }
    }

    if ($acao === 'acesso_remover') {
        $alvo = normalizarEmail((string) ($_POST['email'] ?? ''));
        $usuarios = carregarUsuarios();
        if ($alvo === $eu) {
            avisar('erro', 'Você não pode remover o próprio acesso. Peça para outra pessoa da equipe.', 'acessos');
        } elseif (isset($usuarios[$alvo])) {
            unset($usuarios[$alvo]);
            salvarUsuarios($usuarios);
            avisar('ok', $alvo . ' não tem mais acesso ao painel.', 'acessos');
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
                avisar('ok', 'Sua senha foi trocada.', 'acessos');
                ir('index.php#acessos');
            }
        }
    }
}

/* Leitura ------------------------------------------------------------------ */
$pendentes = [];
foreach ($campos as $c) {
    $estado = estadoDoCampo($c, $dados[$c['chave']] ?? '');
    if ($estado === 'falta' || $estado === 'exemplo') {
        $pendentes[] = $c;
    }
}
$numeros = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito'];
$total = count($pendentes);
$resumo = $total === 0
    ? 'Todas as informações de contato estão preenchidas.'
    : ($total === 1
        ? 'Uma informação de contato ainda precisa da sua atenção.'
        : ($numeros[$total] ?? (string) $total) . ' informações de contato ainda precisam da sua atenção.');

$aviso = retirarAviso();
$publicacao = ultimaPublicacao();
$n = contagens();
$usuarios = carregarUsuarios();

$hora = (int) date('G');
$saudacao = $hora >= 5 && $hora < 12 ? 'Bom dia' : ($hora >= 12 && $hora < 18 ? 'Boa tarde' : 'Boa noite');

/** Um campo de formulário do painel, com dica e erro. */
function campoDoPainel(string $id, string $nome, string $rotulo, string $tipo, string $valor,
                       ?string $dica, ?string $erro, string $extras = '', bool $opcional = false,
                       string $classe = ''): void
{
    $descricao = trim(($dica ? $id . '-dica ' : '') . ($erro ? $id . '-erro' : ''));
    ?>
        <div class="painel-campo<?= $classe ? ' ' . e($classe) : '' ?>"<?= $erro ? ' data-erro' : '' ?>>
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

/** Valor como aparece na miniatura do site: vazio vira um traço. */
function naVitrine(array $dados, string $chave): string
{
    $v = trim((string) ($dados[$chave] ?? ''));
    return $v !== '' ? $v : '—';
}

/* Campos que ocupam a linha inteira na grade do contato. */
$largos = ['endereco' => true];

abrirPagina('Painel — Área administrativa', 'page-painel');
?>
<div class="app">

  <aside class="app-lateral">
    <a class="app-marca" href="../index.html">
      <img src="../assets/img/logo.svg" alt="" width="40" height="40">
      <span>
        <strong>Dr. Bruno Kersten</strong>
        <small>Área administrativa</small>
      </span>
    </a>

    <nav class="app-nav" aria-label="Partes do painel">
      <a href="index.php#contato"><?= icone('telefone') ?><span>Contato</span><?php if ($total): ?><span class="app-nav-conta" aria-label="<?= $total ?> pendente<?= $total > 1 ? 's' : '' ?>"><?= $total ?></span><?php endif; ?></a>
      <a href="index.php#fotos"><?= icone('foto') ?><span>Fotos</span></a>
      <a href="index.php#site"><?= icone('globo') ?><span>Publicação</span></a>
      <a href="index.php#acessos"><?= icone('pessoas') ?><span>Acessos</span></a>
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

  <main class="app-principal">
    <header class="app-topo">
      <div>
        <h1><?= e($saudacao) ?>.</h1>
        <p class="app-subtitulo">Aqui você atualiza o contato e as fotos do site.</p>
      </div>
      <a class="painel-acao painel-acao--leve" href="../index.html" target="_blank" rel="noopener"><?= icone('abrir') ?>Ver o site</a>
    </header>

<?php blocoDeAviso($aviso); ?>
<?php if (!empty($GLOBALS['erroDePublicacao'])): ?>
    <p class="painel-aviso" data-tipo="erro" role="alert">
      O site não pôde ser publicado: <?= e($GLOBALS['erroDePublicacao']) ?>
    </p>
<?php endif; ?>

    <section class="app-situacao" data-estado="<?= $total ? 'pendente' : 'ok' ?>" aria-label="Situação do site">
      <span class="app-situacao-ico"><?= icone($total ? 'alerta' : 'certo') ?></span>
      <div>
        <p class="painel-resumo"><?= e($resumo) ?></p>
<?php if ($total): ?>
        <p class="app-situacao-detalhe">
          Ainda com texto de exemplo ou em branco:
<?php foreach ($pendentes as $c): ?>
          <a class="app-chip" href="index.php?editar#campo-<?= e($c['chave']) ?>"><?= e($c['rotulo']) ?></a>
<?php endforeach; ?>
        </p>
<?php else: ?>
        <p class="app-situacao-detalhe">O que os pacientes veem no site está completo.</p>
<?php endif; ?>
      </div>
    </section>

    <!-- Contato --------------------------------------------------------- -->
    <section class="cartao" id="contato" aria-labelledby="tituloContato">
      <header class="cartao-topo">
        <span class="cartao-ico"><?= icone('telefone') ?></span>
        <div>
          <h2 id="tituloContato">Contato</h2>
          <p class="painel-legenda">Aparece no rodapé de todas as páginas e na página de contato. Mudar aqui muda em todas de uma vez.</p>
        </div>
<?php if (!$editando): ?>
        <a class="painel-acao" href="index.php?editar#contato"><?= icone('editar') ?>Editar</a>
<?php endif; ?>
      </header>
<?php blocoDeAviso($aviso, 'contato'); ?>

      <div class="contato-grade">
<?php if (!$editando): ?>
        <ul class="painel-lista">
<?php foreach ($campos as $c):
    $valor = $dados[$c['chave']] ?? '';
    $estado = estadoDoCampo($c, $valor);
?>
          <li class="painel-linha<?= isset($largos[$c['chave']]) ? ' painel-linha--larga' : '' ?>" data-estado="<?= e($estado) ?>">
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

<?php else: ?>
        <form class="painel-form" method="post" action="index.php#contato" novalidate data-vitrine-form>
          <?= campoCsrf() ?>
          <input type="hidden" name="acao" value="salvar">
          <div class="painel-form-grade">
<?php foreach ($campos as $c):
    $valor = (string) ($valoresDoFormulario[$c['chave']] ?? '');
    if ($c['tipo'] === 'whatsapp' && !$errosDosDados) {
        $valor = valorParaExibir($c, $valor);
    }
    $tipo = $c['tipo'] === 'link' ? 'url' : ($c['tipo'] === 'texto' ? 'text' : 'tel');
    $extras = 'autocomplete="off"' . ($tipo === 'tel' ? ' inputmode="tel"' : '')
        . (!empty($c['exemplo']) ? ' placeholder="' . e($c['exemplo']) . '"' : '')
        . (!empty($c['obrigatorio']) ? ' required' : '')
        . ' data-vitrine="' . e($c['chave']) . '"';
    campoDoPainel('campo-' . $c['chave'], $c['chave'], $c['rotulo'], $tipo, $valor,
        $c['dica'] ?? null, $errosDosDados[$c['chave']] ?? null, $extras, !empty($c['opcional']),
        isset($largos[$c['chave']]) ? 'painel-campo--largo' : '');
endforeach; ?>
          </div>
          <div class="painel-form-acoes">
            <button type="submit" class="painel-acao"><?= icone('certo') ?>Salvar e publicar</button>
            <a class="painel-link" href="index.php#contato">Cancelar</a>
          </div>
        </form>
<?php endif; ?>

        <!-- O mesmo bloco da página de contato, com as classes do site: o que
             aparece aqui é o que o paciente vê. Durante a edição, acompanha o
             que está sendo digitado. -->
        <figure class="vitrine" aria-label="Como o contato aparece no site">
          <figcaption>
            Como aparece no site
            <span class="vitrine-endereco">drbrunokersten.com.br/contato</span>
          </figcaption>
          <div class="vitrine-tela">
            <div class="info-list">
              <div class="info-item">
                <span class="ico"><?= icone('local') ?></span>
                <div>
                  <h3>Consultório</h3>
                  <p><span data-vitrine-campo="cidade"><?= e(naVitrine($dados, 'cidade')) ?></span>
                    <small data-vitrine-campo="endereco"><?= e(naVitrine($dados, 'endereco')) ?></small></p>
                </div>
              </div>
              <div class="info-item">
                <span class="ico"><?= icone('telefone') ?></span>
                <div>
                  <h3>Telefone / WhatsApp</h3>
                  <p data-vitrine-campo="telefone"><?= e(naVitrine($dados, 'telefone')) ?></p>
                </div>
              </div>
              <div class="info-item">
                <span class="ico"><?= icone('relogio') ?></span>
                <div>
                  <h3>Horário de atendimento</h3>
                  <p data-vitrine-campo="horario"><?= e(naVitrine($dados, 'horario')) ?></p>
                </div>
              </div>
            </div>
            <div class="vitrine-redes" aria-label="Ícones do rodapé">
<?php foreach (['whatsapp' => 'WhatsApp', 'instagram' => 'Instagram', 'facebook' => 'Facebook', 'linkedin' => 'LinkedIn'] as $rede => $nome): ?>
              <span class="vitrine-rede"<?= trim((string) ($dados[$rede] ?? '')) === '' ? ' hidden' : '' ?> data-vitrine-rede="<?= e($rede) ?>" title="<?= e($nome) ?>"><?= icone($rede) ?></span>
<?php endforeach; ?>
            </div>
          </div>
        </figure>
      </div>
    </section>

    <!-- Fotos ----------------------------------------------------------- -->
    <section class="cartao" id="fotos" aria-labelledby="tituloFotos">
      <header class="cartao-topo">
        <span class="cartao-ico"><?= icone('foto') ?></span>
        <div>
          <h2 id="tituloFotos">Fotos</h2>
          <p class="painel-legenda">A foto enviada é cortada em retrato (3 × 4) e reduzida para carregar rápido. Prefira uma com o rosto no terço de cima e fundo simples.</p>
        </div>
      </header>
<?php blocoDeAviso($aviso, 'fotos'); ?>

      <div class="fotos-grade">
<?php foreach (fotos() as $foto):
    $trocada = fotoTrocada($foto, $dados);
    $id = 'foto-' . $foto['nome'];
?>
        <article class="foto-cartao">
          <div class="foto-moldura" data-soltar="<?= e($id) ?>">
            <img id="<?= e($id) ?>-previa" class="painel-foto-imagem"
                 src="../<?= e(caminhoDaFoto($foto, $dados)) ?>"
                 alt="<?= e($foto['rotulo']) ?>, como está no site" width="240" height="320">
            <span class="foto-selo"><?= $trocada ? 'Enviada pelo painel' : 'Original do site' ?></span>
            <span class="foto-soltar" aria-hidden="true"><?= icone('enviar') ?>Solte a foto aqui</span>
          </div>
          <div class="foto-texto">
            <h3><?= e($foto['rotulo']) ?></h3>
            <p class="painel-nota">
              <?= e($foto['onde']) ?>
              <?= $trocada ? 'Enviada pelo painel.' : 'É a foto original do site.' ?>
            </p>

            <form class="painel-foto-envio" method="post" action="index.php#fotos" enctype="multipart/form-data">
              <?= campoCsrf() ?>
              <input type="hidden" name="acao" value="foto">
              <input type="hidden" name="foto" value="<?= e($foto['chave']) ?>">
              <input class="painel-arquivo" id="<?= e($id) ?>" type="file" name="arquivo"
                     accept="image/jpeg,image/png,image/webp" required
                     data-previa="<?= e($id) ?>-previa">
              <label class="botao-arquivo" for="<?= e($id) ?>"><?= icone('foto') ?><span>Escolher foto</span></label>
              <p class="painel-dica painel-foto-situacao" id="<?= e($id) ?>-situacao" aria-live="polite"></p>
              <div class="painel-form-acoes">
                <button type="submit" class="painel-acao"><?= icone('enviar') ?>Enviar foto</button>
              </div>
            </form>

<?php if ($trocada): ?>
            <form class="painel-foto-original" method="post" action="index.php#fotos"
                  data-confirmar="Voltar a usar a foto original do site no lugar da que foi enviada?">
              <?= campoCsrf() ?>
              <input type="hidden" name="acao" value="foto_original">
              <input type="hidden" name="foto" value="<?= e($foto['chave']) ?>">
              <button type="submit" class="painel-link"><?= icone('desfazer') ?>Voltar à foto original</button>
            </form>
<?php endif; ?>
          </div>
        </article>
<?php endforeach; ?>
      </div>
    </section>

    <!-- Publicação ------------------------------------------------------ -->
    <section class="cartao" id="site" aria-labelledby="tituloSite">
      <header class="cartao-topo">
        <span class="cartao-ico"><?= icone('globo') ?></span>
        <div>
          <h2 id="tituloSite">Publicação</h2>
          <p class="painel-legenda">Depois de enviar um pacote novo para a hospedagem, basta abrir o painel: ele publica sozinho.</p>
        </div>
      </header>
<?php blocoDeAviso($aviso, 'site'); ?>

      <dl class="publicacao-numeros">
        <div>
          <dt>Páginas publicadas</dt>
          <dd><?= (int) $n['paginas'] ?></dd>
        </div>
        <div>
          <dt>Sobre tipos de câncer</dt>
          <dd><?= (int) $n['canceres'] ?></dd>
        </div>
        <div>
          <dt>Última publicação</dt>
<?php if ($publicacao): ?>
          <dd><?= e(date('d/m', (int) $publicacao['em'])) ?> <small>às <?= e(date('H:i', (int) $publicacao['em'])) ?></small></dd>
<?php else: ?>
          <dd><small>ainda não houve</small></dd>
<?php endif; ?>
        </div>
      </dl>

      <form class="painel-republicar" method="post" action="index.php#site">
        <?= campoCsrf() ?>
        <input type="hidden" name="acao" value="publicar">
        <button type="submit" class="painel-acao painel-acao--leve"><?= icone('atualizar') ?>Publicar de novo</button>
      </form>
    </section>

    <!-- Acessos --------------------------------------------------------- -->
    <section class="cartao" id="acessos" aria-labelledby="tituloAcessos">
      <header class="cartao-topo">
        <span class="cartao-ico"><?= icone('pessoas') ?></span>
        <div>
          <h2 id="tituloAcessos">Acessos</h2>
          <p class="painel-legenda">Quem consegue entrar neste painel.</p>
        </div>
      </header>
<?php blocoDeAviso($aviso, 'acessos'); ?>

      <ul class="painel-acessos">
<?php foreach (array_keys($usuarios) as $email): ?>
        <li>
          <span class="acesso-avatar" aria-hidden="true"><?= e(strtoupper(substr($email, 0, 1))) ?></span>
          <span class="acesso-email"><?= e($email) ?><?php if ($email === $eu): ?><span class="painel-voce">você</span><?php endif; ?></span>
<?php if ($email !== $eu): ?>
          <form method="post" action="index.php#acessos"
                data-confirmar="Remover o acesso de <?= e($email) ?>? A pessoa sai do painel na hora.">
            <?= campoCsrf() ?>
            <input type="hidden" name="acao" value="acesso_remover">
            <input type="hidden" name="email" value="<?= e($email) ?>">
            <button type="submit" class="painel-link painel-link--perigo"><?= icone('lixeira') ?>Remover</button>
          </form>
<?php endif; ?>
        </li>
<?php endforeach; ?>
      </ul>

      <details class="painel-gaveta"<?= $gavetaAberta === 'acesso' ? ' open' : '' ?>>
        <summary><?= icone('mais') ?>Adicionar acesso ou trocar a senha de alguém</summary>
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
        <summary><?= icone('chave') ?>Trocar minha senha</summary>
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

    <aside class="app-rodape">
      <?= icone('info') ?>
      <p>
        O texto das páginas e o conteúdo clínico dos tipos de câncer ficam no
        código do site. Para alterar qualquer um dos dois, fale com quem cuida
        da parte técnica.
      </p>
    </aside>
  </main>
</div>
<?php
fecharPagina();
