# Social — Workflows n8n

## WF1 — OAuth Start
Trigger: Webhook GET /oauth/{provider}/start
→ Redireciona para Meta authorization URL com scopes:
  instagram_basic, instagram_content_publish, pages_manage_posts, pages_read_engagement

## WF2 — OAuth Callback
Trigger: Webhook GET /oauth/callback
→ Troca code por access_token via Meta Graph API
→ Cria/actualiza registo em social_accounts no Directus

## WF3 — Publicar post agendado
Trigger: Schedule — cada 5 minutos
→ Busca social_posts com status=scheduled e scheduled_for <= now()
→ Para Instagram: POST /{ig-user-id}/media + /{ig-user-id}/media_publish
→ Para Facebook: POST /{page-id}/feed
→ Actualiza status=published e published_at no Directus

## WF4 — Publicar post imediato
Trigger: Webhook POST /social/publish/{post_id}
→ Mesmo fluxo do WF3 mas para um post específico
→ Útil para o botão "Publicar agora" no CRM
