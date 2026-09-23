const crypto = require('crypto');
const { ONGS, configuracao, cabecalhos } = require('./_comum');

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

  const { ong, token } = req.body || {};
  if (typeof ong !== 'string' || !ONGS.includes(ong) || typeof token !== 'string' || !token) {
    return res.status(400).json({ erro: 'dados_invalidos' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  try {
    if (!(await tokenValido(cfg, token, ip))) {
      return res.status(403).json({ erro: 'captcha_invalido' });
    }

    const ipHash = crypto.createHash('sha256').update(cfg.sal + ip).digest('hex');

    const contagem = await fetch(
      cfg.url + '/rest/v1/votos?select=id&ip_hash=eq.' + ipHash,
      { headers: cabecalhos(cfg, { Prefer: 'count=exact', Range: '0-0' }) }
    );
    if (!contagem.ok) throw new Error('falha_contagem');
    const total = parseInt((contagem.headers.get('content-range') || '').split('/')[1] || '0', 10);
    if (total >= cfg.maxPorIp) {
      return res.status(429).json({ erro: 'limite_por_conexao' });
    }

    const insercao = await fetch(cfg.url + '/rest/v1/votos', {
      method: 'POST',
      headers: cabecalhos(cfg, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ ong: ong, ip_hash: ipHash }),
    });
    if (!insercao.ok) throw new Error('falha_insercao');

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: 'erro_interno' });
  }
};
