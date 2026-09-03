# CRMMVP

> CRM HotelEquip MVP — Directus + React + shadcn, side-by-side com crm-lab-directus.

## Badges

Este repositório não usa badges externos.

| Área | Estado |
|---|---|
| Produto | MVP em evolução |
| Frontend | React + TypeScript |
| Backend | Directus existente |
| Licença | Proprietary |

---

## 1. Visão

O CRMMVP é a frente de evolução incremental do CRM comercial da HotelEquip.

Combina uma aplicação React moderna com a API e o modelo de dados que já
existem em Directus.

O objetivo é entregar fluxos de leads, negócios, comunicação, propostas e
contexto de cliente sem interromper a operação do CRM de laboratório.

O MVP reduz trabalho repetitivo da equipa comercial.

Também mantém um registo auditável de cada interação.

Cada canal — telefone, WhatsApp, chat do site, email, WooCommerce e redes
sociais — deve contribuir para a mesma visão do cliente.

O produto não pretende recriar a base Directus.

Expande essa base de forma compatível e reversível, por etapas de sprint.

### Princípios do produto

- Uma ficha de cliente, mesmo quando a conversa começou noutro canal.
- Ações comerciais rápidas, com contexto suficiente para a próxima decisão.
- Dados existentes primeiro; coleções novas apenas quando são necessárias.
- Integrações substituíveis, especialmente nos canais de WhatsApp e IA.
- Mudanças pequenas, validadas e publicadas sem um big-bang.

### Público interno

O MVP destina-se às equipas comercial, pré-venda, apoio ao cliente e gestão.

A interface prioriza consulta rápida, criação de leads e acompanhamento de oportunidades.

Também prioriza a continuidade do atendimento entre canais.

### Resultados esperados

- Menos duplicação de contexto entre ferramentas.
- Melhor seguimento de oportunidades.
- Menos tempo entre um contacto e a próxima ação comercial.
- Maior visibilidade sobre previsão e atividade.
- Base segura para a migração gradual do CRM.

---

## 2. Stack

| Camada | Tecnologia | Papel no projeto |
|---|---|---|
| Dados e API | Directus | Fonte de dados, autenticação e API existente |
| Build | Vite 5 | Desenvolvimento local e empacotamento rápido |
| UI | React 18 + TypeScript | Interface tipada por componentes |
| Componentes | shadcn/ui | Base acessível e consistente de interface |
| Estilos | Tailwind CSS 3 | Composição visual e responsividade |
| Dados no cliente | React Query | Cache, invalidação e estados assíncronos |
| Estado de UI | Zustand UI-only | Estado efémero sem duplicar dados do servidor |
| Realtime | Directus Realtime (futuro) | Atualizações de dados e notificações |
| Gráficos | Recharts | Visualização do forecast comercial |

### Diretriz de estado

React Query é a fonte de verdade para dados remotos.

Zustand é reservado a preferências, filtros transitórios, painéis e estados visuais.

Esta separação evita caches duplicados.

Também mantém invalidações previsíveis após criações, edições e eventos.

### Diretriz de componentes

Os componentes shadcn/ui são copiados para o projeto e evoluem com o projeto.

Não há uma dependência visual remota para os componentes de produto.

Tailwind permite manter tokens e variantes junto do código que os utiliza.

### Realtime previsto

Directus Realtime é uma evolução futura, não uma condição para executar o MVP.

Quando for ativado, deverá atualizar queries específicas ou invalidá-las pontualmente.

Não deve criar uma segunda fonte de verdade no navegador.

---

## 3. Estado atual (sprint 0)

| Card | Status | Descrição | Commits |
|---|---|---|---|
| Card 3 — Botão + /leads | done | Inline create button + Dialog + Directus POST | 5 |
| Card 8 — Forecast weighted | done | 30/60/90 dias + Recharts | 2+ |
| Card 13 — IA plug-in | done | 7 providers + retry + fallback | 4 |
| Card 14 — WhatsApp dual | done | Evolution API + Meta Cloud v18.0, multi-número | 4 |
| Card 15 — Customer 360 remodelado | 🟡 running | Timeline cross-channel + tabs mobile-first | TBD |
| Card 1+4 — Activity Ledger + Multi-Pipeline | 🟡 running | Audit wrapper + collections novas | TBD |

### Card 3 — criação de leads

O fluxo inclui botão de criação inline, diálogo de formulário e POST para Directus.

A implementação procura manter o utilizador na lista.

Depois de uma criação confirmada, a informação apresentada é atualizada.

### Card 8 — forecast ponderado

O forecast calcula cenários comerciais a 30, 60 e 90 dias.

Os resultados são apresentados com Recharts.

O objetivo é tornar visível a previsão ponderada sem substituir relatórios financeiros.

### Card 13 — IA plug-in

A integração de IA é orientada por providers configuráveis.

Há sete adaptadores, tentativas controladas e fallback.

Uma indisponibilidade de fornecedor não deve bloquear o fluxo comercial.

### Card 14 — WhatsApp dual

O canal WhatsApp suporta Evolution API e Meta Cloud API v18.0.

O modelo aceita múltiplos números.

As mensagens e atividades devem ser persistidas consistentemente.

### Cards em execução

Customer 360 e Activity Ledger/Multi-Pipeline estão assinalados como running.

As interfaces e coleções associadas continuam a evoluir.

Os contratos e campos devem ser validados contra Directus antes de qualquer rollout.

### Convenção de estado

done significa uma entrega funcional versionada no repositório.

running significa trabalho em curso cujo detalhe ainda pode mudar no sprint.

Este quadro não é confirmação de deploy em produção.

---

## 4. Schema Directus usado (não criado do zero)

| Collection | Uso |
|---|---|
| contacts | ficha de cliente (existente) |
| leads | leads / prospects (existente) |
| deals | negócios pipeline (existente, +pipeline_id +stage_id via migration) |
| activity | audit ledger cross-domain (existente, expandido) |
| Historico_Chamadas | chamadas Telecof (existente) |
| quotations / quotation_reviews | propostas (existente) |
| pipelines / pipeline_stages | multi-pipeline (NOVAS — sprint 1) |
| whatsapp_instances / whatsapp_messages | WhatsApp dual (NOVAS — sprint 0) |
| ai_providers / ai_settings | IA plug-in (NOVAS — sprint 0) |

### Estratégia de dados

O projeto trabalha sobre um schema Directus já existente.

Antes de criar coleções ou campos, confirma-se se a entidade já está disponível.

Depois avalia-se se pode ser estendida sem quebrar integrações atuais.

As alterações em deals são feitas por migration.

Isto mantém a associação a pipeline e stage explícita.

### Coleções existentes

contacts, leads, deals, activity, Historico_Chamadas, quotations e quotation_reviews
têm valor operacional existente.

O MVP consome e organiza esses dados.

Não deve apagar nem substituir a sua proveniência.

### Coleções novas

As coleções de WhatsApp e IA isolam configurações e mensagens dos novos adaptadores.

pipelines e pipeline_stages suportam mais de um processo comercial.

As etapas não devem ficar codificadas diretamente na aplicação.

### Migrações

Migrações são a via preferida para mudanças estruturais.

Devem ser aplicadas no ambiente correto e revistas antes de deploy.

Alterações de relações, índices, permissões ou campos existentes exigem rollback.

### Permissões

As permissões são administradas no Directus.

Devem respeitar equipas, papéis e necessidade de acesso.

Um token de browser não substitui regras de acesso.

Nunca adicione credenciais administrativas a ficheiros versionados ou ao bundle público.

---

## 5. Integrações obrigatórias

| Integração | Objetivo | Estado esperado |
|---|---|---|
| Directus | Dados, autenticação e API | Obrigatória desde o arranque |
| WhatsApp dual | Evolution API e Meta Cloud API | Obrigatória para comunicação WhatsApp |
| Wavoip | Telefonia e contexto de chamadas | Obrigatória no fluxo comercial |
| Chat-site | Conversas iniciadas no site | Obrigatória para omnicanalidade |
| WooCommerce | Encomendas e sinais de intenção | Obrigatória para contexto comercial |
| Redes Sociais | Interações e pedidos recebidos | Obrigatória para visão de cliente |
| IA plug-in | Assistência comercial configurável | Obrigatória como integração extensível |

### Directus

Directus é o ponto de ligação do frontend aos dados do CRM.

URLs, tokens e credenciais são configurados através de variáveis de ambiente.

Nunca devem ser copiados para commits, issues ou código de cliente.

### WhatsApp dual

O desenho dual evita dependência irreversível de uma única API.

Cada instância identifica número, fornecedor e estado operacional.

Os adaptadores convertem diferenças de Evolution e Meta Cloud para um contrato comum.

### Wavoip e Telecof

Chamadas de voz devem enriquecer a ficha de cliente e o ledger de atividades.

Não devem duplicar eventos.

Historico_Chamadas continua a ser a referência para registos existentes.

### Chat-site e redes sociais

Conversas iniciadas no site ou rede social devem poder ser ligadas a um contacto.

Também podem ser ligadas a lead ou negócio quando houver identificação suficiente.

Quando não existir, a aplicação deve preservar a origem.

Depois deve permitir reconciliação posterior.

### WooCommerce

Pedidos, carrinhos e histórico de compra podem orientar priorização comercial.

Devem ser apresentados como sinais verificáveis.

O acesso a esses dados continua sujeito às permissões aplicáveis.

### IA plug-in

A IA apoia redação, classificação e síntese.

Não é uma origem autónoma de dados de cliente.

Entradas, provider selecionado, falhas e fallbacks devem ser observáveis.

---

## 6. Como correr localmente

### Pré-requisitos

- Node.js compatível com o projeto e npm.
- Acesso a uma instância Directus de desenvolvimento.
- Credenciais locais válidas em ficheiro de ambiente.
- Git para obter o repositório e acompanhar alterações.

### Arranque rápido

    git clone https://github.com/RuiMedalha/CRM-MVP
    cd CRM-MVP
    npm install
    npx shadcn@latest init -d
    cp .env.example .env.local  # editar com VITE_DIRECTUS_URL e VITE_DIRECTUS_TOKEN
    npm run dev  # http://localhost:5173

No Windows PowerShell, pode copiar o exemplo com:

    Copy-Item .env.example .env.local

Depois, abra http://localhost:5173 no navegador.

A aplicação depende de Directus configurado para carregar dados reais.

### Configuração de ambiente

Comece sempre por .env.example.

Em .env.local, configure pelo menos:

    VITE_DIRECTUS_URL=https://seu-directus.exemplo
    VITE_DIRECTUS_TOKEN=substituir-por-token-de-desenvolvimento

Use apenas tokens com o menor privilégio necessário.

Não faça commit de .env.local, tokens, segredos OAuth, chaves de IA ou credenciais WhatsApp.

### Comandos úteis

    npm run dev
    npm run build
    npm run lint

O desenvolvimento serve a aplicação em modo local.

O build é útil para detetar erros de tipos, imports e configuração antes de deploy.

### shadcn/ui

O comando npx shadcn@latest init -d prepara a configuração de componentes.

Reveja alterações de configuração antes de as aceitar.

Mantenha o estilo do projeto alinhado com Tailwind CSS 3.

### Problemas comuns

Se a aplicação não obtiver dados, confirme URL Directus, token, permissões e rede.

Se um endpoint externo falhar, confirme o adaptador respetivo antes de alterar a UI.

---

## 7. Roadmap

O plano de aplicação do MVP é mantido no artefacto de revisão:

C:/Projetos/OVERCLOCK/revisao crm/revisao-m6/PLANO-APLICACAO-MVP.md

Consulte esse documento para cards, critérios de aceitação e dependências.

O roadmap deve ser lido com o estado real dos commits e ambiente.

### Próximas linhas de evolução

1. Concluir Customer 360 com timeline cross-channel e tabs mobile-first.
2. Consolidar Activity Ledger como trilho auditável entre domínios.
3. Aplicar multi-pipeline com stages configuráveis e migration validada.
4. Ligar canais externos com observabilidade, idempotência e reconciliação.
5. Introduzir Directus Realtime quando os fluxos o justificarem.
6. Endurecer testes de integração e validação visual antes de publicar.

### Critério para avançar de sprint

Cada card precisa de contrato de dados explícito.

Também precisa de validação do fluxo principal.

As permissões envolvidas devem ser revistas.

Uma interface concluída sem integração segura não é considerada pronta.

---

## 8. Decisão arquitetural: side-by-side, não big-bang

O CRMMVP vive em C:\Projetos\CRMMVP\, separado do laboratório crm-lab-directus.

Esta é uma decisão intencional.

Permite evoluir experiência e integrações sem substituir de uma vez o sistema em uso.

### Porque side-by-side

- Reduz o risco de uma migração total e difícil de reverter.
- Permite comparar fluxos e resultados com o laboratório existente.
- Separa decisões de produto novas da manutenção do sistema atual.
- Torna cada integração verificável antes de se tornar dependência central.
- Facilita a adoção gradual por equipas e canais.

### Regra de convivência

Os dois projetos podem partilhar serviços e coleções Directus.

Não devem assumir que o outro repositório foi alterado.

Schema, permissões ou webhooks precisam de compatibilidade explícita.

### Caminho de migração

A convergência só acontece depois de os fluxos críticos estarem validados no MVP.

Os dados necessários devem ter mapeamento claro.

Também deve existir um plano de rollback.

Até esse momento, side-by-side é continuidade operacional.

Não é um estado acidental do código.

---

## 9. Licença

Proprietary / All rights reserved.

Este código, configuração, integrações e documentação são propriedade do titular.

Não é concedida licença de reutilização, redistribuição ou exploração comercial.

É necessária autorização escrita do proprietário.

---

## 10. Contacto

**Contacto do projeto:** a definir.

Para pedidos de acesso ou questões de integração, utilize o canal interno HotelEquip.

Inclua ambiente, módulo afetado, impacto esperado e evidência disponível.

---

## Notas de contribuição interna

Antes de alterar uma integração, confirme o contrato do fornecedor e Directus.

Antes de alterar uma coleção, confirme impactos em automações, páginas e permissões.

Antes de publicar, execute verificações relevantes.

Garanta que nenhum ficheiro de ambiente ou segredo foi incluído no commit.

Commits devem ser pequenos, legíveis e orientados a uma intenção.

Alterações em schema, UI e adaptadores externos devem explicitar dependências.

Isto facilita revisão, rollback e diagnóstico em produção.

## Segurança operacional

Segredos pertencem ao ambiente de execução, não ao Git.

Workflows n8n, exports e JSON devem usar valores de substituição ao publicar.

Se um segredo for exposto, revogue-o no fornecedor.

Depois reescreva o histórico antes de voltar a publicar.

## Referências locais

- Plano do MVP: C:/Projetos/OVERCLOCK/revisao crm/revisao-m6/PLANO-APLICACAO-MVP.md
- Repositório local do MVP: C:/Projetos/CRMMVP/
- Laboratório separado: C:/Projetos/crm-lab-directus/

## Resumo

CRMMVP moderniza o CRM por incrementos.

Mantém Directus como base.

Usa React para uma experiência mais rápida.

Organiza integrações sem comprometer a continuidade do sistema atual.

## Checklist antes de publicar

- Confirmar que o build termina sem erros relevantes.
- Confirmar que as variáveis de ambiente não foram versionadas.
- Confirmar permissões Directus das coleções alteradas.
- Confirmar que integrações externas usam configuração do ambiente.
- Confirmar que migrations foram revistas e têm sequência clara.
- Confirmar que não há segredos em exports, JSON ou workflows.
- Confirmar que o fluxo principal foi testado no ambiente certo.
- Confirmar que rollback e impacto operacional foram considerados.

## Glossário

**Customer 360** é a vista consolidada da relação com um contacto.

**Activity Ledger** é o registo transversal de eventos e ações comerciais.

**Multi-Pipeline** permite processos comerciais com etapas independentes.

**Adapter** é a camada que normaliza um fornecedor externo para o CRM.

**Side-by-side** é a convivência deliberada entre MVP e laboratório.

**Sprint 0** é a fase inicial de entrega e validação das fundações do MVP.
