/* ==========================================================================
   Painel administrativo — conforto, não função.
   Tudo no painel funciona sem este arquivo; ele só mostra a senha digitada
   e pede confirmação antes de remover um acesso.
   ========================================================================== */
(function () {
  'use strict';

  /* Mostrar / ocultar senha ------------------------------------------------ */
  document.querySelectorAll('[data-revelar]').forEach(function (botao) {
    const campo = document.getElementById(botao.getAttribute('data-revelar'));
    if (!campo) return;
    botao.addEventListener('click', function () {
      const visivel = campo.type === 'text';
      campo.type = visivel ? 'password' : 'text';
      botao.setAttribute('aria-pressed', String(!visivel));
      botao.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
      campo.focus();
    });
  });

  /* Confirmar antes de remover -------------------------------------------- */
  document.querySelectorAll('form[data-confirmar]').forEach(function (form) {
    form.addEventListener('submit', function (evento) {
      if (!window.confirm(form.getAttribute('data-confirmar'))) evento.preventDefault();
    });
  });

  /* Um envio por vez: o botão trava até a página responder, para um clique
     duplo não publicar duas vezes. */
  document.querySelectorAll('.painel form, .auth-card form').forEach(function (form) {
    form.addEventListener('submit', function (evento) {
      if (evento.defaultPrevented) return;
      const botao = form.querySelector('button[type="submit"]');
      if (botao) window.setTimeout(function () { botao.disabled = true; }, 0);
    });
  });
})();
