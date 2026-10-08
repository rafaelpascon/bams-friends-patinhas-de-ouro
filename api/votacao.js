const { configuracao, lerEtapas, calcularEstado } = require('./_comum');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'metodo_nao_permitido' });
  }

  const cfg = configuracao();
  if (!cfg) return res.status(500).json({ erro: 'configuracao_ausente' });

  try {
    const estado = calcularEstado(await lerEtapas(cfg), new Date());
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    return res.status(200).json({
      etapaAtual: estado.etapaAtual,
      fase: estado.fase,
      inicioEm: estado.inicioEm,
      fimEm: estado.fimEm,
      candidatas: estado.candidatas,
      vencedoras: estado.vencedoras,
      turnstileSiteKey: cfg.siteKey,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'erro_interno' });
  }
};
