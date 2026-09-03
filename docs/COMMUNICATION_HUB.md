\# Communication Hub - Technical Plan



\## Objetivo



Criar um Inbox Omnichannel interno integrado ao CRM Hotelequip.



Substituir dependência excessiva de ferramentas externas e centralizar:

\- chat do site

\- WhatsApp

\- Instagram

\- Facebook

\- email

\- chamadas



\---



\# Estratégia



O CRM atual continua como core.



O Communication Hub será:

\- módulo independente

\- integrado no CRM

\- baseado em Directus

\- realtime

\- preparado para PWA/mobile



\---



\# Canais previstos



\## Fase 1

\- Ask Me (site chat)

\- WhatsApp oficial



\## Fase 2

\- Instagram

\- Facebook Messenger

\- email inbound



\## Fase 3

\- telefonia/call center

\- gravações

\- transcrição IA



\---



\# Fluxo principal



Cliente envia mensagem

↓

mensagem entra no CRM

↓

IA responde automaticamente

↓

se necessário:

\- humano assume

\- IA pausa

↓

tudo fica guardado no cliente



\---



\# Estrutura prevista Directus



\## conversations

\- id

\- contact\_id

\- channel

\- status

\- assigned\_to

\- ai\_enabled

\- created\_at

\- updated\_at



\## messages

\- id

\- conversation\_id

\- sender\_type

\- sender\_id

\- message

\- attachments

\- message\_type

\- created\_at



\## conversation\_channels

\- whatsapp

\- askme

\- instagram

\- facebook

\- email



\## agent\_presence

\- online

\- busy

\- away



\## inbox\_queues

\- comercial

\- suporte

\- pós-venda



\---



\# IA



\## Ask Me

A IA responderá:

\- FAQs

\- produtos

\- estado encomendas

\- suporte básico



\## Handoff

Quando:

\- cliente pedir humano

\- IA não souber

\- trigger comercial



então:

\- agente assume conversa

\- IA pausa

\- histórico mantém-se



\---



\# Integrações



\## Directus

Source of truth



\## n8n

Automação e webhooks



\## WhatsApp Official API

Mensagens oficiais



\## Chatwoot

Inicialmente pode funcionar como bridge/fallback



\## Meilisearch

Pesquisa contextual



\## WooCommerce

Produtos/encomendas



\## Moloni

Orçamentos/PDF



\---



\# Realtime



Usar:

\- Supabase realtime OU

\- websockets próprios



Avaliar durante implementação.



\---



\# Mobile



Preparar:

\- responsive

\- PWA

\- Expo mobile app futura



\---



\# Estratégia SaaS futura



Preparar multiempresa:

\- tenant\_id

\- permissions

\- modular billing

