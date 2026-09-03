import { directusAdminFetch } from './client'

export interface PushSubscriptionRow {
  id?: string
  agent_name?: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function savePushSubscription(row: Omit<PushSubscriptionRow, 'id'>): Promise<void> {
  // Verifica se já existe
  const existing = await directusAdminFetch<{ data: PushSubscriptionRow[] }>(
    `/items/push_subscriptions?filter[endpoint][_eq]=${encodeURIComponent(row.endpoint)}&limit=1`
  )
  if (existing?.data?.length > 0) return // já existe, não duplica
  await directusAdminFetch('/items/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const res = await directusAdminFetch<{ data: PushSubscriptionRow[] }>(
    `/items/push_subscriptions?filter[endpoint][_eq]=${encodeURIComponent(endpoint)}&limit=1`
  )
  const id = res?.data?.[0]?.id
  if (!id) return
  await directusAdminFetch(`/items/push_subscriptions/${id}`, { method: 'DELETE' })
}
