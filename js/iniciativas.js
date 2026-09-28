(function () {
  const listaOngs = document.getElementById('lista-ongs');
  const listaProtetores = document.getElementById('lista-protetores');
  const listaPrestacao = document.getElementById('lista-prestacao-contas');
  if (!listaOngs && !listaProtetores && !listaPrestacao) return;

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

  function cartaoIniciativa(item) {
    const card = el('div', 'iniciativa-card');
    if (item.status === 'definida' && item.nome) {
      if (item.foto) {
        const img = el('img', 'w-full aspect-square object-cover');
        img.src = item.foto;
        img.alt = 'Foto de ' + item.nome;
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
        link.href = 'https://instagram.com/' + item.instagram.replace(/^@/, '');
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
    card.appendChild(el('p', 'repasse-card-nome', item.nome || 'Em breve'));

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

  fetch('data/iniciativas.json')
    .then(function (r) { return r.json(); })
    .then(function (iniciativas) {
      if (listaOngs && listaProtetores) {
        iniciativas.forEach(function (item) {
          const alvo = item.tipo === 'ong' ? listaOngs : listaProtetores;
          alvo.appendChild(cartaoIniciativa(item));
        });
      }
      if (listaPrestacao) {
        iniciativas.forEach(function (item) {
          listaPrestacao.appendChild(cartaoRepasse(item));
        });
      }
    })
    .catch(function () {
      [listaOngs, listaProtetores, listaPrestacao].forEach(function (container) {
        if (container) container.textContent = 'Não foi possível carregar as iniciativas agora.';
      });
    });
})();
