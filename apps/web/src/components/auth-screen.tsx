import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PreferenceControls } from '@/components/preference-controls'
import { AppBrandMark } from '@/components/app-brand-mark'
import { useLanguage } from '@/i18n/language-provider'

export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  const { t } = useLanguage()

  return (
    <div className="app-grid relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <AppBrandMark />
          <span className="text-sm font-semibold tracking-normal">{t('appName')}</span>
        </div>
        <PreferenceControls />
      </header>

      <div className="flex flex-1 items-center justify-center p-4 pb-16">
        <Card className="w-full max-w-[400px]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
