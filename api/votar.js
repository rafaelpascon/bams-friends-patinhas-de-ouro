const {
  TOTAL_ETAPAS,
  configuracao,
  cabecalhos,
  ipDe,
  hashIp,
  lerEtapas,
  contarLinhas,
  calcularEstado,
} = require('./_comum');

async function tokenValido(cfg, token, ip) {
  const corpo = new URLSearchParams({ secret: cfg.turnstile, response: token });
  if (ip) corpo.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: corpo,
  });
  const dados = await r.json();
  return dados.success === true;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'metodo_nao_permitido' });
  }

  const cfg = configuracao();
  if (!cfg) return res.status(500).json({ erro: 'configuracao_ausente' });

  const { etapa, ong, token } = req.body || {};
  if (
    !Number.isInteger(etapa) ||
    etapa < 1 ||
    etapa > TOTAL_ETAPAS ||
    typeof ong !== 'string' ||
    typeof token !== 'string' ||
    !token ||
    token.length > 4096
  ) {
    return res.status(400).json({ erro: 'dados_invalidos' });
  }

  const ip = ipDe(req);

  try {
    const estado = calcularEstado(await lerEtapas(cfg), new Date());

    if (estado.fase !== 'aberta' || estado.etapaAtual !== etapa) {
      return res.status(409).json({ erro: 'etapa_fechada' });
    }
    if (!estado.candidatas.includes(ong)) {
      return res.status(422).json({ erro: 'instituicao_inelegivel' });
    }

    if (!(await tokenValido(cfg, token, ip))) {
      return res.status(403).json({ erro: 'captcha_invalido' });
    }

    const ipHash = hashIp(cfg, ip);
    const total = await contarLinhas(
      cfg,
      '/rest/v1/votos?select=id&ip_hash=eq.' + ipHash + '&etapa=eq.' + etapa + '&teste=eq.' + cfg.modoTeste
    );
    if (total >= cfg.maxPorIp) {
      return res.status(429).json({ erro: 'limite_por_conexao' });
    }

    const insercao = await fetch(cfg.url + '/rest/v1/votos', {
      method: 'POST',
      headers: cabecalhos(cfg, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ ong: ong, ip_hash: ipHash, etapa: etapa, teste: cfg.modoTeste }),
    });
    if (!insercao.ok) throw new Error('falha_insercao');

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: 'erro_interno' });
  }
};
