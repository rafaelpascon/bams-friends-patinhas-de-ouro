(function () {
  const menuBtn = document.getElementById('menu-btn');
  const menuMobile = document.getElementById('menu-mobile');
  const iconAbrir = document.getElementById('icon-abrir');
  const iconFechar = document.getElementById('icon-fechar');

  function fecharMenu() {
    menuMobile.classList.add('hidden');
    iconAbrir.classList.remove('hidden');
    iconFechar.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  menuBtn.addEventListener('click', function () {
    const aberto = !menuMobile.classList.contains('hidden');
    if (aberto) {
      fecharMenu();
    } else {
      menuMobile.classList.remove('hidden');
      iconAbrir.classList.add('hidden');
      iconFechar.classList.remove('hidden');
      menuBtn.setAttribute('aria-expanded', 'true');
    }
  });

  menuMobile.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', fecharMenu);
  });

  const copiarBtn = document.getElementById('copiar-pix');
  const copiarTexto = document.getElementById('copiar-pix-texto');
  const pixKey = document.getElementById('pix-key').textContent.trim();

  function mostrarCopiado() {
    const original = copiarTexto.textContent;
    copiarTexto.textContent = 'Chave copiada!';
    setTimeout(function () {
      copiarTexto.textContent = original;
    }, 2000);
  }

  copiarBtn.addEventListener('click', function () {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pixKey).then(mostrarCopiado, function () {
        copiarFallback(pixKey);
        mostrarCopiado();
      });
    } else {
      copiarFallback(pixKey);
      mostrarCopiado();
    }
  });

  function copiarFallback(texto) {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    document.execCommand('copy');
    document.body.removeChild(campo);
  }
})();
