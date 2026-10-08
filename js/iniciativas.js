(function () {
  const listaPrestacao = document.getElementById('lista-prestacao-contas');
  if (!listaPrestacao) return;

  const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

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

  function cartaoRepasse(item) {
    const card = el('div', 'repasse-card');
    card.appendChild(el('p', 'repasse-card-nome', item.nome));

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

  // As ONGs são as vencedoras publicadas, por ordem de etapa.
  function ongsVencedoras(instituicoes, estado) {
    const porId = {};
    instituicoes.forEach(function (i) {
      porId[i.id] = i;
    });
    const itens = [];
    if (estado && estado.vencedoras) {
      [1, 2, 3].forEach(function (n) {
        (estado.vencedoras[n] || []).forEach(function (id) {
          if (porId[id]) itens.push(itemDeInstituicao(porId[id]));
        });
      });
    }
    return itens;
  }

  const ongs = Promise.all([
    BF.carregarInstituicoes().catch(function () {
      return [];
    }),
    BF.obterEstadoInicial().catch(function () {
      return null;
    }),
  ]).then(function (res) {
    return ongsVencedoras(res[0], res[1]);
  });

  Promise.all([ongs, BF.carregarProtetores()]).then(function (res) {
    res[0].concat(res[1]).filter(definida).forEach(function (item) {
      listaPrestacao.appendChild(cartaoRepasse(item));
    });
  });
})();
