# Social — Schema Directus

## social_accounts
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| provider | string | instagram / facebook / linkedin |
| account_name | string | Nome da página/perfil |
| account_id | string | ID da Meta |
| access_token | text | Token OAuth (encriptado) |
| token_expires_at | timestamp | |
| is_active | boolean | |
| date_created | timestamp | |

## social_posts
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| account_id | string | FK → social_accounts |
| caption | text | Legenda |
| hashtags | string | |
| media_url | string | URL pública da imagem/vídeo |
| scheduled_for | timestamp | Null = publicar já |
| published_at | timestamp | Preenchido pelo n8n |
| status | string | draft/scheduled/published/failed |
| provider_post_id | string | ID do post na rede social |
| error_message | text | Preenchido em caso de falha |
| date_created | timestamp | |
