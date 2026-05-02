import { useState } from 'react'
import { Bell, Upload } from 'lucide-react'
import { useClients } from '../../context/ClientContext'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import ImportCSV from '../ImportCSV'

export default function Header({ title }) {
  const { activeClient } = useClients()
  const { user, isAdmin } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [showImport, setShowImport] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : 'U'

  return (
    <>
      <header className="h-16 bg-black/80 backdrop-blur border-b border-[#1f1f1f] flex items-center justify-between px-6 sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight leading-tight">{title}</h1>
          {activeClient && (
            <p className="text-xs text-[#555555] mt-0.5">{activeClient.name} · {activeClient.ig_handle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition-all text-xs font-medium"
            >
              <Upload size={14} /> Importar CSV
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#888888] hover:text-white hover:bg-[#222222] transition-all relative"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              )}
            </button>
            
            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#0d0d0d]">
                  <h3 className="text-sm font-semibold text-white">Notificações</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-orange-400 hover:text-orange-300">Marcar lidas</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#555] text-center py-8">Nenhuma notificação.</p>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`px-4 py-3 border-b border-[#2a2a2a]/50 hover:bg-[#1a1a1a] transition-colors cursor-pointer ${!n.read ? 'bg-orange-500/5' : ''}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm ${!n.read ? 'text-white font-medium' : 'text-[#bbb]'}`}>{n.title}</p>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />}
                        </div>
                        {n.message && <p className="text-xs text-[#888] line-clamp-2">{n.message}</p>}
                        <p className="text-[10px] text-[#444] mt-1.5">
                          {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div
            title={user?.email}
            className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white text-sm font-bold cursor-default select-none"
          >
            {initials}
          </div>
        </div>
      </header>
      {showImport && <ImportCSV onClose={() => setShowImport(false)} />}
    </>
  )
}
