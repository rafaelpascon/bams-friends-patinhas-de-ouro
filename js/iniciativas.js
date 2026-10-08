(function () {
  const listaOngs = document.getElementById('lista-ongs');
  const listaProtetores = document.getElementById('lista-protetores');
  const listaPrestacao = document.getElementById('lista-prestacao-contas');
  if (!listaOngs && !listaProtetores && !listaPrestacao) return;

  const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const VAGAS_ONG = [1, 1, 2, 2, 3, 3];

  function formatarDataISO(iso) {
    const partes = String(iso).split('-');
    if (partes.length !== 3) return iso;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function el(tag, className, conteudo) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (conteudo !== undefined) node.textContent = conteudo;
    return node;
  }

  function definida(item) {
    return item && item.status === 'definida' && item.nome;
  }

  function cartaoIniciativa(item) {
    const card = el('div', 'iniciativa-card');
    if (definida(item)) {
      if (item.foto) {
        const img = el('img', 'iniciativa-card-foto');
        img.src = item.foto;
        img.alt = item.nome;
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        const placeholder = el('div', 'placeholder-box aspect-square');
        placeholder.appendChild(el('span', null, item.nome));
        card.appendChild(placeholder);
      }
      card.appendChild(el('p', 'iniciativa-card-nome', item.nome));
      if (item.instagram) {
        const link = el('a', 'iniciativa-card-insta', '@' + item.instagram.replace(/^@/, ''));
        link.href = BF.linkInstagram(item.instagram);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.appendChild(link);
      }
    } else {
      const placeholder = el('div', 'placeholder-box aspect-square');
      placeholder.appendChild(el('span', null, 'Em breve'));
      card.appendChild(placeholder);
    }
    return card;
  }

  function cartaoRepasse(item) {
    const card = el('div', 'repasse-card');
    card.appendChild(el('p', 'repasse-card-nome', definida(item) ? item.nome : 'Em breve'));

    const repasse = item.repasse;
    if (!repasse) {
      card.appendChild(el('p', 'repasse-card-status', 'Aguardando repasse'));
      return card;
    }

    if (typeof repasse.valor === 'number') {
      const p = el('p', 'repasse-campo');
      p.appendChild(el('strong', null, 'Valor recebido: '));
      p.appendChild(document.createTextNode(formatadorBRL.format(repasse.valor)));
      card.appendChild(p);
    }
    if (repasse.data) {
      const p = el('p', 'repasse-campo');
      p.appendChild(el('strong', null, 'Data do repasse: '));
      p.appendChild(document.createTextNode(formatarDataISO(repasse.data)));
      card.appendChild(p);
    }
    if (repasse.comprovante) {
      const p = el('p', 'repasse-campo');
      const link = el('a', 'repasse-link', 'Ver comprovante');
      link.href = repasse.comprovante;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      p.appendChild(link);
      card.appendChild(p);
    }
    if (Array.isArray(repasse.registros) && repasse.registros.length) {
      const wrap = el('div', 'repasse-registros');
      repasse.registros.forEach(function (src) {
        const img = el('img');
        img.src = src;
        img.alt = 'Registro do repasse para ' + (item.nome || 'a iniciativa');
        img.loading = 'lazy';
        wrap.appendChild(img);
      });
      card.appendChild(wrap);
    }
    if (Array.isArray(repasse.outros) && repasse.outros.length) {
      const p = el('p', 'repasse-campo');
      p.appendChild(el('strong', null, 'Outros documentos:'));
      card.appendChild(p);
      const lista = el('ul');
      repasse.outros.forEach(function (doc) {
        const li = el('li');
        const link = el('a', 'repasse-link', doc.titulo || 'Documento');
        link.href = doc.arquivo;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        li.appendChild(link);
        lista.appendChild(li);
      });
      card.appendChild(lista);
    }
    return card;
  }

  function itemDeInstituicao(inst) {
    return {
      status: 'definida',
      nome: inst.nome,
      instagram: inst.instagram,
      foto: inst.foto,
      repasse: inst.repasse || null,
    };
  }

  // As 6 vagas de ONG são as vencedoras publicadas, por ordem de etapa. Sem dado, ficam "Em breve".
  function vagasDeOng(instituicoes, estado) {
    const porId = {};
    instituicoes.forEach(function (i) {
      porId[i.id] = i;
    });
    const porEtapa = { 1: [], 2: [], 3: [] };
    if (estado && estado.vencedoras) {
      [1, 2, 3].forEach(function (n) {
        (estado.vencedoras[n] || []).forEach(function (id) {
          if (porId[id]) porEtapa[n].push(itemDeInstituicao(porId[id]));
        });
      });
    }
    const usados = { 1: 0, 2: 0, 3: 0 };
    return VAGAS_ONG.map(function (etapa) {
      const item = porEtapa[etapa][usados[etapa]];
      usados[etapa] += 1;
      return item || { status: 'em_breve', nome: null, repasse: null };
    });
  }

  const protetores = fetch('data/iniciativas.json')
    .then(function (r) {
      return r.json();
    })
    .catch(function () {
      return [];
    });
  const ongs = Promise.all([
    BF.carregarInstituicoes().catch(function () {
      return [];
    }),
    BF.obterEstadoInicial().catch(function () {
      return null;
    }),
  ]).then(function (res) {
    return vagasDeOng(res[0], res[1]);
  });

  Promise.all([ongs, protetores]).then(function (res) {
    const vagas = res[0];
    const listaProtetoresDados = res[1];
    if (listaOngs) vagas.forEach(function (item) { listaOngs.appendChild(cartaoIniciativa(item)); });
    if (listaProtetores) {
      listaProtetoresDados.forEach(function (item) { listaProtetores.appendChild(cartaoIniciativa(item)); });
    }
    if (listaPrestacao) {
      vagas.concat(listaProtetoresDados).forEach(function (item) {
        listaPrestacao.appendChild(cartaoRepasse(item));
      });
    }
  });
})();
