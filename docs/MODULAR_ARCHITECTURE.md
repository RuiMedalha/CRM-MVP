\# Hotelequip SaaS - Modular Architecture



\## Decisão



O CRM Hotelequip será evoluído como plataforma modular.



O projeto atual `crm-lab-directus` passa a ser tratado como CRM Core.



Novos módulos serão criados como projetos independentes, integrados por API, Directus, MCP e autenticação comum.



\---



\## Objetivos



\- Evitar CRM pesado e difícil de manter

\- Preparar venda futura por módulos

\- Permitir aluguer mensal por funcionalidade

\- Facilitar manutenção

\- Facilitar escalabilidade

\- Permitir app mobile futura

\- Manter dados centrais no Directus



\---



\## Módulos



\### CRM Core

Repositório atual:

`crm-lab-directus`



Responsável por:

\- contactos

\- leads

\- empresas

\- pipeline

\- tarefas

\- utilizadores

\- configurações

\- timeline

\- permissões

\- dashboard 360



\### Communication Hub

Novo módulo.



Responsável por:

\- inbox omnichannel

\- WhatsApp

\- chat do site

\- Telecof/telefone

\- Instagram

\- Facebook

\- agentes

\- handoff IA/humano

\- anexos

\- conversas



\### Quotes Center

Novo módulo.



Responsável por:

\- criação avançada de orçamentos

\- Moloni

\- PDF

\- envio por email/WhatsApp

\- produtos WooCommerce

\- aprovação/rejeição

\- conversão em encomenda



\### Marketing Center

Novo módulo.



Responsável por:

\- Mautic

\- newsletters

\- campanhas

\- Meta Ads

\- Google Ads

\- relatórios

\- atribuição campanha → lead → venda



\### Automation Center

Novo módulo.



Responsável por:

\- n8n

\- workflows

\- triggers

\- logs

\- follow-ups automáticos



\### AI Assistant

Novo módulo.



Responsável por:

\- Ask Me

\- IA do site

\- respostas automáticas

\- sugestões ao agente

\- pesquisa Meilisearch

\- resumo de conversas



\### MCP / API Gateway

Novo módulo.



Responsável por:

\- acesso seguro às integrações

\- tokens

\- ferramentas IA

\- comunicação entre módulos

\- logs técnicos



\---



\## Dados



Directus será o source of truth principal.



Supabase poderá ser usado onde fizer sentido para:

\- realtime

\- presence

\- sessões

\- streaming

\- eventos live



\---



\## Estratégia SaaS



Preparar desde já:

\- tenant\_id

\- permissões por módulo

\- planos

\- feature flags

\- isolamento de dados

\- billing futuro



\---



\## Estratégia de desenvolvimento



\- GitHub como fonte principal

\- Cursor como ambiente principal

\- Lovable apenas para protótipos visuais

\- Branches por módulo

\- Commits pequenos

\- Documentação obrigatória antes de implementação

