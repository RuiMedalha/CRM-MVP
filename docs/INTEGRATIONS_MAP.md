\# Hotelequip CRM - Integrations Map



\## Estado atual do frontend



\### Páginas existentes

\- Dashboard

\- Dashboard360 / Card 360

\- Contactos

\- ContactosDirectus

\- Leads360

\- Newsletter

\- Newsletter360

\- Pipeline

\- Orcamentos

\- Agenda

\- Fornecedores

\- Integrações

\- Definições

\- Utilizadores

\- MenuMobile



\### Hooks existentes

\- useContacts

\- useDeals

\- useEmployees

\- useFollowUps

\- useInteractions

\- useLeadListener360

\- useManufacturers

\- useMeilisearch

\- useQuotations

\- useSettings



\### Integrações Directus existentes

\- auth

\- client

\- contacts

\- deals

\- employees

\- follow-ups

\- interactions

\- leads

\- manufacturers

\- newsletter-identity-map

\- newsletter-subscriptions

\- quotations

\- settings

\- utils



\---



\## Directus client



O cliente Directus já suporta:

\- URL por variável `VITE\_DIRECTUS\_URL`

\- inferência automática de `api.hotelequip.pt` quando o CRM corre em domínio Hotelequip

\- login por sessão

\- access token em localStorage

\- refresh token

\- fallback token via `VITE\_DIRECTUS\_TOKEN`

\- limpeza automática de sessão se refresh falhar



\---



\## Coleções já aparentes



\- contacts

\- leads

\- deals

\- follow\_ups

\- interactions

\- quotations

\- manufacturers

\- employees

\- settings

\- newsletter\_subscriptions

\- newsletter\_identity\_map



\---



\## Lacunas para a plataforma omnichannel



Criar ou validar no Directus:



\### Communication Hub

\- conversations

\- messages

\- conversation\_channels

\- conversation\_assignments

\- message\_attachments

\- agent\_presence

\- inbox\_queues



\### Telefonia

\- call\_logs

\- call\_recordings

\- call\_transcripts

\- call\_summaries



\### WhatsApp oficial

\- whatsapp\_accounts

\- whatsapp\_templates

\- whatsapp\_webhook\_events



\### Orçamentos / Moloni

\- moloni\_documents

\- moloni\_customers

\- quote\_pdf\_files

\- quotation\_events



\### Marketing / Ads

\- marketing\_campaigns

\- ad\_accounts

\- ad\_campaign\_stats

\- lead\_sources

\- attribution\_events



\### IA

\- ai\_suggestions

\- ai\_conversation\_summaries

\- ai\_followup\_recommendations



\---



\## Estratégia



Não duplicar funcionalidades existentes.



Aproveitar:

\- contacts

\- leads

\- interactions

\- quotations

\- follow\_ups

\- deals

\- settings



Adicionar apenas as coleções necessárias para:

\- Inbox omnichannel

\- WhatsApp oficial

\- chamadas

\- anexos

\- ads

\- IA assistida

