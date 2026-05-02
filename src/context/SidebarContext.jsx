import { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SidebarContext = createContext()

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const toggle = () => setIsOpen(!isOpen)
  const close = () => setIsOpen(false)

  // Fecha a barra lateral ao mudar de rota (mobile)
  useEffect(() => {
    close()
  }, [location.pathname])

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
