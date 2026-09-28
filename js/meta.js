(function () {
  const bloco = document.getElementById('bloco-meta');
  if (!bloco) return;

  const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function formatarAtualizacao(iso) {
    const data = new Date(iso);
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(data);
    const mapa = {};
    partes.forEach(function (p) { mapa[p.type] = p.value; });
    return mapa.day + '/' + mapa.month + ', às ' + mapa.hour + 'h' + mapa.minute;
  }

  function renderEmProgresso(arrecadado, meta, atualizadoEm) {
    const falta = Math.max(0, meta - arrecadado);
    const percentual = meta > 0 ? Math.min(100, Math.round((arrecadado / meta) * 100)) : 0;

    bloco.className = 'meta-card';
    bloco.innerHTML = '';

    bloco.appendChild(criarElemento('p', 'meta-titulo', 'Acompanhe nossa meta'));

    const linhas = criarElemento('div', 'meta-linhas');
    const colArrecadado = criarElemento('div');
    colArrecadado.appendChild(criarElemento('p', 'meta-valor-rotulo', 'Arrecadado'));
    colArrecadado.appendChild(criarElemento('p', 'meta-valor', formatadorBRL.format(arrecadado)));
    const colMeta = criarElemento('div');
    colMeta.appendChild(criarElemento('p', 'meta-valor-rotulo', 'Meta'));
    colMeta.appendChild(criarElemento('p', 'meta-valor', formatadorBRL.format(meta)));
    linhas.appendChild(colArrecadado);
    linhas.appendChild(colMeta);
    bloco.appendChild(linhas);

    const barraFora = criarElemento('div', 'meta-barra');
    barraFora.setAttribute('role', 'progressbar');
    barraFora.setAttribute('aria-valuenow', String(percentual));
    barraFora.setAttribute('aria-valuemin', '0');
    barraFora.setAttribute('aria-valuemax', '100');
    barraFora.setAttribute('aria-label', 'Progresso da meta de arrecadação');
    const barraDentro = criarElemento('div', 'meta-barra-preench');
    barraDentro.style.width = percentual + '%';
    barraFora.appendChild(barraDentro);
    bloco.appendChild(barraFora);

    bloco.appendChild(criarElemento('p', 'meta-falta', 'Falta ' + formatadorBRL.format(falta)));
    bloco.appendChild(criarElemento('p', 'meta-atualizado', 'Última atualização: ' + formatarAtualizacao(atualizadoEm)));
  }

  function renderMetaAtingida(arrecadado, atualizadoEm) {
    bloco.className = 'meta-card';
    bloco.innerHTML = '';

    bloco.appendChild(criarElemento('p', 'meta-atingida-titulo', 'Meta inicial atingida!'));
    bloco.appendChild(criarElemento(
      'p', 'meta-atingida-texto',
      'Os R$ 15.000,00 da primeira etapa foram arrecadados, garantindo o apoio previsto para as 10 iniciativas selecionadas.'
    ));
    bloco.appendChild(criarElemento('p', 'meta-atingida-texto', 'Mas o Bam’s Friends continua.'));
    bloco.appendChild(criarElemento(
      'p', 'meta-atingida-texto',
      'As novas doações poderão ampliar o impacto do projeto e contribuir com novas ações em apoio à causa animal.'
    ));

    bloco.appendChild(criarElemento('p', 'meta-valor', 'Total arrecadado: ' + formatadorBRL.format(arrecadado)));
    bloco.appendChild(criarElemento('p', 'meta-atualizado', 'Última atualização: ' + formatarAtualizacao(atualizadoEm)));

    const linkPix = criarElemento('a', 'meta-pix-link', 'Contribuir pelo PIX');
    linkPix.href = '#como-apoiar';
    bloco.appendChild(linkPix);
  }

  function renderErro() {
    bloco.className = 'meta-card';
    bloco.innerHTML = '';
    bloco.appendChild(criarElemento('p', 'meta-titulo', 'Acompanhe nossa meta'));
    bloco.appendChild(criarElemento('p', 'meta-atualizado', 'Valor em atualização. Tente recarregar a página em instantes.'));
  }

  function criarElemento(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  fetch('/api/meta')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (dados) {
      if (dados.arrecadado >= dados.meta) {
        renderMetaAtingida(dados.arrecadado, dados.atualizadoEm);
      } else {
        renderEmProgresso(dados.arrecadado, dados.meta, dados.atualizadoEm);
      }
    })
    .catch(renderErro);
})();
