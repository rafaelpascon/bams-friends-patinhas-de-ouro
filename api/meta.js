const { configuracao, cabecalhos } = require('./_comum');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'metodo_nao_permitido' });
  }

  const cfg = configuracao();
  if (!cfg) return res.status(500).json({ erro: 'configuracao_ausente' });

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const r = await fetch(
      cfg.url + '/rest/v1/meta_arrecadacao?select=arrecadado,meta,atualizado_em&limit=1',
      { headers: cabecalhos(cfg) }
    );
    if (!r.ok) throw new Error('falha_consulta');
    const linhas = await r.json();
    const linha = linhas[0];
    if (!linha) throw new Error('linha_ausente');

    return res.status(200).json({
      arrecadado: Number(linha.arrecadado),
      meta: Number(linha.meta),
      atualizadoEm: linha.atualizado_em,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'erro_interno' });
  }
};
