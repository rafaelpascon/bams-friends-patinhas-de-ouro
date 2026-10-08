(function () {
  const BF = (window.BF = window.BF || {});
  let instituicoes;
  let estadoInicial;
  let protetores;

  BF.carregarInstituicoes = function () {
    if (!instituicoes) {
      instituicoes = fetch('data/instituicoes.json').then(function (r) {
        if (!r.ok) throw new Error('instituicoes');
        return r.json();
      });
    }
    return instituicoes;
  };

  BF.carregarProtetores = function () {
    if (!protetores) {
      protetores = fetch('data/iniciativas.json')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .catch(function () {
          return [];
        });
    }
    return protetores;
  };

  BF.carregarEstado = function () {
    return fetch('/api/votacao', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('votacao');
      return r.json();
    });
  };

  BF.obterEstadoInicial = function () {
    if (!estadoInicial) estadoInicial = BF.carregarEstado();
    return estadoInicial;
  };

  BF.formatarDataHora = function (iso) {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(iso));
    const m = {};
    partes.forEach(function (p) {
      m[p.type] = p.value;
    });
    return m.day + '/' + m.month + ', às ' + m.hour + 'h' + m.minute;
  };

  BF.semAcento = function (texto) {
    return String(texto)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  };

  BF.linkInstagram = function (handle) {
    return 'https://instagram.com/' + String(handle).replace(/^@/, '');
  };
})();
