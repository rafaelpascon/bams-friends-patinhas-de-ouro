(function () {
  const secao = document.getElementById('votacao');
  if (!secao) return;

  const POR_PAGINA = 12;
  const ATUALIZACAO_MS = 60000;
  const $ = function (id) {
    return document.getElementById(id);
  };
  const el = {
    etapa: $('votacao-etapa'),
    prazo: $('votacao-prazo'),
    aviso: $('votacao-aviso'),
    controles: $('votacao-controles'),
    busca: $('votacao-busca'),
    uf: $('votacao-uf'),
    contador: $('votacao-contador'),
    lista: $('votacao-lista'),
    mais: $('votacao-mais'),
    captcha: $('votacao-captcha'),
    status: $('votacao-status'),
    contempladas: $('contempladas'),
  };

  let porId = {};
  let estado = null;
  let visiveis = POR_PAGINA;
  let filtroTexto = '';
  let filtroUf = '';
  let widgetId = null;
  let enviando = false;
  let assinatura = '';
  let cardEmConfirmacao = null;
  let ongPendente = null;
  let etapaPendente = null;

  function lerVoto(etapa) {
    try {
      return localStorage.getItem('bf_voto_etapa_' + etapa);
    } catch (e) {
      return null;
    }
  }

  function gravarVoto(etapa, id) {
    try {
      localStorage.setItem('bf_voto_etapa_' + etapa, id);
    } catch (e) {}
  }

  function mensagem(texto) {
    el.status.textContent = texto;
  }

  function criar(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  function nomesDe(ids) {
    return (ids || []).map(function (id) {
      return porId[id] ? porId[id].nome : id;
    });
  }

  function juntar(nomes) {
    return nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes.join('');
  }

  function modoBotao() {
    if (estado.fase !== 'aberta') return 'bloqueado';
    return lerVoto(estado.etapaAtual) ? 'votou' : 'ativo';
  }

  function listaVisivel() {
    return estado.fase !== 'encerrada_aguardando_resultado' && estado.fase !== 'votacao_encerrada';
  }

  function renderCabecalho() {
    const e = estado.etapaAtual;
    let titulo = '';
    let prazo = '';
    let aviso = '';
    const abre = estado.inicioEm ? 'Abre em ' + BF.formatarDataHora(estado.inicioEm) : 'As datas serão divulgadas em breve.';

    if (estado.fase === 'aguardando_inicio') {
      titulo = 'Etapa ' + e + ' de 3';
      prazo = abre;
      aviso = 'A votação ainda não começou.';
    } else if (estado.fase === 'aberta') {
      titulo = 'Etapa ' + e + ' de 3';
      prazo = estado.fimEm ? 'Aberta até ' + BF.formatarDataHora(estado.fimEm) : 'Votação aberta';
    } else if (estado.fase === 'encerrada_aguardando_resultado') {
      titulo = 'Etapa ' + e + ' de 3';
      prazo = 'Votação encerrada.';
      aviso = 'O resultado será divulgado em breve.';
    } else if (estado.fase === 'resultado_publicado') {
      titulo = 'Etapa ' + e + ' de 3';
      prazo = abre;
      aviso = 'Resultado da etapa ' + (e - 1) + ': ' + juntar(nomesDe(estado.vencedoras[e - 1])) + '.';
    } else {
      titulo = 'Votação encerrada';
      aviso = 'A votação terminou. Obrigado a todas as pessoas que participaram!';
    }

    el.etapa.textContent = titulo;
    el.prazo.textContent = prazo;
    el.aviso.textContent = aviso;
  }

  function cartaoContemplada(inst) {
    const card = criar('div', 'contemplada-card');
    if (!inst) {
      card.classList.add('contemplada-vazia');
      card.appendChild(criar('span', null, 'Em breve'));
      return card;
    }
    if (inst.foto) {
      const img = criar('img', 'contemplada-logo');
      img.src = inst.foto;
      img.alt = inst.nome;
      img.loading = 'lazy';
      card.appendChild(img);
    }
    const texto = criar('div', 'contemplada-texto');
    texto.appendChild(criar('p', 'contemplada-nome', inst.nome));
    const link = criar('a', 'contemplada-insta', inst.instagram);
    link.href = BF.linkInstagram(inst.instagram);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    texto.appendChild(link);
    card.appendChild(texto);
    return card;
  }

  function renderContempladas() {
    el.contempladas.innerHTML = '';
    [1, 2, 3].forEach(function (n) {
      const coluna = criar('div', 'contempladas-coluna');
      coluna.appendChild(criar('h4', 'contempladas-titulo', 'Etapa ' + n));
      const ids = (estado.vencedoras && estado.vencedoras[n]) || [];
      for (let i = 0; i < 2; i++) coluna.appendChild(cartaoContemplada(porId[ids[i]]));
      el.contempladas.appendChild(coluna);
    });
  }

  function preencherAcao(card, inst) {
    const acao = card.querySelector('.ong-acao');
    acao.innerHTML = '';
    const modo = modoBotao();
    if (modo === 'votou') {
      if (lerVoto(estado.etapaAtual) === inst.id) acao.appendChild(criar('p', 'ong-seu-voto', 'Seu voto'));
      return;
    }
    const botao = criar('button', 'btn-votar', modo === 'ativo' ? 'Votar nesta instituição' : 'Votação ainda não aberta');
    botao.type = 'button';
    if (modo === 'bloqueado') botao.disabled = true;
    else botao.addEventListener('click', function () { mostrarConfirmacao(card, inst); });
    acao.appendChild(botao);
  }

  function cancelarConfirmacao() {
    if (!cardEmConfirmacao) return;
    const card = cardEmConfirmacao;
    cardEmConfirmacao = null;
    preencherAcao(card, porId[card.dataset.ong]);
  }

  function mostrarConfirmacao(card, inst) {
    if (enviando) return;
    cancelarConfirmacao();
    const acao = card.querySelector('.ong-acao');
    acao.innerHTML = '';
    acao.appendChild(criar('p', 'ong-confirma-texto', 'Confirmar voto em ' + inst.nome + '?'));
    const linha = criar('div', 'ong-confirma-botoes');
    const confirmar = criar('button', 'btn-votar', 'Confirmar voto');
    confirmar.type = 'button';
    confirmar.addEventListener('click', function () { iniciarVoto(inst.id); });
    const cancelar = criar('button', 'btn-secundario', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', cancelarConfirmacao);
    linha.appendChild(confirmar);
    linha.appendChild(cancelar);
    acao.appendChild(linha);
    cardEmConfirmacao = card;
    confirmar.focus();
  }

  function criarCard(inst) {
    const card = criar('article', 'ong-card');
    card.dataset.ong = inst.id;
    if (lerVoto(estado.etapaAtual) === inst.id && estado.fase === 'aberta') card.classList.add('escolhida');

    const topo = criar('div', 'ong-card-topo');
    if (inst.foto) {
      const img = criar('img', 'ong-logo');
      img.src = inst.foto;
      img.alt = inst.nome;
      img.width = 88;
      img.height = 88;
      img.loading = 'lazy';
      topo.appendChild(img);
    } else {
      const vazio = criar('div', 'ong-logo ong-logo-vazio');
      vazio.appendChild(criar('span', null, 'Sem foto'));
      topo.appendChild(vazio);
    }
    const identidade = criar('div', 'ong-identidade');
    identidade.appendChild(criar('h3', 'ong-nome', inst.nome));
    identidade.appendChild(criar('p', 'ong-local', inst.uf ? inst.localizacao : 'Local não informado'));
    const link = criar('a', 'ong-insta', inst.instagram);
    link.href = BF.linkInstagram(inst.instagram);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    identidade.appendChild(link);
    topo.appendChild(identidade);
    card.appendChild(topo);

    const corpo = criar('div', 'ong-card-corpo');
    corpo.appendChild(criar('p', 'ong-rotulo', 'Quem recebe'));
    corpo.appendChild(criar('p', 'ong-texto ong-clamp', inst.animais_sob_cuidados + ' · ' + inst.especies));
    corpo.appendChild(criar('p', 'ong-rotulo', 'Uso do valor'));
    corpo.appendChild(criar('p', 'ong-texto ong-clamp', inst.destinacao_recurso));

    const extra = criar('div', 'ong-extra');
    [
      ['Sobre', inst.sobre],
      ['Uso do apoio', inst.uso_do_apoio],
      ['Prestação de contas', inst.prestacao_de_contas],
    ].forEach(function (par) {
      extra.appendChild(criar('p', 'ong-rotulo', par[0]));
      extra.appendChild(criar('p', 'ong-texto', par[1]));
    });
    corpo.appendChild(extra);

    const lerMais = criar('button', 'ong-ler-mais', 'Ler mais');
    lerMais.type = 'button';
    lerMais.setAttribute('aria-expanded', 'false');
    lerMais.addEventListener('click', function () {
      const aberto = card.classList.toggle('expandido');
      lerMais.setAttribute('aria-expanded', String(aberto));
      lerMais.textContent = aberto ? 'Ler menos' : 'Ler mais';
    });
    corpo.appendChild(lerMais);

    corpo.appendChild(criar('div', 'ong-acao'));
    card.appendChild(corpo);
    preencherAcao(card, inst);
    return card;
  }

  function listaFiltrada() {
    const texto = BF.semAcento(filtroTexto.trim());
    return estado.candidatas
      .map(function (id) { return porId[id]; })
      .filter(Boolean)
      .filter(function (inst) {
        if (filtroUf === '__nd') {
          if (inst.uf) return false;
        } else if (filtroUf && inst.uf !== filtroUf) {
          return false;
        }
        return !texto || BF.semAcento(inst.nome).indexOf(texto) !== -1;
      });
  }

  function atualizarRodape(total) {
    el.contador.textContent =
      total === 0 ? 'Nenhuma instituição encontrada.' : total === 1 ? '1 instituição' : total + ' instituições';
    const restante = total - el.lista.children.length;
    el.mais.hidden = restante <= 0;
    el.mais.textContent = 'Carregar mais (' + restante + ')';
  }

  function renderLista() {
    cardEmConfirmacao = null;
    el.lista.innerHTML = '';
    const itens = listaFiltrada();
    itens.slice(0, visiveis).forEach(function (inst) { el.lista.appendChild(criarCard(inst)); });
    atualizarRodape(itens.length);
  }

  function carregarMais() {
    visiveis += POR_PAGINA;
    const itens = listaFiltrada();
    itens.slice(el.lista.children.length, visiveis).forEach(function (inst) { el.lista.appendChild(criarCard(inst)); });
    atualizarRodape(itens.length);
  }

  function montarFiltroUf() {
    const ufs = {};
    let semUf = false;
    estado.candidatas.forEach(function (id) {
      const inst = porId[id];
      if (!inst) return;
      if (inst.uf) ufs[inst.uf] = true;
      else semUf = true;
    });
    el.uf.innerHTML = '';
    const opcoes = [['', 'Todos os estados']];
    Object.keys(ufs).sort().forEach(function (uf) { opcoes.push([uf, uf]); });
    if (semUf) opcoes.push(['__nd', 'Local não informado']);
    opcoes.forEach(function (par) {
      const op = criar('option', null, par[1]);
      op.value = par[0];
      el.uf.appendChild(op);
    });
    if (!opcoes.some(function (par) { return par[0] === filtroUf; })) filtroUf = '';
    el.uf.value = filtroUf;
  }

  function aplicarEstado(novo) {
    const nova = JSON.stringify([novo.etapaAtual, novo.fase, novo.candidatas]);
    const mudou = nova !== assinatura;
    assinatura = nova;
    estado = novo;

    renderCabecalho();
    renderContempladas();

    const mostrar = listaVisivel();
    el.controles.hidden = !mostrar;
    el.contador.hidden = !mostrar;
    el.lista.hidden = !mostrar;
    if (!mostrar) el.mais.hidden = true;

    if (mudou) {
      visiveis = POR_PAGINA;
      if (mostrar) {
        montarFiltroUf();
        renderLista();
      } else {
        el.lista.innerHTML = '';
      }
    }

    if (estado.fase === 'aberta' && lerVoto(estado.etapaAtual)) {
      mensagem('Você já votou nesta etapa. Obrigado por participar!');
    } else if (!enviando) {
      mensagem('');
    }
  }

  function atualizarEstado() {
    return BF.carregarEstado().then(aplicarEstado).catch(function () {});
  }

  function aguardarTurnstile(tentativas) {
    return new Promise(function (resolve, reject) {
      (function checar(n) {
        if (window.turnstile) return resolve(window.turnstile);
        if (n <= 0) return reject();
        setTimeout(function () { checar(n - 1); }, 200);
      })(tentativas);
    });
  }

  function travarBotoes(travar) {
    el.lista.querySelectorAll('button.btn-votar, button.btn-secundario').forEach(function (b) {
      b.disabled = travar;
    });
  }

  function liberarVoto() {
    enviando = false;
    travarBotoes(false);
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
  }

  function enviarVoto(token) {
    mensagem('Registrando seu voto…');
    fetch('/api/votar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: etapaPendente, ong: ongPendente, token: token }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (corpo) {
          return { ok: r.ok, status: r.status, corpo: corpo };
        });
      })
      .then(function (res) {
        if (res.ok) {
          gravarVoto(etapaPendente, ongPendente);
          enviando = false;
          if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
          renderLista();
          mensagem('Voto registrado, obrigado por participar!');
          return;
        }
        if (res.status === 409) {
          mensagem('Esta etapa não está aberta para votos agora.');
          atualizarEstado();
        } else if (res.status === 422) {
          mensagem('Essa instituição não está disponível nesta etapa.');
          atualizarEstado();
        } else if (res.status === 429) {
          mensagem('Já recebemos o número máximo de votos desta conexão nesta etapa.');
        } else if (res.status === 403) {
          mensagem('Não conseguimos confirmar que você é uma pessoa. Tente de novo.');
        } else {
          mensagem('Não deu para registrar o voto agora. Tente de novo em instantes.');
        }
        liberarVoto();
        cancelarConfirmacao();
      })
      .catch(function () {
        mensagem('Não deu para registrar o voto agora. Tente de novo em instantes.');
        liberarVoto();
        cancelarConfirmacao();
      });
  }

  function iniciarVoto(id) {
    if (enviando || estado.fase !== 'aberta' || lerVoto(estado.etapaAtual)) return;
    enviando = true;
    ongPendente = id;
    etapaPendente = estado.etapaAtual;
    travarBotoes(true);
    mensagem('Só um instante, estamos confirmando que você é uma pessoa…');

    aguardarTurnstile(25)
      .then(function (ts) {
        if (widgetId === null) {
          widgetId = ts.render(el.captcha, {
            sitekey: estado.turnstileSiteKey,
            appearance: 'interaction-only',
            execution: 'execute',
            callback: enviarVoto,
            'error-callback': function () {
              mensagem('Não conseguimos confirmar que você é uma pessoa. Tente de novo.');
              liberarVoto();
              cancelarConfirmacao();
            },
            'expired-callback': function () {
              if (enviando) {
                liberarVoto();
                cancelarConfirmacao();
              }
            },
          });
        }
        ts.execute(widgetId);
      })
      .catch(function () {
        mensagem('Não deu para carregar a verificação. Recarregue a página e tente de novo.');
        liberarVoto();
        cancelarConfirmacao();
      });
  }

  el.busca.addEventListener('input', function () {
    filtroTexto = el.busca.value;
    visiveis = POR_PAGINA;
    renderLista();
  });
  el.uf.addEventListener('change', function () {
    filtroUf = el.uf.value;
    visiveis = POR_PAGINA;
    renderLista();
  });
  el.mais.addEventListener('click', carregarMais);

  Promise.all([BF.carregarInstituicoes(), BF.obterEstadoInicial()])
    .then(function (res) {
      res[0].forEach(function (inst) {
        porId[inst.id] = inst;
      });
      aplicarEstado(res[1]);
      setInterval(function () {
        if (!document.hidden && !enviando) atualizarEstado();
      }, ATUALIZACAO_MS);
    })
    .catch(function () {
      el.etapa.textContent = '';
      mensagem('Não deu para carregar a votação agora. Recarregue a página em instantes.');
    });
})();
