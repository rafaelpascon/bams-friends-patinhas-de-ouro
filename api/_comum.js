const crypto = require('crypto');
const instituicoes = require('../data/instituicoes.json');

const IDS = instituicoes.map((i) => i.id);
const ID_SET = new Set(IDS);
const SITEKEY_PADRAO = '0x4AAAAAAFE7UwQi3a2032JY';
const TOTAL_ETAPAS = 3;

function configuracao() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY, VOTE_SALT } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TURNSTILE_SECRET_KEY || !VOTE_SALT) return null;
  return {
    url: SUPABASE_URL.replace(/\/$/, ''),
    chave: SUPABASE_SERVICE_ROLE_KEY,
    turnstile: TURNSTILE_SECRET_KEY,
    sal: VOTE_SALT,
    maxPorIp: parseInt(process.env.MAX_VOTES_PER_IP || '3', 10) || 3,
    siteKey: process.env.TURNSTILE_SITE_KEY || SITEKEY_PADRAO,
    modoTeste: process.env.VOTE_TEST_MODE === '1',
    senhaAcompanhar: process.env.ACOMPANHAR_SENHA || '',
  };
}

function cabecalhos(cfg, extra) {
  return Object.assign(
    { apikey: cfg.chave, Authorization: 'Bearer ' + cfg.chave, 'Content-Type': 'application/json' },
    extra || {}
  );
}

function ipDe(req) {
  return String((req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0]
    .trim();
}

function hashIp(cfg, ip, espaco) {
  return crypto
    .createHash('sha256')
    .update(cfg.sal + (espaco ? ':' + espaco + ':' : '') + ip)
    .digest('hex');
}

async function lerEtapas(cfg) {
  const r = await fetch(cfg.url + '/rest/v1/etapas?select=numero,inicio_em,fim_em,vencedoras&order=numero.asc', {
    headers: cabecalhos(cfg),
  });
  if (!r.ok) throw new Error('falha_etapas');
  return r.json();
}

async function contarLinhas(cfg, caminho) {
  const r = await fetch(cfg.url + caminho, { headers: cabecalhos(cfg, { Prefer: 'count=exact', Range: '0-0' }) });
  if (!r.ok) throw new Error('falha_contagem');
  return parseInt((r.headers.get('content-range') || '').split('/')[1] || '0', 10);
}

function dataValida(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

function candidatasDaEtapa(numero, vencedorasPorEtapa) {
  const excluidas = new Set();
  for (let n = 1; n < numero; n++) (vencedorasPorEtapa[n] || []).forEach((id) => excluidas.add(id));
  return IDS.filter((id) => !excluidas.has(id));
}

function calcularEstado(etapas, agora) {
  const porNumero = {};
  (etapas || []).forEach((e) => {
    porNumero[e.numero] = e;
  });

  const publicadas = {};
  for (let n = 1; n <= TOTAL_ETAPAS; n++) {
    const e = porNumero[n];
    if (e && Array.isArray(e.vencedoras) && e.vencedoras.length === 2) publicadas[n] = e.vencedoras;
  }

  let etapaAtual = null;
  for (let n = 1; n <= TOTAL_ETAPAS; n++) {
    if (!publicadas[n]) {
      etapaAtual = n;
      break;
    }
  }

  const vencedoras = {};
  for (let n = 1; n < (etapaAtual || TOTAL_ETAPAS + 1); n++) vencedoras[n] = publicadas[n];

  if (etapaAtual === null) {
    return {
      etapaAtual: null,
      fase: 'votacao_encerrada',
      inicioEm: null,
      fimEm: null,
      candidatas: [],
      vencedoras,
      publicadas,
      porNumero,
    };
  }

  const atual = porNumero[etapaAtual] || {};
  const inicio = dataValida(atual.inicio_em);
  const fim = dataValida(atual.fim_em);

  let fase;
  if (!inicio || agora < inicio) fase = etapaAtual > 1 ? 'resultado_publicado' : 'aguardando_inicio';
  else if (!fim || agora < fim) fase = 'aberta';
  else fase = 'encerrada_aguardando_resultado';

  return {
    etapaAtual,
    fase,
    inicioEm: inicio ? inicio.toISOString() : null,
    fimEm: fim ? fim.toISOString() : null,
    candidatas: candidatasDaEtapa(etapaAtual, vencedoras),
    vencedoras,
    publicadas,
    porNumero,
  };
}

module.exports = {
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
};
