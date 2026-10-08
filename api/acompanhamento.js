const crypto = require('crypto');
const {
  IDS,
  ID_SET,
  TOTAL_ETAPAS,
  instituicoes,
  configuracao,
  cabecalhos,
  ipDe,
  hashIp,
  lerEtapas,
  contarLinhas,
  candidatasDaEtapa,
  calcularEstado,
} = require('./_comum');

const MAX_TENTATIVAS = 5;
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;
const porId = {};
instituicoes.forEach((i) => {
  porId[i.id] = i;
});

function senhaConfere(informada, esperada) {
  const a = crypto.createHash('sha256').update(String(informada)).digest();
  const b = crypto.createHash('sha256').update(String(esperada)).digest();
  return crypto.timingSafeEqual(a, b);
}

function avisosDeConfiguracao(etapas) {
  const avisos = [];
  const vistos = {};
  let anteriorSemResultado = false;
  (etapas || []).forEach((e) => {
    const vencedoras = Array.isArray(e.vencedoras) ? e.vencedoras : [];
    if (vencedoras.length && anteriorSemResultado) {
      avisos.push('A etapa ' + e.numero + ' tem vencedoras, mas uma etapa anterior ainda não tem. As vencedoras da etapa ' + e.numero + ' estão sendo ignoradas.');
    }
    vencedoras.forEach((id) => {
      if (!ID_SET.has(id)) avisos.push('Vencedora da etapa ' + e.numero + ' com id que não existe na lista: ' + id);
      if (vistos[id]) avisos.push('A instituição ' + id + ' aparece como vencedora nas etapas ' + vistos[id] + ' e ' + e.numero + '.');
      vistos[id] = e.numero;
    });
    if (vencedoras.length !== 2) anteriorSemResultado = true;
  });
  return avisos;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'metodo_nao_permitido' });
  }

  const cfg = configuracao();
  if (!cfg || !cfg.senhaAcompanhar) return res.status(500).json({ erro: 'configuracao_ausente' });

  try {
    const ipHash = hashIp(cfg, ipDe(req), 'acompanhar');
    const desde = new Date(Date.now() - JANELA_TENTATIVAS_MS).toISOString();
    const recentes = await contarLinhas(
      cfg,
      '/rest/v1/acompanhar_tentativas?select=id&ip_hash=eq.' + ipHash + '&criado_em=gte.' + encodeURIComponent(desde)
    );
    if (recentes >= MAX_TENTATIVAS) {
      return res.status(429).json({ erro: 'muitas_tentativas' });
    }

    const informada = req.headers['x-acompanhar-senha'];
    if (typeof informada !== 'string' || !informada || !senhaConfere(informada, cfg.senhaAcompanhar)) {
      await fetch(cfg.url + '/rest/v1/acompanhar_tentativas', {
        method: 'POST',
        headers: cabecalhos(cfg, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ ip_hash: ipHash }),
      });
      return res.status(401).json({ erro: 'nao_autorizado' });
    }

    const etapas = await lerEtapas(cfg);
    const agora = new Date();
    const estado = calcularEstado(etapas, agora);
    const etapa = estado.etapaAtual || TOTAL_ETAPAS;
    const elegiveis = estado.etapaAtual
      ? estado.candidatas
      : candidatasDaEtapa(etapa, estado.publicadas);

    const rpc = await fetch(cfg.url + '/rest/v1/rpc/contagem_votos_etapa', {
      method: 'POST',
      headers: cabecalhos(cfg),
      body: JSON.stringify({ p_etapa: etapa, p_teste: cfg.modoTeste }),
    });
    if (!rpc.ok) throw new Error('falha_rpc');
    const linhas = await rpc.json();

    const contagem = {};
    let foraDaLista = 0;
    linhas.forEach((l) => {
      if (elegiveis.includes(l.ong)) contagem[l.ong] = Number(l.total);
      else foraDaLista += Number(l.total);
    });

    const totalVotos = elegiveis.reduce((soma, id) => soma + (contagem[id] || 0), 0);
    const ranking = elegiveis
      .map((id) => ({
        id: id,
        numero: porId[id].numero,
        nome: porId[id].nome,
        uf: porId[id].uf,
        votos: contagem[id] || 0,
      }))
      .sort((a, b) => b.votos - a.votos || a.numero - b.numero)
      .map((item, indice) => ({
        posicao: indice + 1,
        id: item.id,
        nome: item.nome,
        uf: item.uf,
        votos: item.votos,
        percentual: totalVotos ? Math.round((item.votos / totalVotos) * 1000) / 10 : 0,
        destaque: indice < 2 && totalVotos > 0,
      }));

    let empate = { ativo: false, votos: 0, instituicoes: [] };
    if (ranking.length >= 3 && ranking[1].votos > 0 && ranking[1].votos === ranking[2].votos) {
      const empatadas = ranking.filter((r) => r.votos === ranking[1].votos);
      empate = {
        ativo: true,
        votos: ranking[1].votos,
        instituicoes: empatadas.map((r) => ({ id: r.id, nome: r.nome })),
      };
    }

    const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000).toISOString();
    const votosUltimaHora = await contarLinhas(
      cfg,
      '/rest/v1/votos?select=id&etapa=eq.' + etapa + '&teste=eq.' + cfg.modoTeste + '&criado_em=gte.' + encodeURIComponent(umaHoraAtras)
    );

    const alertas = avisosDeConfiguracao(etapas);
    if (foraDaLista > 0) {
      alertas.push(foraDaLista + ' voto(s) desta etapa estão em instituições que não são elegíveis nela.');
    }

    const atual = estado.porNumero[etapa] || {};
    return res.status(200).json({
      etapa: etapa,
      etapaAtual: estado.etapaAtual,
      fase: estado.fase,
      inicioEm: atual.inicio_em || null,
      fimEm: atual.fim_em || null,
      totalVotos: totalVotos,
      votosUltimaHora: votosUltimaHora,
      ranking: ranking,
      empate: empate,
      alertas: alertas,
      modoTeste: cfg.modoTeste,
      atualizadoEm: agora.toISOString(),
      totalInstituicoes: IDS.length,
    });
  } catch (e) {
    return res.status(500).json({ erro: 'erro_interno' });
  }
};
