<?php
/**
 * Assistente virtual do site: tudo o que assistente/responder.php usa.
 *
 * Como funciona, de ponta a ponta:
 *   1. assets/js/assistente.js manda a conversa (as últimas mensagens) em JSON;
 *   2. responder.php confere o pedido, o limite de uso e o histórico;
 *   3. este arquivo monta as instruções (regras.md + conhecimento.md + dados
 *      do consultório + artigos publicados) e chama a API do Google Gemini;
 *   4. a resposta volta como texto puro, com uma assinatura que impede alguém
 *      de inventar falas do assistente no histórico.
 *
 * Privacidade (LGPD): o conteúdo das conversas não é gravado em lugar nenhum
 * do servidor. O que fica é só o necessário para o limite de uso: o IP
 * embaralhado (hash) e os horários das mensagens dos últimos minutos.
 *
 * A chave da API fica em painel-dados/assistente.php, fora da public_html.
 * Ver configDoAssistente() e o README.
 *
 * Compatível com PHP 7.4 em diante.
 */

declare(strict_types=1);

// Funções do painel (pasta de dados, dados de contato, artigos), sem abrir
// sessão nem publicar nada. O painel, quando inclui este arquivo, já as tem.
if (!function_exists('pastaDeDados')) {
    define('NUCLEO_SO_FUNCOES', true);
    require dirname(__DIR__, 2) . '/admin/inc/nucleo.php';
}

/**
 * Valores usados quando a configuração não diz outra coisa. Qualquer um deles
 * pode ser trocado em painel-dados/assistente.php.
 */
const ASSISTENTE_PADRAO = [
    'chave' => '',                         // chave da API do Google AI Studio
    'modelo' => 'gemini-3.5-flash-lite',   // código do modelo do Gemini
    'raciocinio' => 'MINIMAL',             // thinkingLevel; '' usa o padrão do modelo
    'max_caracteres' => 800,               // por mensagem de quem pergunta
    'historico' => 10,                     // mensagens enviadas à IA a cada pergunta
    'limite_por_ip' => 20,                 // mensagens por visitante...
    'janela_minutos' => 10,                // ...a cada tantos minutos
    'limite_diario' => 300,                // teto do site inteiro por dia; 0 = sem teto
    'tempo_limite' => 20,                  // segundos esperando a API
    'max_tokens_resposta' => 1024,         // inclui o "raciocínio" do modelo
    'servidor' => 'https://generativelanguage.googleapis.com',
];

/** Tamanho máximo do pedido inteiro, em bytes. */
const ASSISTENTE_PEDIDO_MAXIMO = 128 * 1024;

/** Tamanho máximo aceito para uma resposta do assistente vinda no histórico. */
const ASSISTENTE_RESPOSTA_MAXIMA = 6000;

/**
 * Um problema com mensagem para quem está usando o site. O código vai junto
 * para o JavaScript decidir o que fazer (por exemplo, recomeçar a conversa).
 */
final class ErroDoAssistente extends RuntimeException
{
    /** @var int */
    public $status;
    /** @var string */
    public $codigo;

    public function __construct(int $status, string $codigo, string $mensagem = '')
    {
        parent::__construct($mensagem !== '' ? $mensagem : mensagemDeErro($codigo));
        $this->status = $status;
        $this->codigo = $codigo;
    }
}

/** O que quem usa o site lê em cada problema. Sempre com uma saída: a página de contato. */
function mensagemDeErro(string $codigo): string
{
    $mensagens = [
        'limite' => 'Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos para continuar ' .
            'ou fale com a equipe pela página contato.html.',
        'limite_diario' => 'O assistente atingiu o limite de conversas de hoje. Para falar com a equipe, ' .
            'use a página contato.html.',
        'ocupado' => 'O assistente recebeu muitas perguntas ao mesmo tempo. Tente de novo em alguns minutos ' .
            'ou fale com a equipe pela página contato.html.',
        'mensagem_longa' => 'A mensagem passou do limite de caracteres. Tente resumir a pergunta.',
        'historico' => 'Não foi possível continuar esta conversa. Comece uma nova conversa e tente de novo.',
        'bloqueio' => 'Não consigo responder a essa mensagem. Se precisar de orientação sobre o seu caso, ' .
            'fale com a equipe pela página contato.html.',
        'pedido' => 'Não entendi o pedido. Recarregue a página e tente de novo.',
    ];
    return $mensagens[$codigo] ?? 'O assistente está indisponível no momento. Tente de novo em instantes ' .
        'ou fale com a equipe pela página contato.html.';
}

/* ---------------------------------------------------------------------------
 * Configuração
 * ------------------------------------------------------------------------ */

function arquivoDeConfigDoAssistente(): string
{
    return pastaDeDados() . '/assistente.php';
}

/**
 * Lê painel-dados/assistente.php, que é um arquivo PHP do tipo
 *   <?php return ['chave' => '...', 'modelo' => 'gemini-3.5-flash-lite'];
 * Por ser PHP, quem tentasse abri-lo pelo navegador não veria nada — e ele
 * nem fica dentro da public_html.
 */
function configDoAssistente(): array
{
    $arquivo = arquivoDeConfigDoAssistente();
    $lido = is_file($arquivo) ? (static function (string $a) {
        return include $a;
    })($arquivo) : [];
    $c = array_merge(ASSISTENTE_PADRAO, is_array($lido) ? $lido : []);

    // Tipos certos e valores dentro do razoável, mesmo com um arquivo editado à mão.
    foreach (ASSISTENTE_PADRAO as $chave => $padrao) {
        $c[$chave] = is_int($padrao) ? max(0, (int) $c[$chave]) : trim((string) $c[$chave]);
    }
    if (!preg_match('/^[a-z0-9][a-z0-9.\-]{1,62}$/', $c['modelo'])) {
        $c['modelo'] = ASSISTENTE_PADRAO['modelo'];
    }
    $c['raciocinio'] = strtoupper($c['raciocinio']);
    if (!in_array($c['raciocinio'], ['', 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'], true)) {
        $c['raciocinio'] = ASSISTENTE_PADRAO['raciocinio'];
    }
    if (!preg_match('#^https://[a-z0-9.\-]+(:\d+)?$#i', $c['servidor'])
        && !preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $c['servidor'])) {
        $c['servidor'] = ASSISTENTE_PADRAO['servidor'];
    }
    $c['max_caracteres'] = min(max($c['max_caracteres'], 50), 4000);
    $c['historico'] = min(max($c['historico'], 1), 30);
    $c['janela_minutos'] = max($c['janela_minutos'], 1);
    $c['tempo_limite'] = min(max($c['tempo_limite'], 5), 120);
    $c['max_tokens_resposta'] = min(max($c['max_tokens_resposta'], 128), 8192);
    return $c;
}

/** Tem uma chave de verdade (e não o texto de exemplo do README)? */
function assistenteConfigurado(array $c): bool
{
    return strlen($c['chave']) >= 20 && stripos($c['chave'], 'cole') === false;
}

/**
 * Para o cartão do painel: se há chave, qual modelo e quantas mensagens hoje.
 * A chave em si nunca sai daqui.
 */
function situacaoDoAssistente(): array
{
    $c = configDoAssistente();
    $hoje = 0;
    if (is_file(arquivoDeUso())) {
        $conteudo = (string) file_get_contents(arquivoDeUso());
        $uso = json_decode(substr($conteudo, (int) strpos($conteudo, "\n") + 1), true);
        if (is_array($uso) && ($uso['dia'] ?? '') === date('Y-m-d')) {
            $hoje = (int) ($uso['total'] ?? 0);
        }
    }
    return [
        'configurado' => assistenteConfigurado($c),
        'modelo' => $c['modelo'],
        'hoje' => $hoje,
        'limite_diario' => $c['limite_diario'],
        'limite_por_ip' => $c['limite_por_ip'],
        'janela_minutos' => $c['janela_minutos'],
    ];
}

/* ---------------------------------------------------------------------------
 * Assinatura das respostas
 *
 * O histórico fica no navegador (sessionStorage), então pode ser editado.
 * Sem assinatura, alguém poderia inventar falas do "assistente" concordando
 * em quebrar as regras e mandar isso como se fosse a conversa — um jeito
 * conhecido de enganar modelos de linguagem. Cada resposta sai daqui com uma
 * assinatura (HMAC); uma fala sem assinatura válida derruba o pedido.
 * ------------------------------------------------------------------------ */

function segredoDasRespostas(array $c): string
{
    return hash_hmac('sha256', 'assinatura-das-respostas-do-assistente', $c['chave'], true);
}

function assinarResposta(string $texto, array $c): string
{
    return hash_hmac('sha256', $texto, segredoDasRespostas($c));
}

function respostaAutentica(string $texto, string $assinatura, array $c): bool
{
    return hash_equals(assinarResposta($texto, $c), $assinatura);
}

/* ---------------------------------------------------------------------------
 * O pedido
 * ------------------------------------------------------------------------ */

/** Quantidade de caracteres (e não de bytes) de um texto em UTF-8. */
function caracteres(string $texto): int
{
    return function_exists('mb_strlen') ? mb_strlen($texto, 'UTF-8') : (int) preg_match_all('/./su', $texto);
}

/**
 * Só aceita pedido vindo de uma página do próprio site. Sem isso, qualquer
 * outro site poderia usar este endereço como acesso grátis à IA, por conta
 * da chave do consultório.
 */
function conferirOrigem(): void
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $origem = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origem !== '') {
        $partes = parse_url($origem);
        $deOnde = strtolower(($partes['host'] ?? '') . (isset($partes['port']) ? ':' . $partes['port'] : ''));
        if ($deOnde === '' || $deOnde !== $host) {
            throw new ErroDoAssistente(403, 'origem', mensagemDeErro('pedido'));
        }
    }
    $site = (string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '');
    if ($site !== '' && $site !== 'same-origin') {
        throw new ErroDoAssistente(403, 'origem', mensagemDeErro('pedido'));
    }
}

/**
 * Confere o corpo do pedido e devolve as mensagens que vão para a IA:
 * [['papel' => 'usuario'|'assistente', 'texto' => '...'], ...], terminando
 * sempre numa mensagem de quem pergunta.
 */
function lerConversa(string $corpo, array $c): array
{
    $dados = json_decode($corpo, true);
    $lista = is_array($dados) ? ($dados['mensagens'] ?? null) : null;
    if (!is_array($lista) || !$lista || count($lista) > 60 || array_values($lista) !== $lista) {
        throw new ErroDoAssistente(400, 'pedido');
    }

    // Só as últimas mensagens vão para a IA; as mais antigas nem são conferidas.
    $lista = array_slice($lista, -$c['historico']);
    $ultima = count($lista) - 1;
    $mensagens = [];
    foreach ($lista as $i => $m) {
        $papel = is_array($m) ? ($m['papel'] ?? null) : null;
        $texto = is_array($m) && is_string($m['texto'] ?? null) ? $m['texto'] : null;
        if (!in_array($papel, ['usuario', 'assistente'], true) || $texto === null || !preg_match('//u', $texto)) {
            throw new ErroDoAssistente(400, 'pedido');
        }
        $texto = trim(str_replace(["\r\n", "\r"], "\n", $texto));
        if ($texto === '') {
            throw new ErroDoAssistente(400, 'pedido');
        }

        if ($papel === 'usuario') {
            if (caracteres($texto) > $c['max_caracteres']) {
                throw new ErroDoAssistente(400, $i === $ultima ? 'mensagem_longa' : 'pedido');
            }
        } else {
            $assinatura = $m['assinatura'] ?? '';
            if (caracteres($texto) > ASSISTENTE_RESPOSTA_MAXIMA || !is_string($assinatura)
                || !respostaAutentica($texto, $assinatura, $c)) {
                throw new ErroDoAssistente(400, 'historico');
            }
        }
        $mensagens[] = ['papel' => $papel, 'texto' => $texto];
    }

    if (end($mensagens)['papel'] !== 'usuario') {
        throw new ErroDoAssistente(400, 'pedido');
    }
    // O corte pode ter começado numa resposta; a conversa enviada começa por uma pergunta.
    while ($mensagens && $mensagens[0]['papel'] !== 'usuario') {
        array_shift($mensagens);
    }
    return $mensagens;
}

/* ---------------------------------------------------------------------------
 * Limite de uso
 *
 * Por visitante (IP embaralhado, como no login do painel) e um teto diário
 * para o site todo, que protege a conta da API se alguém abusar. O arquivo
 * guarda só hashes e horários dos últimos minutos — nada do que foi escrito.
 * ------------------------------------------------------------------------ */

function arquivoDeUso(): string
{
    return pastaDeDados() . '/assistente-uso.php';
}

/** Conta esta mensagem, ou lança o erro do limite que ela ultrapassaria. */
function usarCota(array $c): void
{
    $arquivo = arquivoDeUso();
    $novo = !is_file($arquivo);
    $h = @fopen($arquivo, 'c+');
    if ($h === false) {
        throw new RuntimeException('Não foi possível abrir o controle de uso do assistente.');
    }
    if ($novo) {
        @chmod($arquivo, 0600);
    }

    try {
        flock($h, LOCK_EX);
        $conteudo = stream_get_contents($h);
        $json = substr((string) $conteudo, (int) strpos((string) $conteudo, "\n") + 1);
        $uso = json_decode($json, true);
        $uso = is_array($uso) ? $uso : [];

        $agora = time();
        $hoje = date('Y-m-d');
        $desde = $agora - $c['janela_minutos'] * 60;

        // Some com o que já saiu da janela, para o arquivo não crescer.
        $ips = [];
        foreach ((array) ($uso['ips'] ?? []) as $chave => $horarios) {
            $recentes = array_values(array_filter((array) $horarios, static function ($t) use ($desde) {
                return (int) $t > $desde;
            }));
            if ($recentes) {
                $ips[(string) $chave] = $recentes;
            }
        }
        $total = ($uso['dia'] ?? '') === $hoje ? (int) ($uso['total'] ?? 0) : 0;

        $eu = chaveDoVisitante();
        if (count($ips[$eu] ?? []) >= $c['limite_por_ip']) {
            throw new ErroDoAssistente(429, 'limite');
        }
        if ($c['limite_diario'] > 0 && $total >= $c['limite_diario']) {
            throw new ErroDoAssistente(429, 'limite_diario');
        }

        $ips[$eu][] = $agora;
        $saida = "<?php exit; ?>\n" . json_encode(['dia' => $hoje, 'total' => $total + 1, 'ips' => $ips]);
        ftruncate($h, 0);
        rewind($h);
        fwrite($h, $saida);
        fflush($h);
    } finally {
        flock($h, LOCK_UN);
        fclose($h);
    }
}

/* ---------------------------------------------------------------------------
 * Instruções para a IA
 *
 * A parte fixa vem primeiro (regras e base de conhecimento) e a que muda pelo
 * painel por último: o Gemini reaproveita o começo igual entre um pedido e
 * outro (cache implícito), o que deixa as respostas mais rápidas e baratas.
 * ------------------------------------------------------------------------ */

/** Telefone, endereço e afins: só os reais. Dado de exemplo não entra. */
function dadosDoConsultorio(): string
{
    $dados = carregarDados();
    $linhas = [];
    foreach (campos() as $campo) {
        $valor = $dados[$campo['chave']] ?? '';
        if (estadoDoCampo($campo, $valor) !== 'ok') {
            continue;
        }
        $linhas[] = '- ' . $campo['rotulo'] . ': ' . valorParaExibir($campo, $valor);
    }

    $temContato = false;
    foreach (['telefone', 'whatsapp', 'endereco'] as $chave) {
        $campo = current(array_filter(campos(), static function ($x) use ($chave) {
            return $x['chave'] === $chave;
        }));
        $temContato = $temContato || estadoDoCampo($campo, $dados[$chave] ?? '') === 'ok';
    }

    $linhas[] = '- Agendamento e contato com a equipe: página contato.html.';
    if (!$temContato) {
        $linhas[] = '- Telefone, WhatsApp e endereço ainda não estão publicados no site. Não informe nenhum: ' .
            'indique a página contato.html.';
    }
    $linhas[] = '- Valores, convênios aceitos e agenda não constam do site: a equipe informa pela página contato.html.';
    return implode("\n", $linhas);
}

function artigosParaOAssistente(): string
{
    $linhas = [];
    foreach (artigosPublicados(carregarArtigos()) as $a) {
        $linhas[] = '- ' . $a['titulo'] . ' (artigo-' . $a['slug'] . '.html): ' . $a['resumo'];
    }
    return $linhas
        ? "Todos estão listados em artigos.html.\n" . implode("\n", $linhas)
        : 'Nenhum artigo publicado no momento.';
}

function promptDoSistema(): string
{
    $regras = @file_get_contents(__DIR__ . '/regras.md');
    $base = @file_get_contents(__DIR__ . '/conhecimento.md');
    if ($regras === false || $base === false) {
        throw new RuntimeException('Faltam regras.md ou conhecimento.md em assistente/inc.');
    }
    return trim($regras) . "\n\n" . trim($base) .
        "\n\n# Dados do consultório\n\n" . dadosDoConsultorio() .
        "\n\n# Artigos publicados\n\n" . artigosParaOAssistente() . "\n";
}

/* ---------------------------------------------------------------------------
 * Chamada à API do Gemini (generateContent)
 * ------------------------------------------------------------------------ */

/** Monta o corpo do pedido à API. Separado para os testes conferirem. */
function pedidoAoGemini(array $mensagens, array $c): array
{
    $contents = [];
    foreach ($mensagens as $m) {
        $contents[] = [
            'role' => $m['papel'] === 'usuario' ? 'user' : 'model',
            'parts' => [['text' => $m['texto']]],
        ];
    }
    $config = ['maxOutputTokens' => $c['max_tokens_resposta']];
    if ($c['raciocinio'] !== '') {
        $config['thinkingConfig'] = ['thinkingLevel' => $c['raciocinio']];
    }
    return [
        'systemInstruction' => ['parts' => [['text' => promptDoSistema()]]],
        'contents' => $contents,
        'generationConfig' => $config,
    ];
}

/** Registra no log de erros do servidor o que deu errado — nunca o conteúdo da conversa. */
function registrarFalhaDaApi(string $motivo): void
{
    error_log('Assistente virtual: ' . $motivo);
}

/** Pergunta à IA e devolve o texto da resposta. */
function perguntarAoGemini(array $mensagens, array $c): string
{
    if (!function_exists('curl_init')) {
        registrarFalhaDaApi('a extensão cURL do PHP não está ativa na hospedagem.');
        throw new ErroDoAssistente(503, 'indisponivel');
    }

    $url = rtrim($c['servidor'], '/') . '/v1beta/models/' . rawurlencode($c['modelo']) . ':generateContent';
    $corpo = json_encode(pedidoAoGemini($mensagens, $c), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $corpo,
        // A chave vai no cabeçalho, e não no endereço: assim não aparece em logs de acesso.
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $c['chave']],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => min(8, $c['tempo_limite']),
        CURLOPT_TIMEOUT => $c['tempo_limite'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $resposta = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $erroDeRede = curl_errno($curl);
    curl_close($curl);

    if ($resposta === false) {
        registrarFalhaDaApi('sem resposta da API (erro cURL ' . $erroDeRede . ').');
        throw new ErroDoAssistente($erroDeRede === CURLE_OPERATION_TIMEDOUT ? 504 : 502, 'indisponivel');
    }

    $dados = json_decode((string) $resposta, true);
    if ($status !== 200 || !is_array($dados)) {
        $tipo = is_array($dados) ? (string) ($dados['error']['status'] ?? '') : '';
        registrarFalhaDaApi('a API respondeu ' . $status . ($tipo !== '' ? ' (' . $tipo . ')' : '') . '.');
        if ($status === 429) {
            throw new ErroDoAssistente(503, 'ocupado');
        }
        throw new ErroDoAssistente(502, 'indisponivel');
    }

    // Pedido recusado pelos filtros de segurança antes de qualquer resposta.
    if (!empty($dados['promptFeedback']['blockReason'])) {
        throw new ErroDoAssistente(200, 'bloqueio');
    }

    $candidato = $dados['candidates'][0] ?? [];
    $motivo = (string) ($candidato['finishReason'] ?? '');
    $texto = '';
    foreach ((array) ($candidato['content']['parts'] ?? []) as $parte) {
        // Partes de "raciocínio" do modelo não são resposta.
        if (is_array($parte) && empty($parte['thought']) && is_string($parte['text'] ?? null)) {
            $texto .= $parte['text'];
        }
    }
    $texto = trim($texto);

    if (in_array($motivo, ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'], true)) {
        throw new ErroDoAssistente(200, 'bloqueio');
    }
    if ($texto === '') {
        registrarFalhaDaApi('resposta vazia da API (' . ($motivo !== '' ? $motivo : 'sem motivo') . ').');
        throw new ErroDoAssistente(502, 'indisponivel');
    }
    // Resposta comprida demais não cabe de volta no histórico: corta com reticências.
    $maximo = ASSISTENTE_RESPOSTA_MAXIMA - 100;
    if (caracteres($texto) > $maximo && preg_match('/^.{' . $maximo . '}/su', $texto, $m)) {
        $texto = rtrim($m[0]) . '…';
    }
    return $texto;
}
