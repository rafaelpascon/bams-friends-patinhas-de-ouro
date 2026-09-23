(function () {
  const secao = document.getElementById('votacao');
  if (!secao) return;

  const CHAVE = 'bf_voto';
  const cards = Array.from(secao.querySelectorAll('.ong-card'));
  const status = document.getElementById('votacao-status');
  const areaCaptcha = document.getElementById('votacao-captcha');
  const siteKey = secao.dataset.turnstileSitekey;

  let ongPendente = null;
  let widgetId = null;
  let enviando = false;

  function lerVoto() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }

  function gravarVoto(ong) {
    try { localStorage.setItem(CHAVE, ong); } catch (e) {}
  }

  function mensagem(texto) {
    status.textContent = texto;
  }

  function travarBotoes(travar) {
    cards.forEach(function (card) {
      card.querySelector('.btn-votar').disabled = travar;
    });
  }

  function mostrarResultados(dados, escolhida) {
    const total = dados.total || 0;
    cards.forEach(function (card) {
      const id = card.dataset.ong;
      const votos = (dados.votos && dados.votos[id]) || 0;
      const pct = total ? Math.round((votos / total) * 100) : 0;
      card.querySelector('.btn-votar').hidden = true;
      const bloco = card.querySelector('.ong-resultado');
      bloco.hidden = false;
      card.querySelector('.ong-barra-preench').style.width = pct + '%';
      card.querySelector('.ong-resultado-texto').textContent =
        pct + '% · ' + votos + (votos === 1 ? ' voto' : ' votos');
      card.classList.toggle('escolhida', id === escolhida);
    });
  }

  function carregarResultados(escolhida) {
    return fetch('/api/resultados')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (dados) { mostrarResultados(dados, escolhida); })
      .catch(function () {
        cards.forEach(function (card) { card.querySelector('.btn-votar').hidden = true; });
        mensagem('Não deu para carregar o resultado agora. Tente de novo em instantes.');
      });
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

  function enviarVoto(token) {
    if (enviando) return;
    enviando = true;
    mensagem('Registrando seu voto…');
    fetch('/api/votar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ong: ongPendente, token: token })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (corpo) {
          return { ok: r.ok, status: r.status, corpo: corpo };
        });
      })
      .then(function (res) {
        if (res.ok) {
          gravarVoto(ongPendente);
          mensagem('Voto registrado, obrigado por participar!');
          return carregarResultados(ongPendente);
        }
        travarBotoes(false);
        if (res.status === 429) {
          mensagem('Já recebemos o número máximo de votos desta conexão.');
        } else if (res.status === 403) {
          mensagem('Não conseguimos confirmar que você é uma pessoa. Tente de novo.');
        } else {
          mensagem('Não deu para registrar o voto agora. Tente de novo em instantes.');
        }
      })
      .catch(function () {
        travarBotoes(false);
        mensagem('Não deu para registrar o voto agora. Tente de novo em instantes.');
      })
      .then(function () {
        enviando = false;
        if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
      });
  }

  function iniciarVoto(ong) {
    if (lerVoto() || enviando) return;
    ongPendente = ong;
    travarBotoes(true);
    mensagem('Só um instante, estamos confirmando que você é uma pessoa…');

    aguardarTurnstile(25).then(function (ts) {
      if (widgetId === null) {
        widgetId = ts.render(areaCaptcha, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          execution: 'execute',
          callback: enviarVoto,
          'error-callback': function () {
            travarBotoes(false);
            mensagem('Não conseguimos confirmar que você é uma pessoa. Tente de novo.');
          },
          'expired-callback': function () {
            travarBotoes(false);
          }
        });
      }
      ts.execute(widgetId);
    }).catch(function () {
      travarBotoes(false);
      mensagem('Não deu para carregar a verificação. Recarregue a página e tente de novo.');
    });
  }

  cards.forEach(function (card) {
    card.querySelector('.btn-votar').addEventListener('click', function () {
      iniciarVoto(card.dataset.ong);
    });
  });

  const votoAnterior = lerVoto();
  if (votoAnterior) {
    mensagem('Você já votou neste navegador. Obrigado por participar!');
    carregarResultados(votoAnterior);
  }
})();
