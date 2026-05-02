import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ClientProvider } from './context/ClientContext'
import { NotificationProvider } from './context/NotificationContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Sidebar from './components/layout/Sidebar'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AdsMonitor from './pages/AdsMonitor'
import InstagramGrowth from './pages/InstagramGrowth'
import ContentCalendar from './pages/ContentCalendar'
import Reports from './pages/Reports'
import Clients from './pages/Clients'
import Settings from './pages/Settings'

function AppLayout() {
  return (
    <ClientProvider>
      <NotificationProvider>
        <div className="flex min-h-screen bg-black">
        <Sidebar />
        <main className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ads" element={<AdsMonitor />} />
            <Route path="/instagram" element={<InstagramGrowth />} />
            <Route path="/calendario" element={<ContentCalendar />} />
            <Route path="/relatorios" element={<Reports />} />
            <Route path="/clientes" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<Settings />} />
          </Routes>
        </main>
      </div>
      </NotificationProvider>
    </ClientProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
