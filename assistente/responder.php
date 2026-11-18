<?php
/**
 * Endereço que o assistente virtual do site chama (assets/js/assistente.js).
 *
 * Recebe só POST com JSON: {"mensagens": [{"papel": "usuario", "texto": "..."}, ...]}
 * Devolve JSON: {"resposta": "...", "assinatura": "..."} ou {"erro": "...", "codigo": "..."}.
 *
 * Nada da conversa é gravado. Ver assistente/inc/assistente.php.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: same-origin');

/** Responde e encerra. */
function enviar(int $status, array $dados): void
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    require __DIR__ . '/inc/assistente.php';

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        throw new ErroDoAssistente(405, 'pedido');
    }
    if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
        throw new ErroDoAssistente(415, 'pedido');
    }
    conferirOrigem();

    $corpo = (string) file_get_contents('php://input', false, null, 0, ASSISTENTE_PEDIDO_MAXIMO + 1);
    if (strlen($corpo) > ASSISTENTE_PEDIDO_MAXIMO) {
        throw new ErroDoAssistente(413, 'pedido');
    }

    $config = configDoAssistente();
    if (!assistenteConfigurado($config)) {
        error_log('Assistente virtual: falta a chave da API em ' . arquivoDeConfigDoAssistente() . '.');
        throw new ErroDoAssistente(503, 'indisponivel');
    }

    $mensagens = lerConversa($corpo, $config);
    usarCota($config);
    $resposta = perguntarAoGemini($mensagens, $config);

    enviar(200, ['resposta' => $resposta, 'assinatura' => assinarResposta($resposta, $config)]);
} catch (ErroDoAssistente $erro) {
    enviar($erro->status, ['erro' => $erro->getMessage(), 'codigo' => $erro->codigo]);
} catch (Throwable $erro) {
    // Problema do servidor (pasta de dados, arquivo faltando...): vai para o log
    // de erros da hospedagem, sem o conteúdo da conversa.
    error_log('Assistente virtual: ' . $erro->getMessage());
    enviar(500, [
        'erro' => 'O assistente está indisponível no momento. Tente de novo em instantes ' .
            'ou fale com a equipe pela página contato.html.',
        'codigo' => 'indisponivel',
    ]);
}
