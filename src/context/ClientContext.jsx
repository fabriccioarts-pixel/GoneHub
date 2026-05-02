import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const { profile, isAdmin, isClient } = useAuth()
  const [clients, setClients] = useState([])
  const [activeClient, setActiveClient] = useState(null)
  const [importedData, setImportedData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    if (!supabase) {
      console.warn('Supabase não conectado. Preencha o .env com suas chaves.')
      setLoading(false)
      return
    }

    try {
      if (isClient && profile?.client_id) {
        // Cliente vê apenas o próprio registro
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', profile.client_id)
          .single()
        if (error) throw error
        if (data) { setClients([data]); setActiveClient(data) }
        return
      }

      // Admin vê todos os clientes
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error

      setClients(data)
      if (data.length > 0) setActiveClient(data[0])
    } catch (e) {
      console.error('Erro ao carregar clientes do banco:', e)
    } finally {
      setLoading(false)
    }
  }

  // Carrega dados quando activeClient muda (admin) ou quando o perfil do cliente é carregado
  useEffect(() => {
    if (!supabase) return
    if (isClient && profile?.client_id) {
      // Cliente sempre carrega APENAS os próprios dados
      loadClientData(profile.client_id)
    } else if (isAdmin && activeClient) {
      loadClientData(activeClient.id)
    }
  }, [activeClient, profile?.client_id])

  async function loadClientData(clientId) {
    // Segurança frontend: cliente só pode carregar os próprios dados
    if (isClient && profile?.client_id && clientId !== profile.client_id) {
      console.warn('Acesso negado: cliente tentou carregar dados de outro cliente.')
      return
    }
    try {
      const { data: reports, error } = await supabase
        .from('client_reports')
        .select('*')
        .eq('client_id', clientId)
      if (error) throw error

      const formattedData = {}
      const adsArray = []
      const igArray = []

      reports.forEach(r => {
        if (r.type.startsWith('ads_')) {
          adsArray.push({ ...r.data, _dbId: r.id, _dbType: r.type })
        } else if (r.type.startsWith('instagram_')) {
          igArray.push({ ...r.data, _dbId: r.id, _dbType: r.type })
        } else if (r.type === 'ads') {
          adsArray.push({ ...r.data, _dbId: r.id, _dbType: r.type })
        } else if (r.type === 'instagram') {
          igArray.push({ ...r.data, _dbId: r.id, _dbType: r.type })
        } else {
          formattedData[r.type] = { ...r.data, _dbId: r.id, _dbType: r.type }
        }
      })

      if (adsArray.length > 0) formattedData.ads = adsArray.sort((a, b) => (b._dbType > a._dbType ? 1 : -1))
      if (igArray.length > 0) formattedData.instagram = igArray.sort((a, b) => (b._dbType > a._dbType ? 1 : -1))

      setImportedData(prev => ({ ...prev, [clientId]: formattedData }))
    } catch (e) {
      console.error('Erro ao carregar relatórios do cliente:', e)
    }
  }

  async function addClient(clientData) {
    if (!supabase) return alert('Banco de dados não conectado. Verifique o .env')

    const newClientData = { ...clientData, color: randomColor() }
    const { data, error } = await supabase.from('clients').insert([newClientData]).select().single()

    if (error) { console.error('Erro ao criar cliente:', error); return null }

    setClients(prev => [...prev, data])
    if (!activeClient) setActiveClient(data)
    return data
  }

  async function updateClient(id, clientData) {
    if (!supabase) return
    const { error } = await supabase.from('clients').update(clientData).eq('id', id)
    if (!error) setClients(prev => prev.map(c => c.id === id ? { ...c, ...clientData } : c))
  }

  async function removeClient(id) {
    if (!supabase) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (!error) {
      setClients(prev => prev.filter(c => c.id !== id))
      if (activeClient?.id === id) {
        const remaining = clients.filter(c => c.id !== id)
        setActiveClient(remaining.length > 0 ? remaining[0] : null)
      }
    }
  }

  async function importClientData(clientId, data) {
    if (!supabase) return alert('Banco de dados não conectado. Verifique o .env')
    if (isClient && profile?.client_id && clientId !== profile.client_id) return

    let actualType = data.type
    let existing = null

    if (data.type === 'ads') {
      actualType = `ads_${Date.now()}`
    } else if (data.type === 'instagram') {
      const periodId = data.dateRange ? data.dateRange.replace(/[^a-zA-Z0-9-]/g, '_') : Date.now()
      actualType = `instagram_${periodId}`

      // Busca inteligente: tenta encontrar um relatório do mesmo mês/ano para mesclar
      const { data: allIg } = await supabase
        .from('client_reports')
        .select('id, data, type')
        .eq('client_id', clientId)
        .like('type', 'instagram_%')

      if (allIg && data.dateRange) {
        // Extrai mês/ano da nova data (ex: 2026-04)
        const newMonthMatch = data.dateRange.match(/(\d{4})-(\d{2})/)
        if (newMonthMatch) {
          const newMonthYear = `${newMonthMatch[1]}-${newMonthMatch[2]}`
          existing = allIg.find(r => r.data?.dateRange?.includes(newMonthYear))
          if (existing) actualType = existing.type
        }
      }
    } else if (data.type === 'content') {
      const contentId = data.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      actualType = `content_${contentId}`
    }

    if (!existing) {
      const { data: exact } = await supabase
        .from('client_reports')
        .select('id, data')
        .eq('client_id', clientId)
        .eq('type', actualType)
        .maybeSingle()
      existing = exact
    }

    if (existing) {
      if (data.type === 'instagram') {
        const mergedData = { ...existing.data }
        mergedData[data.metricType] = data
        // Mantém a maior dateRange possível
        if (data.dateRange && mergedData.dateRange) {
          const [newStart] = data.dateRange.split(' a ')
          const [oldStart] = mergedData.dateRange.split(' a ')
          if (newStart < oldStart) mergedData.dateRange = data.dateRange
        }
        await supabase.from('client_reports').update({ data: mergedData }).eq('id', existing.id)
      } else {
        await supabase.from('client_reports').update({ data }).eq('id', existing.id)
      }
    } else {
      if (data.type === 'instagram') {
        const initialData = { dateRange: data.dateRange }
        initialData[data.metricType] = data
        await supabase.from('client_reports').insert([{ client_id: clientId, type: actualType, data: initialData }])
      } else {
        await supabase.from('client_reports').insert([{ client_id: clientId, type: actualType, data }])
      }
    }

    // Recarrega os dados do banco para garantir que o state local formatado com o array de ads seja atualizado
    await loadClientData(clientId)
  }

  async function deleteClientData(clientId, typeOrDbType) {
    if (!supabase) return
    if (isClient && profile?.client_id && clientId !== profile.client_id) return

    let query = supabase.from('client_reports').delete().eq('client_id', clientId)
    
    // Se for deletar um ads ou instagram específico, usa o _dbType, senão apaga todos os type exato
    if (typeOrDbType.startsWith('ads_') || typeOrDbType.startsWith('instagram_')) {
      query = query.eq('type', typeOrDbType)
    } else if (typeOrDbType === 'ads' || typeOrDbType === 'instagram') {
      query = query.like('type', `${typeOrDbType}%`)
    } else {
      query = query.eq('type', typeOrDbType)
    }

    const { error } = await query
    
    if (!error) {
      await loadClientData(clientId)
    } else {
      console.error('Erro ao excluir dados:', error)
    }
  }

  function getClientData(clientId) {
    // Se for cliente, sempre retorna os próprios dados independente do clientId pedido
    const safeId = (isClient && profile?.client_id) ? profile.client_id : clientId
    return importedData[safeId] || {}
  }

  // Clientes não podem trocar de conta
  function selectClient(client) {
    if (!isAdmin) return
    setActiveClient(client)
  }

  return (
    <ClientContext.Provider value={{
      clients,
      activeClient,
      setActiveClient: selectClient,
      addClient,
      updateClient,
      removeClient,
      importClientData,
      deleteClientData,
      getClientData,
      loading,
    }}>
      {children}
    </ClientContext.Provider>
  )
}

export const useClients = () => useContext(ClientContext)

function randomColor() {
  const colors = ['#f97316', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
  return colors[Math.floor(Math.random() * colors.length)]
}
