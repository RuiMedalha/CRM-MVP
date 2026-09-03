export interface DirectusConversationRow {
  id: string
  contact_id: string | null
  channel: string
  status: string
  mode?: string | null
  source?: string | null
  visitor_id?: string | null
  ai_enabled: boolean
  assigned_to: string | null
  customer_name: string
  last_message: string | null
  last_message_content_type?: string | null
  notes?: string | null
  unread_count: number
  created_at: string
  updated_at: string
  last_activity_at?: string | null
  tag_ids?: unknown
  instance_name?: string | null
}

export interface DirectusMessageRow {
  id: string
  conversation_id: string
  sender_type: string
  sender_name: string | null
  content: string
  content_type?: string | null
  attachments: unknown
  delivery_status?: string | null
  external_message_id?: string | null
  message_date?: string | null
  raw_payload?: unknown
  created_at: string
  quoted_message_id?: string | null
  quoted_thumbnail_url?: string | null
  quoted_preview_text?: string | null
  quoted_sender_name?: string | null
}
