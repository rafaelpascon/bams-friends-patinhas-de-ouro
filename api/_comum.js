const ONGS = ['patinhas-felizes', 'amigos-quatro-patas', 'patas-do-bem'];

function configuracao() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY, VOTE_SALT } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TURNSTILE_SECRET_KEY || !VOTE_SALT) return null;
  return {
    url: SUPABASE_URL.replace(/\/$/, ''),
    chave: SUPABASE_SERVICE_ROLE_KEY,
    turnstile: TURNSTILE_SECRET_KEY,
    sal: VOTE_SALT,
    maxPorIp: parseInt(process.env.MAX_VOTES_PER_IP || '3', 10),
  };
}

function cabecalhos(cfg, extra) {
  return Object.assign(
    { apikey: cfg.chave, Authorization: 'Bearer ' + cfg.chave, 'Content-Type': 'application/json' },
    extra || {}
  );
}

module.exports = { ONGS, configuracao, cabecalhos };
