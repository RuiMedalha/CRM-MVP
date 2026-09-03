# HotelEquip CRM OS — Resumo do Sprint (18-19/07/2026)

> Documento de referência de tudo o que foi feito, testado e verificado neste sprint. Serve tanto para consulta futura como para dar contexto a quem (humano ou IA) pegar nisto depois.

---

## Estado geral

**P1 (Triagem de email + povoamento de leads): ✅ FECHADO**
**P2 (Identificação de contactos/WhatsApp): ✅ FECHADO**
**P3 Fase 1 (Proposta automática + regra de segurança): ✅ FECHADO**
**P3 Fase 2 (Formulário público de especificação): ✅ FECHADO, com refinamento de qualidade em curso**
**Bugs de layout, WhatsApp, telefone/telemóvel: ✅ CORRIGIDOS**

Tudo testado com dados reais, ao vivo (não só "parece que funciona") — inclui vários casos em que a primeira ou segunda tentativa falhou e foi corrigida depois de verificação independente.

---

## P1 — Triagem de email + povoamento de leads

### O que foi construído
- Gate de encaminhamento no n8n (`Check/Create Lead`): categorias `spam`, `fatura_administrativo`, `tabela_precos_fornecedor`, `fornecedor_sourcing`, `fornecedor_novidade`, `compra_fornecedor` **nunca criam lead**.
- Povoamento completo da lead na ingestão: nome da pessoa, empresa (separados), telefone fixo, **telemóvel** (campo novo), NIF, morada, cidade, código postal, website, tipo de pedido, papel do cliente, produtos pedidos.
- Categoria nova `fornecedor_novidade` no classificador.
- Limpeza histórica de 46 leads mal classificadas (com backup).
- Ligação automática thread → lead (`email_threads.lead_id`), evitando ambiguidade quando há várias leads com o mesmo email.

### Bugs encontrados e corrigidos pelo caminho
- `contact_name` e `contact_phone` de topo ficavam vazios mesmo com `lead_data` correto — corrigido com fallback defensivo.
- Nome da pessoa e nome da empresa a ficarem misturados ("Sprint Restaurante Teste Lda" em vez de separar "João Teste Sprint" / "Restaurante Teste Lda") — corrigido no prompt do classificador com regra explícita de não misturar linhas da assinatura.
- `display_name` a priorizar a empresa em vez da pessoa (decisão errada minha, revertida).
- Campo `phone` (WhatsApp) vs `contact_phone` (email) — dois campos diferentes na mesma tabela `leads`, causou bugs de apresentação em vários sítios até serem todos corrigidos com fallback.
- Botão "Ver" no badge "Lead já criada" ia para a lista genérica em vez da ficha da lead — corrigido para abrir o `LeadTimelineModal` diretamente.

### Testes reais confirmados
- Email de pedido de orçamento → lead criada com todos os dados corretos.
- Email de newsletter de fornecedor → classificado `fornecedor_novidade`, sem lead criada.
- Teste com assinatura de dois números (fixo + telemóvel) → campos separados corretamente.
- Teste "Pastelaria Doce Sabor Lda / Carlos Silva Mendes" usado como caso de referência em várias rondas de testes ao longo do dia.

---

## P2 — Identificação de contactos e WhatsApp

### O que foi construído
- Endpoints `/identify-contact` e `/apply-contact-identification` (extensão Directus).
- Backfill histórico: 193 conversas WhatsApp ligadas corretamente à instância 916, 2 à 918, 1 à 913.
- Correção do workflow `WA 918 — Evolution → CRM Directus`: agora liga `contact_id`/`lead_id` de volta à conversa (antes não fazia).

### Bugs encontrados e corrigidos
- **Bug do sort (`updated_at` vs `last_activity_at`):** a lista de WhatsApp ordenava por um campo que o Directus reescreve automaticamente em qualquer escrita (mesmo marcar como lida) — conversas antigas saltavam para o topo. Corrigido para ordenar por `last_activity_at` (atividade real).
- **Bug das instâncias trocadas (916/918):** um import histórico de 2 de junho tinha esquecido de gravar `instance_name`, e 157 conversas ficaram com o valor errado ("918" em vez de "916"). Corrigido com backup + correção em massa, confirmado pela prova de que o pedido à Evolution API original era mesmo à instância 916.
- **Bug de "50 mais recentes" só depois filtradas por instância:** o fetch buscava só as 50 conversas mais recentes de TODAS as instâncias antes de separar — se uma instância não tivesse atividade recente, ficava vazia mesmo tendo dados. Corrigido para filtrar por instância no pedido ao servidor.
- Duplicado suspeito de workflow (`Evolution → HubChat Mirror v3` e uma cópia) identificado, não resolvido ainda (ver pendências).

### Testes reais confirmados
- As 3 caixas (916/918/913) mostram cada uma as suas conversas reais, na ordem certa.
- Abrir uma conversa sem mensagens novas não a faz subir na lista.
- Ligação automática de novas conversas WhatsApp testada e corrigida (bug de referência a nó errado no n8n, corrigido com fallback robusto).

---

## P3 Fase 1 — Proposta automática a partir de email

### O que foi construído
- Botão "→ Proposta" (já existia, estava partido — usava `window.location.href` em vez do contrato `navigate(..., {state})`) — corrigido.
- Botão novo "Criar proposta automática": cria uma `quotation` em rascunho + `quotation_items`, ligada à thread, sem duplicar se já existir.
- **Regra de segurança (a parte mais importante):** antes de associar um produto automaticamente, o sistema avalia os top 5 candidatos do Meilisearch:
  - Se a dispersão de preço entre eles for grande (>3x), OU
  - Se o preço do candidato escolhido ultrapassar 3.000€ sem uma referência/modelo explícito no pedido
  - → o item fica `needs_review=true`, sem preço nem SKU fixo, com os candidatos guardados em notas para o agente decidir.
- Nunca envia a proposta sozinho — fica sempre em rascunho.

### Bugs encontrados e corrigidos (esta foi a parte mais difícil do dia)
- 1ª tentativa: a regra de segurança nunca disparava (o critério de dispersão não cobria o caso real, onde os 5 candidatos eram todos do mesmo tipo errado mas com preços parecidos entre si).
- 2ª tentativa: o sistema criava **um item por cada candidato da pesquisa** (3 máquinas de 10-15 mil euros na mesma proposta) em vez de um item por produto pedido.
- 3ª tentativa (bem-sucedida): 1 item por produto pedido + regra de dispersão + teto de preço absoluto (3.000€) → confirmado com o caso real da "Pastelaria Doce Sabor Lda" (pedido: "máquina de lavar loiça industrial") a ficar corretamente marcado para revisão, sem preço fixo.
- `customer_name`/`customer_company` da proposta ficavam vazios ou trocados — corrigido.

### Testes reais confirmados
- Caso real "máquina de lavar loiça industrial" (pastelaria pequena): a proposta fica com o item em revisão, não com uma máquina de 10.405€-24.000€ escolhida às cegas.
- Não duplica ao clicar duas vezes.
- Cliente (nome + empresa) gravado corretamente na proposta.

---

## P3 Fase 2 — Formulário público de especificação

### O que foi construído
- Coleção nova `product_specifications` (schema criado diretamente via API do Directus: `quotation_item_id`, `questions` json, `answers` json, `photo_url`, `status`).
- Permissões públicas configuradas (leitura de campos não-sensíveis + atualização só para submeter resposta).
- Botão "Gerar formulário" (ao lado do "Pedir esclarecimento" da Fase 1) — gera 3-5 perguntas por IA e um link público.
- Página pública `/p/:token/spec/:itemId` (reutiliza o `public_token` da proposta, sem sistema de autenticação novo) — mostra o produto de referência, motivo de dúvida, e as perguntas com o tipo de input certo (texto, número, escolha, foto).
- Painel do agente mostra as respostas do cliente de forma legível ao reabrir a thread.

### Bugs encontrados e corrigidos
- Bug do "dedup path" — ao reabrir uma thread com proposta já criada numa sessão anterior, o estado de `needsReview` nunca era recalculado, escondendo os botões de esclarecimento. Corrigido para reidratar o estado a partir dos itens reais da proposta.
- Validação de foto obrigatória bloqueava a submissão silenciosamente sem aviso claro (não é bug, mas fica como ponto a rever — ver pendências).

### Problema de qualidade identificado (correção em curso, ver pendências)
- As perguntas geradas presumiam o tipo/escala errado do equipamento (ex: perguntou sobre "1800 ou 1980 pratos/hora" — máquina de túnel industrial — para uma pastelaria pequena), porque foram geradas a partir de candidatos de pesquisa enviesados. Pedido enviado ao Claude Code para corrigir: perguntas de descoberta (tipo de uso, substituição/novo, posicionamento, energia) antes de qualquer pergunta sobre escala, sem presumir nem grande nem pequeno, com agradecimento inicial, e suporte para vários produtos ambíguos no mesmo pedido (bug confirmado: só o primeiro item em revisão gerava formulário).

### Testes reais confirmados
- Formulário gerado com perguntas certas (antes da correção de qualidade acima).
- Página pública acessível sem sessão, com os inputs certos por tipo.
- Submissão de resposta gravada corretamente no backend.
- Painel do agente mostra as respostas.
- Token/item inválido não expõe nada.

---

## Arquitetura — divisão de responsabilidades (importante para o futuro)

Há **dois sistemas de IA diferentes** neste CRM, cada um com o seu dono:

| Sistema | Onde vive | Quem edita | Quando corre |
|---|---|---|---|
| Classificação automática de email (nome, empresa, produtos, categoria) | n8n, nó "Claude · Classificar" | **Claude (eu, via API do n8n)** | Automaticamente, em todo email que chega |
| Ações do agente no CRM (Detectámos, Pedir esclarecimento, Gerar formulário) | Código do CRM, `src/integrations/ai/anthropicClient.ts` | **Claude Code (via commits)** | Só quando o agente clica um botão |

Ambos passam pela IA (Claude/Anthropic), mas por proxies diferentes — nunca com chave exposta no frontend.

---

## Pendências (para retomar noutro dia, sem pressa)

1. **Qualidade das perguntas de esclarecimento** — prompt já enviado ao Claude Code, a aguardar resposta e teste.
2. **Foto obrigatória no formulário de especificação** — considerar tornar opcional (cliente pode não ter foto à mão no momento).
3. **Cotação vs. Proposta como tipos distintos** — o sistema já tem o campo `document_type`, mas nunca foi usado (as 60 propostas existentes são todas "proposal"). Decisão pendente: o P3 automático deveria criar "Cotação" rápida por defeito? Rui ainda a pensar.
4. **Dropdowns de "Segmento" e "Tipo de negócio"** — combinado: IA sugere + agente pode adicionar novo valor se não existir o certo. Não implementado ainda.
5. **Layout mobile** — problema reportado no início do dia ("botões cortados, texto sobreposto"), nunca chegámos a investigar com screenshots reais do telemóvel. Fica para retomar.
6. **Workflow duplicado suspeito no n8n** (`Evolution → HubChat Mirror v3` + cópia) — identificado, não investigado a fundo nem corrigido.
7. **P3 Fase 2 — múltiplos produtos em revisão** — bug confirmado (`handleGenerateForm` só trata do primeiro item), fix pedido ao Claude Code, a aguardar.

---

## Notas técnicas úteis para o futuro

- **Verificação obrigatória**: nunca aceitar "está feito" do Claude Code sem confirmar o commit no GitHub e, sempre que possível, testar ao vivo no browser real. Vários "prontos" ao longo do dia afinal não tinham sido commitados, ou tinham bugs que só apareceram em teste real.
- **Cache do browser**: limpar service worker + cache antes de cada teste (`navigator.serviceWorker.getRegistrations()` + `caches.keys()`), várias vezes os testes falharam por estar a ver a versão antiga.
- **Directus**: alterações de schema via API de campos (`POST /fields/{collection}`) funcionam bem para adicionar colunas simples; para coleções novas, `POST /collections` seguido de `POST /fields`. Limpar cache depois (`POST /utils/cache/clear`).
- **Permissões públicas no Directus**: usar a policy `$t:public_label` (não existe "role Public" clássico nesta versão do Directus — é um sistema de policies).
- **n8n**: qualquer alteração a Code nodes precisa do ciclo desativar → PUT → aguardar 5s → ativar.
