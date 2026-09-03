# Patch ao Prompt Classificador — Categoria `fornecedor_novidade`

> **Contexto**: este texto deve ser inserido no System Prompt do nó classificador
> dos workflows n8n `ZkaA5zquAFBfQuJR` (apoio.cliente@) e `LIGCJw1vKFKzMsB9`
> (geral@), ANTES da lista de categorias existentes.
>
> **Quem aplica**: operador n8n (não o Claude Code / repo).
>
> **Data**: 15/07/2026

---

## Bloco a inserir (copiar tal e qual)

```text
## Nova categoria: fornecedor_novidade

Diferença crítica vs fornecedor_sourcing:
- fornecedor_novidade = email de um fornecedor JÁ CONHECIDO que apenas
  comunica informação / novidades de produto (newsletter, anúncio de gama,
  promoção sazonal, atualização de catálogo). NÃO quer vender nada a nós
  nesta mensagem; está a informar.
- fornecedor_sourcing = tentativa activa de vender à HotelEquip (cold
  outreach, prospecção, pedido de reunião comercial, oferta de serviços
  não solicitados).

Distinção prática:
- Tem CTAs comerciais directos (pedir demo, agendar reunião, ligar)?
  → fornecedor_sourcing
- É newsletter / comunicado / "acabou de sair" / "nova gama" / "vejam o
  nosso catálogo" sem pedir resposta comercial imediata?
  → fornecedor_novidade

### Exemplos

1. "Lançamento: nova gama de fornos convectivos GN 1/1 com controlo
   digital. Veja o catálogo em anexo. — Equipa Edenox Portugal"
   → fornecedor_novidade
   (informação de produto de fornecedor conhecido, sem CTA comercial directo)

2. "Olá, somos a X novos representantes em Portugal de câmaras frigoríficas.
   Podemos agendar uma reunião esta semana para vos apresentar a gama?"
   → fornecedor_sourcing
   (cold outreach, CTA comercial directo, fornecedor não conhecido)
```

---

## Notas de implementação

- O campo `email_threads.category` é `character varying` — não precisa de
  migração de schema. Qualquer valor novo que o classificador devolver é
  aceite pelo Directus sem alteração.
- Após aplicar, verificar com 1-2 emails de teste (newsletters de
  edenox, hendi, sammic) que a classificação retorna `fornecedor_novidade`
  e não `spam` nem `fornecedor_sourcing`.
- O gate no nó "Check/Create Lead" deve tratar `fornecedor_novidade` da
  mesma forma que `fornecedor_sourcing`: **NÃO criar lead**, marcar thread
  com `status=novidade`.
