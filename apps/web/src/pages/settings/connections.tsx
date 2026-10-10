import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/language-provider'
import { api } from '@/lib/api'
import { SettingsSection } from './section'

export function SettingsConnectionsPage() {
  const { t } = useLanguage()
  const [params] = useSearchParams()
  const requestId = params.get('request')
  const [organizationId, setOrganizationId] = useState('')
  const client = useQueryClient()
  const connections = useQuery({ queryKey: ['connections'], queryFn: api.getConnections })
  const consent = useQuery({ queryKey: ['connection-request', requestId], queryFn: () => api.getConnectionRequest(requestId!), enabled: !!requestId, retry: false })
  const authorize = useMutation({ mutationFn: (allow: boolean) => api.authorizeConnection({ requestId: requestId!, organizationId, allow }), onSuccess: result => window.location.assign(result.redirect) })
  const revoke = useMutation({ mutationFn: api.revokeConnection, onSuccess: () => client.invalidateQueries({ queryKey: ['connections'] }) })
  const error = connections.error ?? consent.error ?? authorize.error ?? revoke.error
  return <SettingsSection title={t('connections.title')}>
    <Card>
      <CardHeader><CardTitle>{t('connections.title')}</CardTitle><CardDescription>{t('connections.description')}</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t('connections.step1')}</li>
          <li>{t('connections.step2')}</li>
          <li>{t('connections.step3')}</li>
        </ol>
        <p className="text-sm font-medium">{t('connections.urlLabel')}</p>
        {connections.data && <code className="block break-all rounded-md bg-muted p-3 text-sm">{connections.data.endpoint}</code>}
        <p className="text-sm text-muted-foreground">
          {t('connections.docsHint')}{' '}
          <a
            href="https://github.com/fabiooid/formulario/blob/main/docs/mcp.md"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            {t('connections.docsLink')}
          </a>
        </p>
        <p className="text-sm text-muted-foreground">{t('connections.boundary')}</p>
      </CardContent>
    </Card>
    {requestId && consent.data && <Card>
      <CardHeader><CardTitle>{t('connections.authorize', { name: consent.data.clientName })}</CardTitle><CardDescription>{t('connections.disclosure')}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <p className="break-all text-sm text-muted-foreground">{t('connections.redirect')}: {consent.data.redirectUri}</p>
        <label className="flex flex-col gap-2 text-sm">{t('connections.workspace')}
          <select className="rounded-md border bg-background p-2" value={organizationId} onChange={e => setOrganizationId(e.target.value)}>
            <option value="">{t('connections.choose')}</option>
            {connections.data?.organizations.filter(o => o.role !== 'viewer').map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <Button disabled={!organizationId || authorize.isPending} onClick={() => authorize.mutate(true)}>{t('connections.allow')}</Button>
          <Button variant="outline" disabled={authorize.isPending} onClick={() => authorize.mutate(false)}>{t('connections.deny')}</Button>
        </div>
      </CardContent>
    </Card>}
    {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    <Card>
      <CardHeader><CardTitle>{t('connections.active')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {connections.isLoading ? <p>{t('common.loading')}</p> : !connections.data?.grants.length ? <p className="text-sm text-muted-foreground">{t('connections.empty')}</p> : connections.data.grants.map(grant => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-medium">{grant.clientName}</p><p className="text-sm text-muted-foreground">{connections.data.organizations.find(o => o.id === grant.organizationId)?.name ?? grant.organizationId}</p></div>
          <Button variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(grant.id)}>{t('connections.revoke')}</Button>
        </div>)}
      </CardContent>
    </Card>
  </SettingsSection>
}
