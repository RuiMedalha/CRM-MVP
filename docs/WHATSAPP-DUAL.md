# WhatsApp Dual Multi-Número (Evolution API + Meta Cloud API)

Guia completo de arquitetura, configuração de instâncias, webhooks e ciclo de vida de mensagens para o CRM HotelEquip.

---

## 1. Visão Geral da Arquitetura

O CRM dispõe de um subsistema de comunicação WhatsApp de camada dupla (Dual Adapter Pattern) que permite operar simultaneamente com:
1. **Evolution API (Baileys / Sessão WhatsApp Web):**
   - Ideal para números comerciais operacionais (ex: 918, 916).
   - Conexão simplificada por leitura de **QR Code** no telemóvel ou código de emparelhamento.
   - Suporte a grupos WhatsApp, envio de áudio PTT, imagens, documentos e mensagens estendidas.
2. **Meta Cloud API Oficial (WhatsApp Business API / WABA Graph v18.0):**
   - Ideal para canais institucionais e transacionais (ex: 913).
   - Autenticação direta com servidores da Meta via **Permanent System User Access Token**.
   - Suporte a templates aprovados, botões interativos e alta entregabilidade com verificação oficial.

Ambos os provedores são unificados através de uma interface comum (`WhatsAppAdapter`), gravando todas as mensagens normalizadas na coleção Directus `whatsapp_messages` e associando-as automaticamente aos clientes no módulo Customer 360 e Inbox.

```
                    ┌─────────────────────────────────────────┐
                    │          CRM Front-end / UI             │
                    │  (/definicoes/whatsapp & Inbox 360)     │
                    └────────────────────┬────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
               ┌──────────────────┐            ┌──────────────────┐
               │ EvolutionAdapter │            │  MetaCloudAdapter│
               └────────┬─────────┘            └────────┬─────────┘
                        │                               │
                        ▼                               ▼
               ┌──────────────────┐            ┌──────────────────┐
               │  Evolution API   │            │  Meta Graph API  │
               │  (QR Code/918)   │            │  (WABA v18.0/913)│
               └────────┬─────────┘            └────────┬─────────┘
                        │                               │
                        └───────────────┬───────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │      Directus / Backend Normalizado      │
                    │   - whatsapp_instances                  │
                    │   - whatsapp_messages (UNIQUE index)    │
                    └─────────────────────────────────────────┘
```

---

## 2. Modelagem Directus (Coleções e Permissões)

### 2.1. Coleção `whatsapp_instances`
Armazena as configurações e o estado de conexão de cada linha telefónica.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | String (PK) | Identificador único da instância (ex: `inst-evo-918`) |
| `tenant_id` | String (FK) | Identificador do tenant para isolamento multi-inquilino |
| `provider` | Enum (`evolution` \| `meta`) | Tipo de tecnologia do canal |
| `phone_number` | Text | Número com indicativo internacional (ex: `+351913866565`) |
| `display_name` | Text | Nome amigável exibido aos agentes |
| `instance_id` | Text (Nullable) | Identificador na Evolution API (ex: `hotelequip-918`) |
| `phone_number_id` | Text (Nullable) | Phone Number ID na Meta Cloud API (ex: `943101945557713`) |
| `access_token` | Text (Encrypted) | Token permanente da Meta ou API Key Evolution |
| `business_account_id` | Text (Nullable) | ID da WABA no Meta Business Manager |
| `webhook_url` | Text | URL onde a instância envia eventos de incoming |
| `status` | Enum (`connected` \| `disconnected` \| `qr_pending`) | Estado de conectividade |
| `last_seen_at` | DateTime | Carimbo de data/hora do último heartbeat |
| `enabled` | Boolean | Liga / desliga o roteamento para a linha |
| `date_created` / `date_updated` | DateTime | Auditoria temporal |

**Permissões:**
- `Administrator`: Leitura / Escrita total.
- `CRM Role` / Agentes: Leitura de instâncias ativas (`enabled = true`).

---

### 2.2. Coleção `whatsapp_messages`
Histórico e ledger imutável de todas as mensagens que transitam por qualquer número.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | String (PK) | ID interno da mensagem |
| `instance_id` | String (FK) | Relação Many-to-One com `whatsapp_instances` |
| `direction` | Enum (`inbound` \| `outbound`) | Sentido da comunicação |
| `from_number` | Text | Número emissor higienizado |
| `to_number` | Text | Número recetor higienizado |
| `body` | Text | Conteúdo textual da mensagem |
| `media_url` | Text (Nullable) | URL do ficheiro ou áudio anexo |
| `media_type` | Enum (Nullable) | `image`, `audio`, `video`, `document`, `location`, `contacts`, `sticker`, `template`, `interactive` |
| `whatsapp_id` | Text | WAMID ou id único do WhatsApp |
| `lead_id` | String/Int (FK Nullable) | Associação automática ao cliente no CRM |
| `conversation_id` | String/Int (FK Nullable) | Associação ao thread no Hub de Conversas |
| `status` | Enum | `sent`, `delivered`, `read`, `failed` |
| `timestamp` | DateTime | Data/hora do evento no WhatsApp |
| `raw_payload` | JSON | Payload integral recebido do webhook para auditoria |

**Índices:**
- `UNIQUE (instance_id, whatsapp_id)`: Previne duplicação de mensagens em retentativas de webhook.
- `INDEX (timestamp)`: Otimiza ordenação cronológica e timelines de conversação.
- `INDEX (lead_id)`: Otimiza carregamento do painel Customer 360.

---

## 3. Como Adicionar Números e Configurar Webhooks

### 3.1. Adicionar Linha Evolution API (Ex: HotelEquip 916 / 918)
1. No CRM, aceda a **Definições → WhatsApp Dual (Multi-Número)**.
2. Clique no botão **+ Adicionar Número**.
3. Selecione o provedor **Evolution API**.
4. Preencha os dados:
   - **Nome de Apresentação:** `HotelEquip Suporte (916)`
   - **Número de Telefone:** `+351916542271`
   - **Instance ID:** `hotelequip-916`
   - **Webhook URL:** `https://api.hotelequip.pt/webhook/evolution/hotelequip-916`
5. Clique em **Adicionar Instância**.
6. A janela do **QR Code** será exibida automaticamente:
   - Abra o WhatsApp no telemóvel da empresa.
   - Aceda a **Definições → Dispositivos Ligados → Associar um dispositivo**.
   - Aponte a câmara para o QR Code no ecrã.
   - Após a leitura, o badge mudará para <span style="color:green">**Conectado**</span>.

#### Configuração do Webhook no Servidor Evolution:
Se desejar configurar ou verificar o webhook via cURL:
```bash
curl -X POST "https://evolution.hotelequip.pt/webhook/set/hotelequip-916" \
  -H "apikey: SUA_EVOLUTION_APIKEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://api.hotelequip.pt/webhook/evolution/hotelequip-916",
    "webhookByEvents": false,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE",
      "QRCODE_UPDATED"
    ]
  }'
```

---

### 3.2. Adicionar Linha Meta Cloud API Oficial (Ex: HotelEquip 913 WABA)
1. No CRM, aceda a **Definições → WhatsApp Dual (Multi-Número)**.
2. Clique em **+ Adicionar Número**.
3. Selecione o provedor **Meta Cloud Oficial**.
4. Preencha os dados:
   - **Nome de Apresentação:** `HotelEquip Comercial (913 WABA)`
   - **Número de Telefone:** `+351913866565`
   - **Phone Number ID:** `943101945557713` (copiado do painel Meta)
   - **WhatsApp Business Account ID (WABA):** `109384920492819`
   - **Permanent System User Access Token:** Token com permissões `whatsapp_business_messaging`
   - **Webhook URL:** `https://api.hotelequip.pt/webhook/meta/wa913`
5. Clique em **Adicionar Instância**.
6. O sistema valida automaticamente o token e liga a linha.

#### Configuração do Webhook no Meta Developer Portal:
1. Aceda a [Meta for Developers](https://developers.facebook.com) → Selecione a sua App.
2. No menu lateral, aceda a **WhatsApp → Configuration**.
3. Em **Webhook**, clique em **Edit**:
   - **Callback URL:** `https://api.hotelequip.pt/webhook/meta/wa913`
   - **Verify Token:** `hotelequip_meta_verify_secret`
4. Clique em **Verify and save**.
5. Em **Webhook fields**, subscreva os campos:
   - `messages`
   - `message_deliveries`
   - `message_reads`

---

## 4. Testes de Envio e Verificação

Na página de gestão de números (`/definicoes/whatsapp`), cada card de instância dispõe do botão **Testar Envio**:
1. Clique em **Testar Envio**.
2. Introduza o número de telemóvel de destino (ex: o seu número pessoal com indicativo `+351...`).
3. O sistema despacha a mensagem via o adaptador apropriado e devolve o **WAMID** de confirmação.

---

## 5. UI Enhancements: MessageBadge

Cada mensagem exibida no chat de comunicações do CRM apresenta o selo de proveniência através do componente `<MessageBadge />`:
- Mensagens do 918/916: Identificadas com badge verde <span style="color:#059669">**via Evolution · 918**</span>.
- Mensagens do 913: Identificadas com badge azul <span style="color:#0284c7">**via Meta Cloud · 913**</span>.
- Ao passar o rato (hover), um tooltip detalhado apresenta o roteamento e a segurança do canal.
