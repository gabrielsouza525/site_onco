<?php
/**
 * Núcleo do painel administrativo.
 *
 * O site é HTML estático. O pacote enviado à hospedagem (scripts/pacote.js)
 * traz cada página como "modelo", com {{TELEFONE}} e afins no lugar dos dados
 * de contato. Este painel guarda os dados e publica: aplica os valores nos
 * modelos e grava o HTML final na raiz do site. Se o PHP parar um dia, o site
 * continua no ar — só o painel deixa de funcionar.
 *
 * Onde fica cada coisa:
 *   admin/modelos/   páginas-modelo, versao.json e site-inicial.json (vêm no pacote)
 *   pasta de dados   site.json, usuarios.php, publicado.json, sessões — ver pastaDeDados()
 *
 * Compatível com PHP 7.4 em diante.
 */

declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');

define('ADMIN_DIR', dirname(__DIR__));
define('RAIZ_SITE', dirname(ADMIN_DIR));
define('MODELOS_DIR', ADMIN_DIR . '/modelos');

/** Duração da sessão com "Manter conectado" marcado, e sem ele. */
const SESSAO_LONGA = 30 * 86400;
const SESSAO_CURTA = 12 * 3600;

/** Login: tentativas erradas antes do bloqueio, e quanto ele dura. */
const TENTATIVAS_MAXIMAS = 5;
const BLOQUEIO_SEGUNDOS = 15 * 60;

/** Por quanto tempo o arquivo que libera o cadastro vale depois de criado. */
const LIBERACAO_SEGUNDOS = 2 * 3600;
const ARQUIVO_LIBERACAO = 'liberar-cadastro.txt';

/* ---------------------------------------------------------------------------
 * Utilidades
 * ------------------------------------------------------------------------ */

function e($texto): string
{
    return htmlspecialchars((string) $texto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function lerJson(string $arquivo): ?array
{
    if (!is_file($arquivo)) {
        return null;
    }
    $dados = json_decode((string) file_get_contents($arquivo), true);
    return is_array($dados) ? $dados : null;
}

/**
 * Grava por cima sem deixar o arquivo pela metade: escreve ao lado e troca
 * de nome. Quem estiver lendo vê a versão antiga ou a nova, nunca um pedaço.
 * As páginas precisam de 0644 para o servidor web conseguir servi-las; os
 * dados do painel ficam em 0600.
 */
function gravarAtomico(string $arquivo, string $conteudo, int $modo = 0600): void
{
    $temporario = $arquivo . '.tmp-' . bin2hex(random_bytes(4));
    if (file_put_contents($temporario, $conteudo, LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível gravar ' . basename($arquivo) . '.');
    }
    @chmod($temporario, $modo);
    if (!@rename($temporario, $arquivo)) {
        @unlink($temporario);
        throw new RuntimeException('Não foi possível substituir ' . basename($arquivo) . '.');
    }
}

function https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || ((string) ($_SERVER['SERVER_PORT'] ?? '') === '443');
}

/** Caminho do painel no endereço, com barra no fim — ex.: "/admin/". */
function caminhoDoPainel(): string
{
    $dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/admin/index.php')));
    return rtrim($dir, '/') . '/';
}

function ir(string $destino): void
{
    header('Location: ' . $destino, true, 303);
    exit;
}

function cabecalhosDeSeguranca(): void
{
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
}

/* ---------------------------------------------------------------------------
 * Pasta de dados
 *
 * De preferência fora da public_html, ao lado dela: assim nem um .htaccess
 * ignorado pelo servidor expõe as senhas. Se a hospedagem não deixar criar
 * pasta ali, cai para admin/dados, que tem .htaccess negando acesso — e os
 * arquivos sensíveis são .php que não imprimem nada se forem abertos.
 * ------------------------------------------------------------------------ */

function pastaDeDados(): string
{
    static $pasta = null;
    if ($pasta !== null) {
        return $pasta;
    }

    $interna = ADMIN_DIR . '/dados';
    $externa = dirname(RAIZ_SITE) . '/painel-dados';

    // Se já há dados na pasta interna, ela continua valendo: trocar de pasta
    // agora faria o painel "esquecer" acessos e dados salvos.
    $candidatas = is_file($interna . '/usuarios.php') || is_file($interna . '/site.json')
        ? [$interna]
        : [$externa, $interna];

    foreach ($candidatas as $c) {
        if (!is_dir($c)) {
            @mkdir($c, 0700, true);
        }
        if (is_dir($c) && is_writable($c)) {
            return $pasta = $c;
        }
    }
    throw new RuntimeException(
        'O painel não tem onde guardar os dados: nem a pasta painel-dados, ao lado da ' .
        'public_html, nem admin/dados aceitam gravação.'
    );
}

/** Onde criar o arquivo que libera o cadastro, dito para uma pessoa. */
function ondeFicaADados(): string
{
    return basename(pastaDeDados()) === 'painel-dados'
        ? 'na pasta painel-dados, que fica ao lado da public_html (dentro de domains/' .
          basename(dirname(RAIZ_SITE)) . ')'
        : 'na pasta public_html/admin/dados';
}

/* ---------------------------------------------------------------------------
 * Sessão e proteção de formulários
 * ------------------------------------------------------------------------ */

function iniciarSessao(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Sessões numa pasta só do painel: a limpeza automática de outros sites
    // da hospedagem não derruba quem pediu para continuar conectado.
    $pasta = pastaDeDados() . '/sessoes';
    if (!is_dir($pasta)) {
        @mkdir($pasta, 0700, true);
    }
    if (is_dir($pasta) && is_writable($pasta)) {
        ini_set('session.save_path', $pasta);
    }
    ini_set('session.gc_maxlifetime', (string) SESSAO_LONGA);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_name('painel_sessao');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => caminhoDoPainel(),
        'secure' => https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    if (!empty($_SESSION['ate']) && time() > (int) $_SESSION['ate']) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
}

function tokenCsrf(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function campoCsrf(): string
{
    return '<input type="hidden" name="csrf" value="' . e(tokenCsrf()) . '">';
}

/** Recusa POST sem o token da sessão: impede que outro site envie por você. */
function exigirCsrf(): void
{
    $enviado = $_POST['csrf'] ?? '';
    if (!is_string($enviado) || !hash_equals(tokenCsrf(), $enviado)) {
        avisar('erro', 'O formulário expirou. Confira os dados e envie de novo.');
        // Só o nome do arquivo: o endereço da requisição poderia começar com
        // "//outro-site" e virar um redirecionamento para fora.
        ir(basename((string) ($_SERVER['SCRIPT_NAME'] ?? 'index.php')));
    }
}

/**
 * Mensagem que aparece uma vez, na próxima tela. `secao` é o bloco do painel
 * onde ela aparece — o mesmo para onde a página volta rolada, senão a pessoa
 * não veria a confirmação do que acabou de fazer.
 */
function avisar(string $tipo, string $texto, string $secao = ''): void
{
    $_SESSION['aviso'] = ['tipo' => $tipo, 'texto' => $texto, 'secao' => $secao];
}

function retirarAviso(): ?array
{
    $aviso = $_SESSION['aviso'] ?? null;
    unset($_SESSION['aviso']);
    return is_array($aviso) ? $aviso : null;
}

/* ---------------------------------------------------------------------------
 * Acessos
 * ------------------------------------------------------------------------ */

function arquivoDeUsuarios(): string
{
    return pastaDeDados() . '/usuarios.php';
}

/** @return array<string, array{hash: string, criado: string}> */
function carregarUsuarios(): array
{
    $arquivo = arquivoDeUsuarios();
    if (!is_file($arquivo)) {
        return [];
    }
    $usuarios = include $arquivo;
    return is_array($usuarios) ? $usuarios : [];
}

function salvarUsuarios(array $usuarios): void
{
    ksort($usuarios);
    $arquivo = arquivoDeUsuarios();
    gravarAtomico(
        $arquivo,
        "<?php\n// Gerado pelo painel. Não edite à mão.\nreturn " . var_export($usuarios, true) . ";\n"
    );
    // Sem isto o OPcache pode continuar servindo a lista antiga por alguns segundos.
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate($arquivo, true);
    }
}

function normalizarEmail(string $email): string
{
    return strtolower(trim($email));
}

function definirSenha(string $email, string $senha): void
{
    $usuarios = carregarUsuarios();
    $email = normalizarEmail($email);
    $usuarios[$email] = [
        'hash' => password_hash($senha, PASSWORD_DEFAULT),
        'criado' => $usuarios[$email]['criado'] ?? date('c'),
    ];
    salvarUsuarios($usuarios);
}

function conferirSenha(string $email, string $senha): bool
{
    $usuarios = carregarUsuarios();
    $email = normalizarEmail($email);
    if (!isset($usuarios[$email])) {
        // Mesmo custo de tempo de um e-mail que existe: a demora da resposta
        // não revela quem tem acesso. O hash é de uma senha aleatória jogada fora.
        password_verify($senha, '$2y$10$F.hus1duHTnYBK1M2P1xN.UdZ/FI1CC3n0euUYVyOviTgwK/Thtae');
        return false;
    }
    $hash = $usuarios[$email]['hash'];
    if (!password_verify($senha, $hash)) {
        return false;
    }
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        definirSenha($email, $senha);
    }
    return true;
}

/** Problema com a senha escolhida, ou null se ela serve. */
function problemaNaSenha(string $senha, string $confirmacao): ?string
{
    if (strlen($senha) < 8) {
        return 'A senha precisa ter pelo menos 8 caracteres.';
    }
    if (strlen($senha) > 200) {
        return 'A senha passou de 200 caracteres.';
    }
    if ($senha !== $confirmacao) {
        return 'A confirmação não bate com a senha.';
    }
    return null;
}

function usuarioAtual(): ?string
{
    $email = $_SESSION['usuario'] ?? null;
    if (!is_string($email)) {
        return null;
    }
    // Acesso removido por outra pessoa deixa de valer na hora.
    return isset(carregarUsuarios()[$email]) ? $email : null;
}

function exigirLogin(): string
{
    $email = usuarioAtual();
    if ($email === null) {
        ir('entrar.php');
    }
    return $email;
}

function entrarComo(string $email, bool $manter): void
{
    session_regenerate_id(true);
    $_SESSION['usuario'] = normalizarEmail($email);
    $_SESSION['ate'] = time() + ($manter ? SESSAO_LONGA : SESSAO_CURTA);
    if ($manter) {
        // O cookie da sessão nasce sem validade (some ao fechar o navegador);
        // aqui ele ganha os 30 dias.
        setcookie(session_name(), session_id(), [
            'expires' => (int) $_SESSION['ate'],
            'path' => caminhoDoPainel(),
            'secure' => https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

function sair(): void
{
    $_SESSION = [];
    setcookie(session_name(), '', [
        'expires' => time() - 3600,
        'path' => caminhoDoPainel(),
        'secure' => https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_destroy();
}

/* ---------------------------------------------------------------------------
 * Limite de tentativas de login
 *
 * Guardado por IP, mas o IP entra embaralhado (hash): o arquivo não vira uma
 * lista de endereços de quem visitou o painel.
 * ------------------------------------------------------------------------ */

function arquivoDeTentativas(): string
{
    return pastaDeDados() . '/tentativas.php';
}

function lerTentativas(): array
{
    $arquivo = arquivoDeTentativas();
    if (!is_file($arquivo)) {
        return [];
    }
    $conteudo = (string) file_get_contents($arquivo);
    $json = substr($conteudo, (int) strpos($conteudo, "\n") + 1);
    $dados = json_decode($json, true);
    return is_array($dados) ? $dados : [];
}

function gravarTentativas(array $dados): void
{
    // Some com registros velhos para o arquivo não crescer para sempre.
    $agora = time();
    foreach ($dados as $chave => $registro) {
        if (($registro['bloqueio'] ?? 0) < $agora && ($registro['desde'] ?? 0) < $agora - BLOQUEIO_SEGUNDOS) {
            unset($dados[$chave]);
        }
    }
    gravarAtomico(arquivoDeTentativas(), "<?php exit; ?>\n" . json_encode($dados));
}

function chaveDoVisitante(): string
{
    return hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . __DIR__);
}

/** Até quando este visitante está bloqueado (0 se não está). */
function bloqueadoAte(): int
{
    $registro = lerTentativas()[chaveDoVisitante()] ?? [];
    $ate = (int) ($registro['bloqueio'] ?? 0);
    return $ate > time() ? $ate : 0;
}

function registrarFalha(): void
{
    $dados = lerTentativas();
    $chave = chaveDoVisitante();
    $agora = time();
    $registro = $dados[$chave] ?? ['n' => 0, 'desde' => $agora];
    if ($agora - (int) $registro['desde'] > BLOQUEIO_SEGUNDOS) {
        $registro = ['n' => 0, 'desde' => $agora];
    }
    $registro['n'] = (int) $registro['n'] + 1;
    if ($registro['n'] >= TENTATIVAS_MAXIMAS) {
        $registro = ['n' => 0, 'desde' => $agora, 'bloqueio' => $agora + BLOQUEIO_SEGUNDOS];
    }
    $dados[$chave] = $registro;
    gravarTentativas($dados);
}

function limparFalhas(): void
{
    $dados = lerTentativas();
    unset($dados[chaveDoVisitante()]);
    gravarTentativas($dados);
}

/* ---------------------------------------------------------------------------
 * Liberação do cadastro
 *
 * O primeiro acesso — e uma senha nova, para quem esqueceu a sua — só pode
 * ser criado por quem consegue mexer nos arquivos da hospedagem: é preciso
 * criar o arquivo liberar-cadastro.txt na pasta de dados. Ninguém de fora
 * consegue isso, e o arquivo vence em 2 horas para não ficar esquecido lá.
 * ------------------------------------------------------------------------ */

function arquivoDeLiberacao(): string
{
    return pastaDeDados() . '/' . ARQUIVO_LIBERACAO;
}

function cadastroLiberado(): bool
{
    $arquivo = arquivoDeLiberacao();
    clearstatcache(true, $arquivo);
    return is_file($arquivo) && (time() - (int) filemtime($arquivo)) <= LIBERACAO_SEGUNDOS;
}

function liberacaoVencida(): bool
{
    return is_file(arquivoDeLiberacao()) && !cadastroLiberado();
}

function encerrarLiberacao(): void
{
    @unlink(arquivoDeLiberacao());
}

/* ---------------------------------------------------------------------------
 * Dados de contato
 * ------------------------------------------------------------------------ */

/**
 * Os campos do painel. `obrigatorio`: sem ele o paciente não chega ao
 * consultório, então o painel não deixa salvar em branco. `opcional`: em
 * branco é uma escolha, e a lista mostra sem alarde. O WhatsApp fica no
 * meio — pode ficar vazio, mas a lista avisa, porque os formulários de
 * contato dependem dele.
 */
function campos(): array
{
    return [
        ['chave' => 'telefone', 'rotulo' => 'Telefone', 'tipo' => 'tel', 'obrigatorio' => true,
         'dica' => 'Como aparece no site. Pode ser fixo ou celular.'],
        ['chave' => 'whatsapp', 'rotulo' => 'WhatsApp', 'tipo' => 'whatsapp',
         'dica' => 'Celular com DDD. É para ele que vão as mensagens dos formulários de contato.',
         'nota' => 'Sem ele, os formulários de contato avisam que o WhatsApp não está configurado.'],
        ['chave' => 'endereco', 'rotulo' => 'Endereço', 'tipo' => 'texto', 'obrigatorio' => true,
         'dica' => 'Rua, número, bairro e CEP.'],
        ['chave' => 'cidade', 'rotulo' => 'Cidade', 'tipo' => 'texto', 'obrigatorio' => true],
        ['chave' => 'horario', 'rotulo' => 'Horário de atendimento', 'tipo' => 'texto', 'obrigatorio' => true],
        ['chave' => 'instagram', 'rotulo' => 'Instagram', 'tipo' => 'link', 'opcional' => true,
         'exemplo' => 'https://www.instagram.com/perfil'],
        ['chave' => 'facebook', 'rotulo' => 'Facebook', 'tipo' => 'link', 'opcional' => true,
         'exemplo' => 'https://www.facebook.com/pagina'],
        ['chave' => 'linkedin', 'rotulo' => 'LinkedIn', 'tipo' => 'link', 'opcional' => true,
         'exemplo' => 'https://www.linkedin.com/in/perfil'],
    ];
}

/**
 * Os dados salvos no painel por cima dos que vieram no pacote. Um campo novo
 * criado no código entra com o valor inicial; o que foi salvo aqui prevalece.
 */
function carregarDados(): array
{
    $iniciais = lerJson(MODELOS_DIR . '/site-inicial.json') ?? [];
    $salvos = lerJson(pastaDeDados() . '/site.json') ?? [];
    return array_merge($iniciais, $salvos);
}

function salvarDados(array $dados): void
{
    gravarAtomico(
        pastaDeDados() . '/site.json',
        json_encode($dados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
    );
}

/** Mesma regra do formatarTelefone do main.js. */
function formatarTelefone(string $digitos): string
{
    $n = strlen($digitos);
    if (strpos($digitos, '55') === 0 && ($n === 12 || $n === 13)) {
        $digitos = substr($digitos, 2);
    }
    $d = substr($digitos, 0, 11);
    if ($d === '') {
        return '';
    }
    if (strlen($d) <= 2) {
        return '(' . $d;
    }
    $ddd = substr($d, 0, 2);
    $resto = substr($d, 2);
    if (strlen($resto) <= 4) {
        return '(' . $ddd . ') ' . $resto;
    }
    $corte = strlen($d) > 10 ? 5 : 4;
    return '(' . $ddd . ') ' . substr($resto, 0, $corte) . '-' . substr($resto, $corte);
}

/**
 * Texto de exemplo deixado no lugar do dado real: algo entre colchetes, como
 * "[Endereço completo a inserir]", ou um telefone só de zeros depois do DDD,
 * como "(18) 0000-0000". Um número de verdade que termina em 0000 não conta.
 */
function ehExemplo(string $valor): bool
{
    return strpos($valor, '[') !== false
        || (bool) preg_match('/^\D*\d{2}\D*0{4,5}\D*0{4}\D*$/', $valor);
}

/** 'ok', 'exemplo', 'falta' (em branco e necessário) ou 'vazio' (em branco e opcional). */
function estadoDoCampo(array $campo, $valor): string
{
    $v = trim((string) $valor);
    if ($v === '') {
        return empty($campo['opcional']) ? 'falta' : 'vazio';
    }
    return ehExemplo($v) ? 'exemplo' : 'ok';
}

/** Como o valor aparece para quem lê o painel. */
function valorParaExibir(array $campo, $valor): string
{
    $v = trim((string) $valor);
    if ($campo['tipo'] === 'whatsapp' && $v !== '') {
        return formatarTelefone(preg_replace('/\D/', '', $v)) ?: $v;
    }
    return $v;
}

/**
 * Confere o que veio do formulário.
 * @return array{0: array, 1: array<string, string>} [valores limpos, erros por campo]
 */
function validarDados(array $entrada): array
{
    $limpos = [];
    $erros = [];
    foreach (campos() as $campo) {
        $chave = $campo['chave'];
        $v = $entrada[$chave] ?? '';
        $v = is_string($v) ? $v : '';
        $erro = null;

        // Texto que não é UTF-8 válido faria o preg_replace devolver null, e o
        // campo viraria vazio sem ninguém saber por quê.
        if (!preg_match('//u', $v)) {
            $erros[$chave] = 'O texto tem caracteres que o site não reconhece. Digite de novo.';
            $limpos[$chave] = '';
            continue;
        }
        $v = trim((string) preg_replace('/\s+/u', ' ', $v));

        if (strlen($v) > 300) {
            $erro = 'Ficou longo demais. Use no máximo 300 caracteres.';
        } elseif ($campo['tipo'] === 'whatsapp' && $v !== '') {
            $d = (string) preg_replace('/\D/', '', $v);
            if (strpos($d, '55') === 0 && strlen($d) >= 12) {
                $d = substr($d, 2);
            }
            if (strlen($d) < 10 || strlen($d) > 11) {
                $erro = 'O WhatsApp precisa do DDD e do número, como (18) 99123-4567.';
            }
            // O site guarda só os dígitos, com o código do Brasil na frente:
            // é o formato que o link do WhatsApp espera.
            $v = '55' . $d;
        } elseif ($campo['tipo'] === 'tel' && $v !== '') {
            $d = (string) preg_replace('/\D/', '', $v);
            if (strpos($d, '55') === 0 && strlen($d) >= 12) {
                $d = substr($d, 2);
            }
            if (strlen($d) < 10 || strlen($d) > 11) {
                $erro = 'Use um número só, com DDD, como (18) 3621-0000.';
            } else {
                $v = formatarTelefone($d);
            }
        } elseif ($campo['tipo'] === 'link' && $v !== '') {
            if (!preg_match('~^https?://~i', $v)) {
                $v = 'https://' . ltrim($v, '/');
            }
            $host = (string) parse_url($v, PHP_URL_HOST);
            if (!filter_var($v, FILTER_VALIDATE_URL) || strpos($host, '.') === false) {
                $erro = 'Não parece o endereço de um perfil. Copie da barra do navegador, ' .
                    'começando por https://.';
            }
        }

        if ($erro === null && !empty($campo['obrigatorio']) && $v === '') {
            $erro = 'Este campo aparece no rodapé de todas as páginas; não pode ficar em branco.';
        }
        if ($erro !== null) {
            $erros[$chave] = $erro;
        }
        $limpos[$chave] = $v;
    }
    return [$limpos, $erros];
}

/* ---------------------------------------------------------------------------
 * Fotos
 *
 * A foto enviada é guardada na pasta de dados e copiada para public_html/fotos
 * a cada publicação. Como essa pasta não vem no pacote, um pacote novo nunca
 * volta a foto antiga. O nome leva um pedaço do hash do arquivo: foto nova,
 * endereço novo, e nenhum navegador fica mostrando a antiga do cache.
 * ------------------------------------------------------------------------ */

const PASTA_FOTOS_PUBLICA = 'fotos';
const FOTO_LIMITE_BYTES = 15 * 1024 * 1024;
const FOTO_LIMITE_PIXELS = 50000000; // 50 megapixels

/** As fotos que o painel troca. Todas em retrato 3×4, como no layout. */
function fotos(): array
{
    return [
        ['chave' => 'foto_inicio', 'token' => 'FOTO_INICIO', 'nome' => 'inicio',
         'rotulo' => 'Foto da página inicial',
         'onde' => 'Na página inicial, ao lado de “Sobre o médico”.',
         'padrao' => 'assets/img/dr-bruno-kersten-home.jpg', 'largura' => 880, 'altura' => 1173],
        ['chave' => 'foto_sobre', 'token' => 'FOTO_SOBRE', 'nome' => 'sobre',
         'rotulo' => 'Foto da página Sobre',
         'onde' => 'No topo da página “Sobre o Dr. Bruno Kersten”.',
         'padrao' => 'assets/img/dr-bruno-kersten-sobre.jpg', 'largura' => 880, 'altura' => 1173],
    ];
}

function pastaDeFotosGuardadas(): string
{
    return pastaDeDados() . '/fotos';
}

/** A foto foi trocada pelo painel (e o arquivo ainda existe)? */
function fotoTrocada(array $foto, array $dados): bool
{
    $valor = (string) ($dados[$foto['chave']] ?? '');
    return (bool) preg_match('~^' . PASTA_FOTOS_PUBLICA . '/' . $foto['nome'] . '-[a-f0-9]{8}\.jpg$~', $valor)
        && is_file(pastaDeFotosGuardadas() . '/' . basename($valor));
}

/**
 * Endereço que entra no HTML. Qualquer valor estranho — arquivo sumido,
 * caminho que não é de foto do painel — volta para a foto original, para a
 * página nunca ficar com imagem quebrada.
 */
function caminhoDaFoto(array $foto, array $dados): string
{
    return fotoTrocada($foto, $dados) ? (string) $dados[$foto['chave']] : $foto['padrao'];
}

/** Mensagem para quem enviou um arquivo que não chegou. */
function problemaNoEnvio(int $codigo): string
{
    switch ($codigo) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'A foto é maior que o limite que a hospedagem aceita (' .
                ini_get('upload_max_filesize') . '). Envie uma versão menor.';
        case UPLOAD_ERR_PARTIAL:
            return 'A foto chegou pela metade. Tente de novo.';
        case UPLOAD_ERR_NO_FILE:
            return 'Escolha uma foto antes de enviar.';
        default:
            return 'A hospedagem não conseguiu receber a foto (código ' . $codigo . ').';
    }
}

/**
 * Lê a foto enviada, corta no formato da página, reduz e grava como JPEG.
 * Regravar a imagem do zero também descarta o que vinha escondido nela — a
 * localização GPS que o celular anota, por exemplo — e qualquer conteúdo que
 * não seja imagem.
 *
 * @return string caminho público da foto nova, ex.: fotos/inicio-1a2b3c4d.jpg
 */
function processarFoto(array $foto, array $envio): string
{
    if (!function_exists('imagecreatetruecolor')) {
        throw new RuntimeException(
            'A hospedagem está sem a biblioteca de imagens do PHP (GD). Peça ao suporte para ativá-la.'
        );
    }
    $codigo = (int) ($envio['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($codigo !== UPLOAD_ERR_OK) {
        throw new RuntimeException(problemaNoEnvio($codigo));
    }
    $temporario = (string) ($envio['tmp_name'] ?? '');
    if (!is_uploaded_file($temporario)) {
        throw new RuntimeException('Escolha uma foto antes de enviar.');
    }
    if ((int) filesize($temporario) > FOTO_LIMITE_BYTES) {
        throw new RuntimeException('A foto passa de 15 MB. Envie uma versão menor.');
    }

    $info = @getimagesize($temporario);
    $tipos = [IMAGETYPE_JPEG => 'imagecreatefromjpeg', IMAGETYPE_PNG => 'imagecreatefrompng'];
    if (defined('IMAGETYPE_WEBP') && function_exists('imagecreatefromwebp')) {
        $tipos[IMAGETYPE_WEBP] = 'imagecreatefromwebp';
    }
    if (!$info || !isset($tipos[$info[2]])) {
        throw new RuntimeException('Esse arquivo não é uma foto em JPG, PNG ou WebP.');
    }
    [$largura, $altura] = $info;
    if ($largura * $altura > FOTO_LIMITE_PIXELS) {
        throw new RuntimeException('A foto tem resolução alta demais. Envie uma versão menor.');
    }

    // Uma foto de celular aberta na memória ocupa bem mais que o arquivo.
    @ini_set('memory_limit', '256M');
    $origem = @$tipos[$info[2]]($temporario);
    if (!$origem) {
        throw new RuntimeException('Não foi possível abrir a foto. Ela pode estar corrompida.');
    }

    // Celular grava a foto deitada e anota "gire 90°"; sem isto ela sairia torta.
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($temporario);
        $giro = [3 => 180, 6 => -90, 8 => 90][(int) ($exif['Orientation'] ?? 1)] ?? 0;
        if ($giro) {
            $girada = imagerotate($origem, $giro, 0);
            if ($girada) {
                imagedestroy($origem);
                $origem = $girada;
            }
        }
    }
    $largura = imagesx($origem);
    $altura = imagesy($origem);

    // Corta no formato da página. Sobrando altura, o corte puxa para cima nas
    // fotos de retrato (o rosto costuma estar no terço de cima); nas capas de
    // artigo, fica no meio. É o "viés".
    $proporcao = $foto['largura'] / $foto['altura'];
    $vies = (float) ($foto['vies'] ?? 0.25);
    if ($largura / $altura > $proporcao) {
        $corteA = $altura;
        $corteL = (int) round($altura * $proporcao);
        $x = (int) (($largura - $corteL) / 2);
        $y = 0;
    } else {
        $corteL = $largura;
        $corteA = (int) round($largura / $proporcao);
        $x = 0;
        $y = (int) (($altura - $corteA) * $vies);
    }
    if ($corteL < 400) {
        imagedestroy($origem);
        throw new RuntimeException('A foto é pequena demais para o site. Use uma com pelo menos 400 pixels de largura.');
    }

    // Não amplia: foto menor que o tamanho do site fica no tamanho dela.
    $finalL = min($foto['largura'], $corteL);
    $finalA = (int) round($finalL / $proporcao);
    $destino = imagecreatetruecolor($finalL, $finalA);
    // PNG com fundo transparente ficaria preto em JPEG.
    imagefill($destino, 0, 0, imagecolorallocate($destino, 255, 255, 255));
    imagecopyresampled($destino, $origem, 0, 0, $x, $y, $finalL, $finalA, $corteL, $corteA);
    imagedestroy($origem);
    imageinterlace($destino, true);

    ob_start();
    imagejpeg($destino, null, 82);
    $jpeg = (string) ob_get_clean();
    imagedestroy($destino);

    $nome = $foto['nome'] . '-' . substr(sha1($jpeg), 0, 8) . '.jpg';
    $pasta = pastaDeFotosGuardadas();
    if (!is_dir($pasta)) {
        @mkdir($pasta, 0700, true);
    }
    gravarAtomico($pasta . '/' . $nome, $jpeg, 0644);
    return PASTA_FOTOS_PUBLICA . '/' . $nome;
}

/**
 * Deixa public_html/fotos com exatamente as fotos em uso: copia as que
 * faltam e apaga as que foram substituídas. Só mexe em arquivos com o nome
 * que o painel dá; o resto da pasta fica como está.
 *
 * A capa de um rascunho fica guardada na pasta de dados, mas só vai para o
 * site quando o artigo é publicado.
 */
function sincronizarFotos(array $dados, array $artigos): void
{
    $publica = RAIZ_SITE . '/' . PASTA_FOTOS_PUBLICA;
    $guardadas = [];
    $publicas = [];
    foreach (fotos() as $foto) {
        if (fotoTrocada($foto, $dados)) {
            $guardadas[] = $publicas[] = basename((string) $dados[$foto['chave']]);
        }
    }
    foreach ($artigos as $artigo) {
        $capa = caminhoDaCapa($artigo);
        if (strpos($capa, PASTA_FOTOS_PUBLICA . '/') === 0) {
            $guardadas[] = basename($capa);
            if (!empty($artigo['publicado'])) {
                $publicas[] = basename($capa);
            }
        }
    }

    if ($publicas && !is_dir($publica)) {
        @mkdir($publica, 0755, true);
    }
    foreach ($publicas as $nome) {
        $origem = pastaDeFotosGuardadas() . '/' . $nome;
        $destino = $publica . '/' . $nome;
        if (!is_file($destino) || filesize($destino) !== filesize($origem)) {
            gravarAtomico($destino, (string) file_get_contents($origem), 0644);
        }
    }

    $nomes = array_merge(array_column(fotos(), 'nome'), [configDaCapa()['nome']]);
    $padrao = '/^(' . implode('|', $nomes) . ')-[a-f0-9]{8}\.jpg$/';
    foreach ([$publica => $publicas, pastaDeFotosGuardadas() => $guardadas] as $pasta => $emUso) {
        foreach (glob($pasta . '/*.jpg') ?: [] as $arquivo) {
            $nome = basename($arquivo);
            if (preg_match($padrao, $nome) && !in_array($nome, $emUso, true)) {
                @unlink($arquivo);
            }
        }
    }
}

/* ---------------------------------------------------------------------------
 * Publicação
 * ------------------------------------------------------------------------ */

/**
 * Mesma regra do TOKENS_SITE do build.js — se mudar lá, muda aqui, senão o
 * HTML publicado pelo painel sai diferente do gerado pelo build.
 */
function tokensDoSite(array $s): array
{
    $rede = static function ($v): string {
        $v = trim((string) $v);
        return $v !== '' ? $v : '#';
    };
    $whatsapp = (string) preg_replace('/\D/', '', (string) ($s['whatsapp'] ?? ''));
    $valores = [
        'TELEFONE' => (string) ($s['telefone'] ?? ''),
        'ENDERECO' => (string) ($s['endereco'] ?? ''),
        'CIDADE' => (string) ($s['cidade'] ?? ''),
        'HORARIO' => (string) ($s['horario'] ?? ''),
        'INSTAGRAM' => $rede($s['instagram'] ?? ''),
        'FACEBOOK' => $rede($s['facebook'] ?? ''),
        'LINKEDIN' => $rede($s['linkedin'] ?? ''),
        'WHATSAPP' => $whatsapp !== '' ? 'https://wa.me/' . $whatsapp : '#',
        'WHATSAPP_NUMERO' => $whatsapp,
    ];
    foreach (fotos() as $foto) {
        $valores[$foto['token']] = caminhoDaFoto($foto, $s);
    }
    $tokens = [];
    foreach ($valores as $nome => $valor) {
        $tokens['{{' . $nome . '}}'] = htmlspecialchars($valor, ENT_COMPAT | ENT_SUBSTITUTE, 'UTF-8');
    }
    return $tokens;
}

function arquivoDePublicacao(): string
{
    return pastaDeDados() . '/publicado.json';
}

function ultimaPublicacao(): ?array
{
    return lerJson(arquivoDePublicacao());
}

function versaoDosModelos(): string
{
    return (string) (lerJson(MODELOS_DIR . '/versao.json')['versao'] ?? '');
}

/**
 * Regrava o índice da busca com os artigos atuais: a parte fixa vem do pacote
 * (busca-base.json), os artigos entram no fim. Sai idêntico ao do build.js —
 * por isso o JSON é compacto, sem escapar acentos nem barras.
 *
 * @return string assinatura do arquivo, para o endereço ?v= das páginas
 */
function gravarIndiceDeBusca(array $artigos): string
{
    $entradas = array_merge(
        lerJson(MODELOS_DIR . '/busca-base.json') ?? [],
        array_map('entradaDeBusca', artigosPublicados($artigos))
    );
    $json = json_encode($entradas, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
    $conteudo = "/* Gerado automaticamente por build.js — não editar à mão. */\n" .
        'window.SEARCH_INDEX = ' . $json . ";\n";
    gravarAtomico(RAIZ_SITE . '/assets/js/search-index.js', $conteudo, 0644);
    return substr(md5($conteudo), 0, 8);
}

/** @return string[] nomes dos modelos, só os que têm cara de página do site */
function modelosDisponiveis(): array
{
    $nomes = [];
    foreach (glob(MODELOS_DIR . '/*.html') ?: [] as $arquivo) {
        $nome = basename($arquivo);
        if (preg_match('/^[a-z0-9-]+\.html$/', $nome)) {
            $nomes[] = $nome;
        }
    }
    sort($nomes);
    return $nomes;
}

/**
 * Aplica os dados em todos os modelos e grava as páginas na raiz do site.
 * Remove só as páginas que o próprio painel publicou antes e que deixaram de
 * existir — arquivos que alguém pôs à mão na hospedagem ficam onde estão.
 */
function publicar(): array
{
    $modelos = modelosDisponiveis();
    if (!$modelos) {
        throw new RuntimeException(
            'A pasta admin/modelos está vazia. Envie de novo o pacote do site.'
        );
    }

    $trava = fopen(pastaDeDados() . '/.trava', 'c');
    if ($trava) {
        flock($trava, LOCK_EX);
    }
    try {
        $dados = carregarDados();
        $artigos = carregarArtigos();
        // As fotos primeiro: quando a página nova sair, a foto já está lá.
        sincronizarFotos($dados, $artigos);
        $tokens = tokensDoSite($dados);
        $tokens['{{V_BUSCA}}'] = gravarIndiceDeBusca($artigos);

        // Mesma ordem do build.js: primeiro o conteúdo gerado (a lista de
        // artigos), depois os dados de contato.
        $conteudo = ['{{ARTIGOS_LISTA}}' => listaDeArtigos($artigos)];
        foreach ($modelos as $nome) {
            $html = strtr(strtr((string) file_get_contents(MODELOS_DIR . '/' . $nome), $conteudo), $tokens);
            gravarAtomico(RAIZ_SITE . '/' . $nome, $html, 0644);
        }

        // Uma página por artigo publicado, a partir do modelo único.
        $publicadas = $modelos;
        $modeloArtigo = MODELOS_DIR . '/_artigo.html';
        if (is_file($modeloArtigo)) {
            $base = (string) file_get_contents($modeloArtigo);
            foreach (artigosPublicados($artigos) as $artigo) {
                $nome = 'artigo-' . $artigo['slug'] . '.html';
                if (!preg_match('/^artigo-[a-z0-9-]+\.html$/', $nome)) {
                    continue;
                }
                gravarAtomico(RAIZ_SITE . '/' . $nome, strtr(strtr($base, tokensDoArtigo($artigo)), $tokens), 0644);
                $publicadas[] = $nome;
            }
        }

        $anterior = ultimaPublicacao() ?? [];
        foreach ((array) ($anterior['arquivos'] ?? []) as $velho) {
            $velho = basename((string) $velho);
            if (!in_array($velho, $publicadas, true)
                && preg_match('/^[a-z0-9-]+\.html$/', $velho)
                && is_file(RAIZ_SITE . '/' . $velho)) {
                @unlink(RAIZ_SITE . '/' . $velho);
            }
        }

        $registro = ['versao' => versaoDosModelos(), 'arquivos' => $publicadas, 'em' => time()];
        gravarAtomico(arquivoDePublicacao(), json_encode($registro, JSON_PRETTY_PRINT) . "\n");
        return $registro;
    } finally {
        if ($trava) {
            flock($trava, LOCK_UN);
            fclose($trava);
        }
    }
}

/**
 * Publica sozinho quando chega um pacote novo: as páginas do pacote vêm sem
 * os dados de contato, e só ficam completas depois de passar por aqui.
 * Basta abrir o painel uma vez depois de enviar o pacote.
 */
function publicarSePreciso(): void
{
    if (!modelosDisponiveis()) {
        return;
    }
    $ultima = ultimaPublicacao();
    if ($ultima === null || ($ultima['versao'] ?? '') !== versaoDosModelos()) {
        publicar();
    }
}

/** Contagens para as telas: páginas do site, tipos de câncer e artigos. */
function contagens(): array
{
    $modelos = modelosDisponiveis();
    $canceres = count(array_filter($modelos, static function ($n) {
        return strpos($n, 'cancer-') === 0;
    }));
    $artigos = count(artigosPublicados(carregarArtigos()));
    // busca e 404 não são conteúdo; não entram na conta de páginas publicadas.
    $paginas = count(array_diff($modelos, ['404.html', 'busca.html'])) + $artigos;
    return ['paginas' => $paginas, 'canceres' => $canceres, 'artigos' => $artigos];
}

/* ---------------------------------------------------------------------------
 * Toda tela do painel começa por aqui.
 * ------------------------------------------------------------------------ */

require __DIR__ . '/artigos.php';

cabecalhosDeSeguranca();
try {
    pastaDeDados();
} catch (Throwable $erro) {
    http_response_code(500);
    echo '<!DOCTYPE html><meta charset="UTF-8"><title>Painel indisponível</title>',
        '<p style="font-family:sans-serif;max-width:560px;margin:10vh auto">', e($erro->getMessage()), '</p>';
    exit;
}
iniciarSessao();
try {
    publicarSePreciso();
} catch (Throwable $erro) {
    // A tela abre mesmo assim; o painel mostra o problema no bloco "O site".
    $GLOBALS['erroDePublicacao'] = $erro->getMessage();
}
