import { useState, createContext, useContext, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface ToasterContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToasterContext = createContext<ToasterContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToasterContext)
}

const ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const COLORS: Record<Toast['type'], string> = {
  success: 'bg-green-50 border-green-300 text-green-800',
  error:   'bg-red-50 border-red-300 text-red-800',
  info:    'bg-blue-50 border-blue-300 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
}

const ICON_COLORS: Record<Toast['type'], string> = {
  success: 'bg-green-500 text-white',
  error:   'bg-red-500 text-white',
  info:    'bg-blue-500 text-white',
  warning: 'bg-yellow-400 text-white',
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToasterContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
              pointer-events-auto animate-slide-in min-w-[280px] max-w-sm ${COLORS[t.type]}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${ICON_COLORS[t.type]}`}>
              {ICONS[t.type]}
            </span>
            <span className="text-sm flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-current opacity-50 hover:opacity-100 text-lg leading-none">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  )
}
