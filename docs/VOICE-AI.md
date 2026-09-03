# Voice AI — Transcricao Automatica de Chamadas Telecof

## Visao Geral

O Voice AI processa automaticamente chamadas Telecof quando terminam.
Fluxo: Webhook Telecof -> download audio -> transcricao (Whisper) -> sumarizacao (LLM) -> persistencia em `ai_call_runs` -> activity ledger.

## Collections Directus

### ai_call_runs (NOVA)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | integer (PK) | Auto-increment |
| call_id | integer (FK) | Referencia Historico_Chamadas.id |
| status | enum | pending / processing / done / failed |
| provider | enum | openai_whisper / deepgram / claude / openai_gpt |
| model | text | Modelo usado (ex: whisper-1, gpt-4o, nova-2) |
| transcript | longtext | Transcricao completa |
| summary | longtext | Resumo executivo (2-3 frases) |
| sentiment | enum | positive / neutral / negative / unknown |
| next_action | text | Passo seguinte sugerido |
| key_topics | JSON | Array de topicos-chave |
| tokens_used | integer | Tokens consumidos |
| cost_estimate | decimal | Custo estimado (USD) |
| latency_ms | integer | Tempo de processamento |
| raw_response | JSON | Resposta crua da API |
| error_message | text | Mensagem de erro se falhou |
| date_created / date_updated | timestamp | Auto |

### Historico_Chamadas (ALTERADA)

| Novo Campo | Tipo | Descricao |
|------------|------|-----------|
| audio_url | text nullable | URL do audio gravado |
| duration_seconds | integer nullable | Duracao em segundos |
| transcription_status | enum | pending / processing / done / failed |

## Setup dos Providers

### OpenAI Whisper (default)

- **API Key**: OPENAI_API_KEY (env) ou configurada em ai_providers no Directus
- **Modelo**: whisper-1
- **Custo**: $0.006 / minuto de audio
- **Formato suportado**: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm

### Deepgram (fallback)

- **API Key**: VITE_DEEPGRAM_API_KEY (env)
- **Modelo**: nova-2 (recomendado) ou nova-2-med
- **Custo**: $0.0059 / minuto (nova-2), $0.0043 / minuto (nova-2-med)
- **Suporta**: smart_format, punctuate, diarization

### LLM para Summarize (Claude / GPT)

- Usa o AI Router ja existente (Card 13)
- Providers: OpenAI GPT (openai_gpt) ou Claude (claude)
- Configuracao via /definicoes/ia-providers no CRM

## Endpoints

### Webhook Telecof (Directus Extension)

POST /telecof-call-ended

Payload:
```json
{
  "call_id": 123,
  "contact_id": 456,
  "audio_url": "https://.../gravacao.wav",
  "duration_seconds": 180,
  "phone": "+351...",
  "direction": "inbound",
  "start_time": "2026-09-03T10:00:00Z",
  "end_time": "2026-09-03T10:03:00Z",
  "agent_name": "Maria"
}
```

Resposta:
```json
{
  "success": true,
  "aiRunId": 1,
  "status": "pending",
  "message": "Chamada enfileirada para processamento Voice AI"
}
```

### REST API (Frontend)

| Rota | Descricao |
|------|-----------|
| GET /items/ai_call_runs | Lista todas as analises |
| GET /items/ai_call_runs?filter[call_id][_eq]=X | Por chamada |
| GET /items/ai_call_runs?filter[sentiment][_eq]=negative | Por sentimento |

## Frontend

### Pagina /calls-ai

Lista de todas as chamadas analisadas com:
- Sentiment badge (positivo/neutro/negativo)
- Resumo, custo, latencia
- Expansao para ver transcricao

### Customer 360 Card

No separador "Geral", aparece o card **Ultima Chamada** com:
- Duracao, provider, custo
- Sentiment badge
- Resumo executivo
- Proximo passo
- Transcricao expansivel

### Mobile

Componente CallCardCompact resume a info essencial:
- Badge de sentimento
- Resumo (2 linhas)
- Next action
- Transcript em details toggle

## Commits Esperados

1. feat(voice): schema ai_call_runs + migration SQL
2. feat(voice): transcribe + summarize + pipeline services
3. feat(voice): webhook endpoint Directus
4. feat(voice): UI - CallsAI page + CallCard component
5. feat(voice): docs/VOICE-AI.md

## Teste Rapido (Mock)

```typescript
import { mockPipelineRun } from "@/services/voice/pipeline";
await mockPipelineRun(999, 123);
```
