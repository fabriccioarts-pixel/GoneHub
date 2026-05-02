import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useClients } from './ClientContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { profile, isAdmin, isClient } = useAuth()
  const { activeClient } = useClients()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!supabase || !profile) return

    const role = isAdmin ? 'admin' : 'client'
    // Se for admin, pega todas as do admin. Se for cliente, pega as do seu client_id
    let query = supabase.from('notifications').select('*').eq('target_role', role).order('created_at', { ascending: false }).limit(20)

    if (isClient && profile.client_id) {
      query = query.eq('client_id', profile.client_id)
    }

    // Carrega inicial
    query.then(({ data, error }) => {
      if (!error && data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read).length)
      }
    })

    // Listen to realtime changes se possível (opcional, pode depender da configuração de RLS no supabase)
    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const newNotif = payload.new
        if (newNotif.target_role === role) {
          if (isAdmin || (isClient && newNotif.client_id === profile.client_id)) {
            setNotifications(prev => [newNotif, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, isAdmin, isClient])

  async function markAsRead(id) {
    if (!supabase) return
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  async function markAllAsRead() {
    if (!supabase) return
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    
    // Atualiza todas as não lidas do usuário
    const role = isAdmin ? 'admin' : 'client'
    let query = supabase.from('notifications').update({ read: true }).eq('target_role', role).eq('read', false)
    if (isClient && profile.client_id) {
      query = query.eq('client_id', profile.client_id)
    }
    await query
  }

  async function sendNotification(clientId, targetRole, title, message) {
    if (!supabase) return
    await supabase.from('notifications').insert([{
      client_id: clientId,
      target_role: targetRole,
      title,
      message,
      read: false
    }])
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      sendNotification
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
