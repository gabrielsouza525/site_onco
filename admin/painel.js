/* ==========================================================================
   Painel administrativo — conforto, não função.
   Tudo no painel funciona sem este arquivo; ele só mostra a senha digitada
   e pede confirmação antes de remover um acesso.
   ========================================================================== */
(function () {
  'use strict';

  /* Confirmação à vista ---------------------------------------------------
     Depois de salvar, a mensagem aparece dentro do bloco onde a ação foi
     feita, e a página volta com #bloco no endereço para o navegador rolar
     até lá. Por garantia — há navegador que restaura a rolagem antiga depois
     de um envio — a rolagem é refeita daqui, depois do primeiro quadro
     desenhado, quando a restauração já passou. */
  const confirmacao = document.querySelector('.painel-bloco .painel-aviso');
  if (confirmacao) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const mostrar = function () {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          confirmacao.scrollIntoView({ block: 'center' });
        });
      });
    };
    if (document.readyState === 'complete') mostrar();
    else window.addEventListener('load', mostrar);
  }

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

  /* Fotos: prévia e redução antes de enviar --------------------------------
     Foto de celular passa fácil de 5 MB, e hospedagem compartilhada costuma
     recusar envios grandes. Reduzir aqui, no navegador, resolve antes de virar
     erro — e o navegador já desvira a foto que o celular gravou deitada. Sem
     JavaScript a foto sobe como está, e o servidor faz o mesmo trabalho. */
  const LADO_MAXIMO = 2400;
  const AVISO_PREVIA = 'Prévia: a foto ainda não está no site. Clique em “Enviar foto”.';

  document.querySelectorAll('input[type="file"][data-previa]').forEach(function (campo) {
    const previa = document.getElementById(campo.getAttribute('data-previa'));
    const situacao = document.getElementById(campo.id + '-situacao');
    const botao = campo.form ? campo.form.querySelector('button[type="submit"]') : null;
    const fotoAtual = previa ? previa.src : '';
    const dizer = function (texto) { if (situacao) situacao.textContent = texto; };

    campo.addEventListener('change', function () {
      const arquivo = campo.files && campo.files[0];
      if (!arquivo) {
        if (previa) { previa.src = fotoAtual; previa.removeAttribute('data-previa'); }
        dizer('');
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) {
        dizer('Escolha uma foto em JPG, PNG ou WebP.');
        return;
      }

      const endereco = URL.createObjectURL(arquivo);
      if (previa) { previa.src = endereco; previa.setAttribute('data-previa', ''); }
      dizer(AVISO_PREVIA);

      const imagem = new Image();
      imagem.onload = function () {
        const maior = Math.max(imagem.naturalWidth, imagem.naturalHeight);
        const pequena = maior <= LADO_MAXIMO && arquivo.size <= 1.5 * 1024 * 1024;
        if (pequena || !window.DataTransfer || !HTMLCanvasElement.prototype.toBlob) return;

        const escala = Math.min(1, LADO_MAXIMO / maior);
        const tela = document.createElement('canvas');
        tela.width = Math.round(imagem.naturalWidth * escala);
        tela.height = Math.round(imagem.naturalHeight * escala);
        const desenho = tela.getContext('2d');
        desenho.fillStyle = '#fff'; // PNG transparente não vira fundo preto
        desenho.fillRect(0, 0, tela.width, tela.height);
        desenho.drawImage(imagem, 0, 0, tela.width, tela.height);

        if (botao) botao.disabled = true;
        dizer('Preparando a foto para enviar…');
        tela.toBlob(function (blob) {
          if (botao) botao.disabled = false;
          dizer(AVISO_PREVIA);
          if (!blob) return; // fica a foto original; o servidor reduz
          const lista = new DataTransfer();
          const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg';
          lista.items.add(new File([blob], nome, { type: 'image/jpeg' }));
          campo.files = lista.files;
        }, 'image/jpeg', 0.9);
      };
      imagem.src = endereco;
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
