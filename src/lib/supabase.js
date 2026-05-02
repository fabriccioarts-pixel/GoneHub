import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Exporta o cliente se as chaves existirem, senão exporta um proxy seguro para evitar crash
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'auth') return new Proxy({}, {
          get: (t, p) => {
            if (p === 'onAuthStateChange') return () => ({ data: { subscription: { unsubscribe: () => {} } } })
            return async () => ({ data: { session: null }, error: { message: 'Supabase não configurado no Vercel' } })
          }
        })
        if (prop === 'from') return () => ({
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'Configuração pendente' } }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'Configuração pendente' } }) }) }),
          update: () => ({ eq: async () => ({ error: { message: 'Configuração pendente' } }) }),
          delete: () => ({ eq: async () => ({ error: { message: 'Configuração pendente' } }) })
        })
        return () => ({ error: { message: 'Supabase não configurado' } })
      }
    })
