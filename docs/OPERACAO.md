# Operação da votação

Tudo que muda no dia a dia fica no Supabase (Table Editor), sem deploy.

## Regras em uma linha
3 etapas, 2 vencedoras por etapa (6 no total), 1 voto por pessoa em cada etapa. Quem vence uma etapa não entra nas seguintes. Cada vencedora recebe R$ 1.500. Em empate, a organizadora desempata.

## Datas: sempre com o fuso
Ao digitar `inicio_em` e `fim_em` na tabela `etapas`, inclua o fuso de Brasília, por exemplo `2026-10-20 09:00:00-03`. Sem o `-03` o horário pode ser lido como UTC, três horas fora. A tela `/acompanhar` mostra as datas em horário de Brasília para você conferir.

## Passo a passo

**Abrir uma etapa.** Em `etapas`, na linha da etapa, preencha `inicio_em` e `fim_em`. A etapa só abre se a anterior já tiver vencedoras publicadas. Se `fim_em` ficar vazio, a etapa fica aberta até você preenchê-lo.

**Mudar datas.** Edite `inicio_em` e `fim_em` da linha. O site atualiza em até cerca de 1 minuto.

**Encerrar antes da hora.** Coloque em `fim_em` o horário de agora (com `-03`).

**Conferir ranking e empate.** Abra `https://www.bamsfriends.org/acompanhar` e entre com a senha. A tela mostra total de votos, votos na última hora, o ranking completo e um alerta quando há empate pela 2ª posição. O botão "Baixar CSV" salva o ranking. No Supabase, a view `ranking_votos` mostra o mesmo ranking (sem votos de teste).

**Publicar as vencedoras.** Depois de a organizadora decidir (e desempatar, se preciso), edite a coluna `vencedoras` da etapa com os 2 ids, neste formato: `{"id-da-primeira","id-da-segunda"}`. Os ids estão no campo `id` de `data/instituicoes.json`. Ao publicar:
- a etapa passa a mostrar o resultado e a próxima vira a etapa atual;
- as 2 vencedoras saem da lista de candidatas das etapas seguintes;
- "Instituições contempladas", "Quem apoiamos" e "Prestação de contas" passam a mostrá-las.

Não há publicação automática: o ranking nunca vira vencedora sozinho.

**Corrigir vencedoras publicadas por engano.** Edite a coluna `vencedoras` de novo. A tela `/acompanhar` avisa se houver id inexistente, repetido ou vencedoras fora de ordem.

**Adicionar um protetor independente.** Em `data/iniciativas.json`, na vaga do protetor, mude `status` para `"definida"` e preencha `nome`, `instagram` e `foto` (arquivo em `assets/`). Isso precisa de commit e deploy.

**Registrar um repasse.** No registro da instituição vencedora em `data/instituicoes.json`, adicione o campo `repasse`:
```json
"repasse": {
  "valor": 1500,
  "data": "2026-10-25",
  "comprovante": "assets/comprovantes/id-da-instituicao/comprovante.pdf",
  "registros": ["assets/comprovantes/id-da-instituicao/foto1.webp"],
  "outros": [{ "titulo": "Nota fiscal de ração", "arquivo": "assets/comprovantes/id-da-instituicao/nota.pdf" }]
}
```
Todos os campos são opcionais. Os arquivos ficam em `assets/comprovantes/<id>/`. Também precisa de commit e deploy.

**Apagar votos de teste ou zerar a votação.** No SQL Editor:
```sql
delete from public.votos where teste;  -- só votos de teste
delete from public.votos;              -- tudo (use antes de valer)
```

## Variáveis de ambiente (Vercel)

| Variável | Onde | Para quê |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Production e Preview | Acesso ao banco |
| `VOTE_SALT` | Production e Preview | Sal do hash de IP |
| `TURNSTILE_SECRET_KEY` | Production: chave real. Preview: `1x0000000000000000000000000000000AA` | Verificação do captcha |
| `TURNSTILE_SITE_KEY` | Production: não precisa (usa a chave do site). Preview: `1x00000000000000000000AA` | Chave pública do captcha |
| `VOTE_TEST_MODE` | Só Preview, valor `1` | Votos viram "teste" e o ranking só lê votos de teste |
| `ACOMPANHAR_SENHA` | Production e Preview | Senha da tela `/acompanhar` (use uma senha longa) |
| `MAX_VOTES_PER_IP` | Opcional | Votos por conexão em cada etapa (padrão 3) |

Depois de mudar qualquer variável é preciso um novo deploy.

## Testar sem afetar a votação real
Em branches (preview), as chaves de teste do Turnstile e `VOTE_TEST_MODE=1` fazem os votos entrarem como teste, separados dos votos de produção. Preview e produção usam o mesmo Supabase, por isso a separação é pela coluna `teste`.

## Se algo não abrir
- A etapa não abre: confira `inicio_em` (já passou?), `fim_em` (ainda não chegou?) e se a etapa anterior tem 2 vencedoras.
- A votação mostra horário errado: faltou o `-03` ao digitar a data.
- `/acompanhar` pede senha de novo: a senha fica só na sessão do navegador e some ao fechar a aba.
- 5 senhas erradas bloqueiam a tela por 15 minutos para aquela conexão.

## Limpeza opcional depois do merge
A função antiga `contagem_votos()`, do protótipo com 3 instituições, não é mais usada:
```sql
drop function if exists public.contagem_votos();
```
