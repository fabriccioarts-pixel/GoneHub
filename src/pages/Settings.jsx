import { useState } from 'react'
import { Bell, Palette, Shield, Download, Check } from 'lucide-react'
import Header from '../components/layout/Header'

export default function Settings() {
  const [notifications, setNotifications] = useState({
    campaignPaused: true,
    weeklyReport: false,
    engagementDrop: true,
  })
  const [theme, setTheme] = useState('Escuro')
  const [exportDone, setExportDone] = useState(false)

  function toggleNotification(key) {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: { notifications, theme },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gone-hub-configuracoes.json'
    a.click()
    URL.revokeObjectURL(url)
    setExportDone(true)
    setTimeout(() => setExportDone(false), 2500)
  }

  return (
    <div>
      <Header title="Configurações" />
      <div className="p-6 space-y-5 max-w-2xl">

        {/* Notificações */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bell size={16} className="text-orange-400" />
            Notificações
          </h2>
          <div className="space-y-4">
            {[
              { key: 'campaignPaused', label: 'Alertas de campanha pausada' },
              { key: 'weeklyReport', label: 'Relatório semanal automático' },
              { key: 'engagementDrop', label: 'Notificação de queda de engajamento' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-sm text-[#cccccc]">{label}</p>
                <button
                  onClick={() => toggleNotification(key)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${notifications[key] ? 'bg-orange-500' : 'bg-[#2a2a2a]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${notifications[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Aparência */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Palette size={16} className="text-orange-400" />
            Aparência
          </h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#cccccc]">Tema</p>
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              className="bg-[#222222] border border-[#333333] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-400 cursor-pointer"
            >
              {['Escuro', 'Claro', 'Sistema'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Segurança */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield size={16} className="text-orange-400" />
            Segurança
          </h2>
          <div className="flex items-start justify-between gap-6">
            <p className="text-sm text-[#cccccc]">Tokens de acesso</p>
            <span className="text-xs text-[#555555] text-right">Os tokens Meta não são enviados a nenhum servidor externo.</span>
          </div>
        </div>

        {/* Dados */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Download size={16} className="text-orange-400" />
            Dados
          </h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#cccccc]">Exportar configurações</p>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#222222] hover:bg-[#2a2a2a] text-[#cccccc] rounded-lg transition-all"
            >
              {exportDone
                ? <><Check size={12} className="text-emerald-400" /> Exportado!</>
                : <><Download size={12} /> Exportar JSON</>}
            </button>
          </div>
        </div>

        <div className="text-xs text-[#444444] text-center">Gone Hub v1.0.0 · Feito para gestores de tráfego</div>
      </div>
    </div>
  )
}
