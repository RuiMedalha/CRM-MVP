# Customer 360 remodelado

## Objetivo

O Customer 360 oferece uma leitura única do relacionamento com um contacto, sem obrigar a equipa a navegar entre mensagens, chamadas, propostas e encomendas.

## Decisões de UX

- O cabeçalho é fixo, com identidade do contacto, score, telefone copiável, email e ações primárias.
- Em telemóvel, as ações abrem num bottom sheet para manter o cabeçalho legível e os alvos de toque amplos; em desktop ficam visíveis no topo.
- As cinco tabs usam navegação horizontal e aceitam swipe: Timeline, Propostas, Compras, Comunicação e Notas.
- A Timeline ordena eventos por data e identifica visualmente WhatsApp, email, chamadas, propostas, atividade e notas.
- Cards de baixa elevação mantêm a leitura escaneável; estados vazios explicam onde cada tipo de dado aparecerá.
- A criação de notas permanece na própria tab, evitando uma mudança de contexto.

## Dados agregados

`useCustomer360Remodeled(contactId)` consulta `contacts`, `whatsapp_messages`, `email_threads`, `Historico_Chamadas`, `quotations`, o ledger `activity`, `site_orders` e, quando disponível, `customer_notes`. Coleções opcionais degradam para listas vazias, para que o perfil continue utilizável durante migrações de schema.

## Rotas

O ecrã principal está em `/customer360/:id`. As rotas antigas `/customer360-shell/:id` continuam como redirecionamento de compatibilidade.
