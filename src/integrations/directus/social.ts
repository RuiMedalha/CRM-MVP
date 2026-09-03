import { directusAdminFetch } from './client'

export type SocialProvider = 'instagram' | 'facebook' | 'linkedin'
export type SocialPostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export interface SocialAccount {
  id: string
  provider: SocialProvider
  account_name: string
  account_id: string
  access_token?: string
  token_expires_at?: string
  is_active: boolean
  date_created?: string
}

export interface SocialPost {
  id: string
  account_id: string
  caption: string
  hashtags?: string
  media_url?: string
  scheduled_for?: string
  published_at?: string
  status: SocialPostStatus
  provider_post_id?: string
  error_message?: string
  date_created?: string
}

export function socialOAuthStartUrl(provider: SocialProvider): string {
  const base = import.meta.env.VITE_SOCIAL_OAUTH_BASE || ''
  return `${base}/oauth/${provider}/start`
}

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  try {
    const data = await directusAdminFetch<{ data: SocialAccount[] }>(
      '/items/social_accounts?sort=-date_created&limit=50'
    )
    return data?.data ?? []
  } catch {
    return []
  }
}

export async function listSocialPosts(): Promise<SocialPost[]> {
  try {
    const data = await directusAdminFetch<{ data: SocialPost[] }>(
      '/items/social_posts?sort=-date_created&limit=100'
    )
    return data?.data ?? []
  } catch {
    return []
  }
}

export async function createSocialPost(
  input: Pick<SocialPost, 'account_id' | 'caption' | 'hashtags' | 'media_url' | 'scheduled_for'>
): Promise<SocialPost> {
  const data = await directusAdminFetch<{ data: SocialPost }>('/items/social_posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, status: 'draft' }),
  })
  return data?.data as SocialPost
}

export async function deleteSocialPost(id: string): Promise<void> {
  await directusAdminFetch(`/items/social_posts/${id}`, { method: 'DELETE' })
}
