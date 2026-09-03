import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Share2, Plus, Instagram, Facebook, Linkedin, Clock, CheckCircle2, XCircle, FileText, Trash2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  listSocialAccounts, listSocialPosts, createSocialPost, deleteSocialPost,
  socialOAuthStartUrl, type SocialAccount, type SocialPost, type SocialProvider
} from '@/integrations/directus/social'

const PROVIDER_ICON: Record<SocialProvider, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
}

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft:     { label: 'Rascunho',   variant: 'secondary' },
  scheduled: { label: 'Agendado',   variant: 'default' },
  published: { label: 'Publicado',  variant: 'default' },
  failed:    { label: 'Falhou',     variant: 'destructive' },
}

export default function Social() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [accountId, setAccountId] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')

  useEffect(() => {
    Promise.all([listSocialAccounts(), listSocialPosts()])
      .then(([accs, ps]) => { setAccounts(accs); setPosts(ps) })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!accountId || !caption.trim()) return
    setSaving(true)
    try {
      const post = await createSocialPost({
        account_id: accountId,
        caption: caption.trim(),
        hashtags: hashtags.trim() || undefined,
        media_url: mediaUrl.trim() || undefined,
        scheduled_for: scheduledFor || undefined,
      })
      setPosts((p) => [post, ...p])
      setCaption(''); setHashtags(''); setMediaUrl(''); setScheduledFor(''); setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteSocialPost(id)
    setPosts((p) => p.filter((x) => x.id !== id))
  }

  const activeAccounts = accounts.filter((a) => a.is_active)

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Redes Sociais</h1>
            <p className="text-sm text-muted-foreground">Gere e agenda publicações nas redes sociais</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} disabled={activeAccounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Nova publicação
          </Button>
        </div>

        {/* Contas ligadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contas ligadas</CardTitle>
            <CardDescription>Liga as tuas contas de redes sociais para publicar directamente do CRM</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(['instagram', 'facebook', 'linkedin'] as SocialProvider[]).map((provider) => {
              const acc = accounts.find((a) => a.provider === provider && a.is_active)
              const Icon = PROVIDER_ICON[provider]
              return (
                <div key={provider} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{PROVIDER_LABEL[provider]}</span>
                  {acc ? (
                    <Badge variant="default" className="ml-1 bg-green-600 text-xs">{acc.account_name}</Badge>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-1 h-auto p-0 text-xs"
                      onClick={() => window.open(socialOAuthStartUrl(provider), '_blank')}
                    >
                      Ligar
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Formulário nova publicação */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova publicação</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolhe uma conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((a) => {
                      const Icon = PROVIDER_ICON[a.provider]
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {a.account_name} ({PROVIDER_LABEL[a.provider]})
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Legenda</Label>
                <Textarea
                  placeholder="Escreve a legenda da publicação..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hashtags</Label>
                <Input
                  placeholder="#hotelequip #horeca #equipamentos"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>URL da imagem/vídeo</Label>
                <Input
                  placeholder="https://..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Agendar para (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={saving || !accountId || !caption.trim()}>
                  {saving ? 'A guardar...' : 'Guardar rascunho'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de posts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publicações</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">A carregar...</p>}
            {!loading && posts.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Share2 className="h-8 w-8 opacity-30" />
                <p className="text-sm">Ainda não há publicações</p>
              </div>
            )}
            <div className="divide-y divide-border">
              {posts.map((post) => {
                const account = accounts.find((a) => a.id === post.account_id)
                const Icon = account ? PROVIDER_ICON[account.provider] : FileText
                const statusInfo = STATUS_BADGE[post.status] ?? { label: post.status, variant: 'secondary' as const }
                return (
                  <div key={post.id} className="flex items-start gap-3 py-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{post.caption}</p>
                      {post.hashtags && (
                        <p className="truncate text-xs text-muted-foreground">{post.hashtags}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                        {post.scheduled_for && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(post.scheduled_for).toLocaleString('pt-PT')}
                          </span>
                        )}
                        {post.published_at && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {new Date(post.published_at).toLocaleString('pt-PT')}
                          </span>
                        )}
                        {post.error_message && (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <XCircle className="h-3 w-3" />
                            {post.error_message}
                          </span>
                        )}
                      </div>
                    </div>
                    {post.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
