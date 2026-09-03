import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getPushState, enablePush, disablePush, isPushSupported, type PushState } from '@/lib/push'

export function PushNotificationsCard() {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPushState().then(setState)
  }, [])

  async function handleEnable() {
    setWorking(true); setError(null)
    const result = await enablePush()
    if (result.ok) setState('subscribed')
    else setError(result.error || 'Erro')
    setWorking(false)
  }

  async function handleDisable() {
    setWorking(true)
    await disablePush()
    setState('default')
    setWorking(false)
  }

  if (!isPushSupported() && state !== 'loading') return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Recebe alertas no browser quando chegam novos contactos ou mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        {state === 'loading' && <span className="text-sm text-muted-foreground">A verificar...</span>}
        {state === 'unsupported' && <Badge variant="secondary">Não suportado</Badge>}
        {state === 'denied' && (
          <span className="text-sm text-destructive">
            Permissão bloqueada — desbloqueia nas definições do browser
          </span>
        )}
        {state === 'subscribed' && (
          <>
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-green-500" />
              <Badge variant="default" className="bg-green-600">Activas</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisable} disabled={working}>
              <BellOff className="mr-2 h-3.5 w-3.5" />
              Desativar
            </Button>
          </>
        )}
        {state === 'default' && (
          <>
            {error && <span className="text-sm text-destructive">{error}</span>}
            <Button size="sm" onClick={handleEnable} disabled={working}>
              <Bell className="mr-2 h-3.5 w-3.5" />
              {working ? 'A ativar...' : 'Ativar notificações'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
