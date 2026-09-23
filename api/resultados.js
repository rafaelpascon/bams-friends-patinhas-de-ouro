const { ONGS, configuracao, cabecalhos } = require('./_comum');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'metodo_nao_permitido' });
  }

  const cfg = configuracao();
  if (!cfg) return res.status(500).json({ erro: 'configuracao_ausente' });

  try {
    const r = await fetch(cfg.url + '/rest/v1/rpc/contagem_votos', {
      method: 'POST',
      headers: cabecalhos(cfg),
      body: '{}',
    });
    if (!r.ok) throw new Error('falha_rpc');
    const linhas = await r.json();

    const votos = {};
    ONGS.forEach(function (id) { votos[id] = 0; });
    let total = 0;
    linhas.forEach(function (l) {
      if (ONGS.includes(l.ong)) {
        votos[l.ong] = Number(l.total);
        total += Number(l.total);
      }
    });

    return res.status(200).json({ total: total, votos: votos });
  } catch (e) {
    return res.status(500).json({ erro: 'erro_interno' });
  }
};
