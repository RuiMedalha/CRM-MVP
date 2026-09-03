\# Hotelequip CRM - System Architecture



\## Estado atual



O CRM Hotelequip já contém uma base avançada com:



\- CRM Core

\- Card 360

\- Leads não atendidas

\- Contactos

\- Newsletter

\- Pipeline

\- Orçamentos

\- Agenda

\- Fornecedores

\- Integrações

\- Definições

\- Utilizadores

\- Popup de chamada/lead

\- Integrações com Directus

\- Workflows n8n

\- Chatwoot inbound

\- Email inbound

\- PDF service para orçamentos

\- Hooks Directus para estados de orçamento



\---



\## Serviços principais



\### Directus

Source of truth para:

\- contactos

\- leads

\- orçamentos

\- interações

\- pipeline

\- fornecedores

\- configurações

\- utilizadores

\- histórico



\### n8n

Automação:

\- envio de orçamentos

\- geração de PDF

\- inbound Chatwoot

\- inbound email

\- follow-ups

\- logs



\### Chatwoot

Atualmente usado como camada de mensagens/inbox.

Futuro: pode ser substituído ou complementado por Inbox própria.



\### WooCommerce

Fonte de:

\- produtos

\- clientes

\- encomendas

\- histórico comercial



\### Moloni

Objetivo:

\- criação de documentos comerciais

\- orçamentos/propostas

\- faturação futura



\### Meilisearch

Objetivo:

\- pesquisa rápida de produtos

\- pesquisa semântica/FAQ

\- apoio ao chat IA e ao orçamento



\### Mautic

Objetivo:

\- newsletters

\- campanhas

\- segmentos

\- nutrição de leads



\### WhatsApp Oficial

Objetivo:

\- receber mensagens

\- responder pelo CRM

\- enviar PDFs/orçamentos

\- manter histórico no cliente



\---



\## Estratégia modular



O CRM atual deve permanecer como core.



Novos módulos devem ser criados de forma independente/modular:



\- Communication Hub

\- Quotes Center

\- Marketing \& Ads Center

\- Automation Center

\- Mobile App



Todos devem partilhar:

\- Directus

\- API Gateway/MCP

\- permissões

\- design system

\- eventos

\- histórico do cliente



\---



\## Prioridade imediata



1\. Consolidar documentação

2\. Mapear schema real do Directus

3\. Validar orçamentos/PDF/n8n

4\. Criar Communication Hub

5\. Ligar Ask Me/chat IA

6\. Ligar WhatsApp oficial

7\. Evoluir Moloni/orçamentos

8\. Criar Marketing \& Ads Center





\# Hotelequip CRM - System Architecture



\## Core Stack

\- React/Vite CRM frontend

\- Directus CRM backend

\- Supabase realtime/services

\- n8n automations

\- Mautic marketing automation

\- WooCommerce ecommerce

\- Meilisearch search engine

\- Moloni billing/quotes

\- WhatsApp Official API

\- Chatwoot messaging

\- Telefonia / central



\---



\## Current Modules



\### CRM Core

\- Dashboard

\- Card360

\- Leads

\- Contactos

\- Pipeline

\- Agenda

\- Fornecedores

\- Definições

\- Utilizadores



\### Integrations

\- Moloni

\- WooCommerce

\- Chatwoot

\- Typebot

\- WhatsApp API

\- n8n

\- Meilisearch



\---



\## Future Modules



\### Communication Hub

Omnichannel inbox:

\- site chat

\- WhatsApp

\- Instagram

\- Facebook

\- calls



\### Quotes Center

\- quote builder

\- PDF

\- Moloni integration



\### Marketing \& Ads

\- Meta Ads

\- Google Ads

\- campaign analytics

\- ROAS



\### Automation Center

\- workflow management

\- triggers

\- follow-ups

\- lead automation



\---



\## Architecture Strategy



CRM Core remains stable.



Large systems evolve as independent modules:

\- communication-hub

\- quotes-center

\- marketing-ads

\- automation-center



Shared through:

\- Directus

\- API Gateway / MCP

\- Supabase realtime

