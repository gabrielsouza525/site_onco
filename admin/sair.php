<?php
/**
 * Encerra a sessão. Só por POST com o token do formulário: um link para
 * sair.php vindo de outro site não derruba ninguém.
 */

declare(strict_types=1);

require __DIR__ . '/inc/nucleo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ir('index.php');
}
exigirCsrf();
sair();
ir('entrar.php?saiu');
