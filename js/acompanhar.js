(function () {
  const CHAVE = 'bf_acompanhar_senha';
  const ATUALIZACAO_MS = 60000;
  const FASES = {
    aguardando_inicio: 'Aguardando início',
    aberta: 'Votação aberta',
    encerrada_aguardando_resultado: 'Encerrada, aguardando resultado',
    resultado_publicado: 'Resultado publicado, próxima etapa ainda não abriu',
    votacao_encerrada: 'Votação encerrada',
  };
  const $ = function (id) {
    return document.getElementById(id);
  };

  let ultimo = null;
  let carregando = false;
  let ultimaBusca = 0;

  function lerSenha() {
    try {
      return sessionStorage.getItem(CHAVE);
    } catch (e) {
      return null;
    }
  }

  function gravarSenha(senha) {
    try {
      sessionStorage.setItem(CHAVE, senha);
    } catch (e) {}
  }

  function limparSenha() {
    try {
      sessionStorage.removeItem(CHAVE);
    } catch (e) {}
  }

  function criar(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  function dataHora(iso) {
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
  }

  function horaCompleta(iso) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  }

  function numero(n) {
    return Number(n).toLocaleString('pt-BR');
  }

  function percentual(p) {
    return Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  function mostrarAcesso(erro) {
    $('painel').hidden = true;
    $('acesso').hidden = false;
    $('acesso-erro').textContent = erro || '';
  }

  function mostrarPainel() {
    $('acesso').hidden = true;
    $('painel').hidden = false;
  }

  function render(d) {
    ultimo = d;
    mostrarPainel();

    $('aviso-teste').hidden = !d.modoTeste;
    $('ac-etapa').textContent = d.etapaAtual ? 'Etapa ' + d.etapa + ' de 3' : 'Etapa 3 de 3 (votação encerrada)';

    let fase = FASES[d.fase] || d.fase;
    if (d.fase === 'aberta' && d.fimEm) fase += ' até ' + dataHora(d.fimEm);
    else if ((d.fase === 'aguardando_inicio' || d.fase === 'resultado_publicado') && d.inicioEm) fase += ' · abre em ' + dataHora(d.inicioEm);
    else if (d.fase === 'encerrada_aguardando_resultado' && d.fimEm) fase += ' · encerrou em ' + dataHora(d.fimEm);
    $('ac-fase').textContent = fase;

    $('ac-atualizado').textContent =
      'Atualiza sozinho a cada 60 segundos. Última atualização: ' + horaCompleta(d.atualizadoEm);
    $('ac-total').textContent = numero(d.totalVotos);
    $('ac-hora').textContent = numero(d.votosUltimaHora);

    const alertas = $('ac-alertas');
    alertas.innerHTML = '';
    (d.alertas || []).forEach(function (texto) {
      alertas.appendChild(criar('div', 'ac-alerta ac-alerta-config', texto));
    });

    const empate = $('ac-empate');
    if (d.empate && d.empate.ativo) {
      empate.hidden = false;
      empate.innerHTML = '';
      empate.appendChild(
        criar(
          'p',
          'ac-empate-titulo',
          'Empate pela 2ª posição: ' + d.empate.instituicoes.length + ' instituições com ' + numero(d.empate.votos) + ' votos.'
        )
      );
      const lista = criar('ul', 'ac-empate-lista');
      d.empate.instituicoes.forEach(function (i) {
        lista.appendChild(criar('li', null, i.nome));
      });
      empate.appendChild(lista);
      empate.appendChild(criar('p', null, 'A organizadora decide o desempate.'));
    } else {
      empate.hidden = true;
    }

    $('ac-vazio').hidden = d.totalVotos > 0;
    const ranking = $('ac-ranking');
    ranking.innerHTML = '';
    const maior = d.ranking.length ? d.ranking[0].votos : 0;
    d.ranking.forEach(function (r) {
      const li = criar('li', 'ac-item' + (r.destaque ? ' ac-item-destaque' : ''));
      li.appendChild(criar('span', 'ac-pos', String(r.posicao)));
      const nome = criar('span', 'ac-nome');
      nome.appendChild(document.createTextNode(r.nome));
      nome.appendChild(criar('span', 'ac-uf', r.uf || 'Local não informado'));
      li.appendChild(nome);
      const valores = criar('span', 'ac-valores');
      valores.appendChild(criar('strong', null, numero(r.votos)));
      valores.appendChild(document.createTextNode(' · ' + percentual(r.percentual)));
      li.appendChild(valores);
      const barra = criar('span', 'ac-barra');
      const preench = criar('span', 'ac-barra-preench');
      preench.style.width = (maior ? Math.round((r.votos / maior) * 100) : 0) + '%';
      barra.appendChild(preench);
      li.appendChild(barra);
      ranking.appendChild(li);
    });
  }

  function buscar() {
    const senha = lerSenha();
    if (!senha || carregando) return Promise.resolve();
    carregando = true;
    ultimaBusca = Date.now();
    return fetch('/api/acompanhamento', { headers: { 'X-Acompanhar-Senha': senha }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) {
          limparSenha();
          mostrarAcesso('Senha incorreta.');
          return null;
        }
        if (r.status === 429) {
          limparSenha();
          mostrarAcesso('Muitas tentativas. Tente de novo em alguns minutos.');
          return null;
        }
        if (!r.ok) throw new Error('falha');
        return r.json();
      })
      .then(function (dados) {
        if (dados) render(dados);
      })
      .catch(function () {
        if (!ultimo) mostrarAcesso('Não deu para carregar agora. Tente de novo em instantes.');
        else $('ac-atualizado').textContent = 'Não deu para atualizar agora. Tentando de novo em instantes.';
      })
      .then(function () {
        carregando = false;
      });
  }

  function campoCsv(valor) {
    return '"' + String(valor).replace(/"/g, '""') + '"';
  }

  function baixarCsv() {
    if (!ultimo) return;
    const linhas = [['Posição', 'Instituição', 'UF', 'Votos', 'Percentual']];
    ultimo.ranking.forEach(function (r) {
      linhas.push([
        r.posicao,
        r.nome,
        r.uf || 'Local não informado',
        r.votos,
        Number(r.percentual).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ]);
    });
    const texto = '﻿' + linhas.map(function (l) { return l.map(campoCsv).join(';'); }).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ranking-etapa-' + ultimo.etapa + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  $('form-acesso').addEventListener('submit', function (evento) {
    evento.preventDefault();
    const senha = $('senha').value;
    if (!senha) {
      $('acesso-erro').textContent = 'Digite a senha.';
      return;
    }
    $('acesso-erro').textContent = '';
    gravarSenha(senha);
    $('senha').value = '';
    buscar();
  });
  $('atualizar').addEventListener('click', buscar);
  $('sair').addEventListener('click', function () {
    limparSenha();
    ultimo = null;
    mostrarAcesso('');
  });
  $('baixar-csv').addEventListener('click', baixarCsv);

  setInterval(function () {
    if (!document.hidden && lerSenha() && ultimo) buscar();
  }, ATUALIZACAO_MS);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && lerSenha() && ultimo && Date.now() - ultimaBusca > 30000) buscar();
  });

  if (lerSenha()) buscar();
})();
