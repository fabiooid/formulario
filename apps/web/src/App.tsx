import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AgentProvider } from '@/components/agent-provider'
import { AuthProvider, useAuth } from '@/lib/auth'
import { HomePage } from '@/pages/home'
import { IngredientsPage } from '@/pages/ingredients'
import { LoginPage } from '@/pages/login'
import { ProductWorkspacePage } from '@/pages/product-workspace'
import { ProductsPage } from '@/pages/products'
import { RegisterPage } from '@/pages/register'
import { SettingsConnectionsPage } from '@/pages/settings/connections'
import { SettingsAccountPage } from '@/pages/settings/account'
import { SettingsAppearancePage } from '@/pages/settings/appearance'
import { SettingsLanguagePage } from '@/pages/settings/language'
import { SettingsOrganizationPage } from '@/pages/settings/organization'
import { SettingsPlanPage } from '@/pages/settings/plan'

const queryClient = new QueryClient()

/**
 * Signed-in area. While a stored session is still being checked we render nothing,
 * so a hard refresh on a deep link (a product, Settings…) does not bounce through /login.
 * If there is no session, remember where the person wanted to go and send them to sign in.
 */
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AgentProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
                <Route path="/settings/connections" element={<SettingsConnectionsPage />} />
                <Route path="/settings/account" element={<SettingsAccountPage />} />
                <Route path="/settings/appearance" element={<SettingsAppearancePage />} />
                <Route path="/settings/language" element={<SettingsLanguagePage />} />
                <Route path="/settings/plan" element={<SettingsPlanPage />} />
                <Route path="/settings/organization" element={<SettingsOrganizationPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/:id" element={<ProductWorkspacePage />} />
                <Route path="/ingredients" element={<IngredientsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AgentProvider>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
