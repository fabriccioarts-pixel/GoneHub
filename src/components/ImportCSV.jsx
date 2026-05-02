import { useState, useRef } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { detectAndParse } from '../lib/csvParser'
import { useClients } from '../context/ClientContext'

export default function ImportCSV({ onClose }) {
  const { activeClient, importClientData } = useClients()
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  async function processFiles(files) {
    if (!files || files.length === 0) return

    setStatus('loading')
    let successCount = 0
    let errors = []

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: arquivo muito grande (máx. 10MB). Tamanho atual: ${(file.size / 1024 / 1024).toFixed(1)}MB`)
        continue
      }
      try {
        let data
        if (file.name.endsWith('.csv')) {
          const buffer = await file.arrayBuffer()
          const view = new Uint8Array(buffer)
          let text
          if (view.length >= 2 && view[0] === 0xFF && view[1] === 0xFE) {
            text = new TextDecoder('utf-16le').decode(view)
          } else {
            text = new TextDecoder('utf-8').decode(view)
            // Detecta Windows-1252 mal-interpretado como UTF-8 (padrão comum em exports do Meta Ads Brasil)
            // "Impressões" → "ImpressÃµes", "ção" → "Ã§Ã£o", "ã" → "Ã£"
            if (/Ã[£§³¡¢¤¥¦¨©ª«¬®¯°±²µ¶·¸¹º»¼½¾¿]/.test(text) || text.includes('Ã£') || text.includes('Ã§')) {
              text = new TextDecoder('windows-1252').decode(view)
            }
          }
          data = detectAndParse(text)
        } else if (file.name.endsWith('.md')) {
          const text = await file.text()
          data = {
            type: 'content',
            name: file.name,
            content: text,
            date: new Date().toISOString().split('T')[0]
          }
        } else {
          continue
        }

        await importClientData(activeClient.id, data)
        successCount++
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`)
      }
    }

    if (errors.length > 0 && successCount === 0) {
      setStatus('error')
      setMessage(errors.join('\n'))
    } else {
      setStatus('success')
      setMessage(`${successCount} arquivo(s) importado(s) com sucesso.${errors.length > 0 ? `\nErros: ${errors.length}` : ''}`)
    }
  }

  function onFileChange(e) {
    processFiles(e.target.files)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-white">Importar CSV</h3>
            <p className="text-xs text-[#555555] mt-0.5">Cliente: {activeClient?.name}</p>
          </div>
          <button onClick={onClose} className="text-[#555555] hover:text-white"><X size={18} /></button>
        </div>

        {status !== 'success' && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              dragOver ? 'border-orange-400 bg-orange-500/10' : 'border-[#2a2a2a] hover:border-[#444444] hover:bg-[#1a1a1a]/50'
            }`}
          >
            <Upload size={28} className="text-[#555555]" />
            <div className="text-center">
              <p className="text-sm text-[#cccccc]">Arraste os arquivos aqui ou clique para selecionar</p>
              <p className="text-xs text-[#555555] mt-1">Meta Ads · Instagram · Conteúdo (.md)</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv,.md" multiple className="hidden" onChange={onFileChange} />
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center justify-center py-6 gap-3 text-[#888888]">
            <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Processando...</span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle size={40} className="text-emerald-400" />
            <p className="text-sm text-[#cccccc] text-center">{message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setStatus('idle'); setMessage('') }}
                className="flex-1 py-2 text-sm text-[#888888] bg-[#1a1a1a] hover:bg-[#222222] rounded-lg transition-all">
                Importar outro
              </button>
              <button onClick={onClose}
                className="flex-1 py-2 text-sm text-white bg-orange-500 hover:bg-orange-400 rounded-lg transition-all">
                Concluir
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{message}</p>
          </div>
        )}

        {status === 'idle' && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-[#555555] font-medium">Como exportar:</p>
            <div className="space-y-1.5">
              {[
                { icon: FileText, label: 'Meta Ads Manager', desc: 'Relatórios → Exportar → CSV' },
                { icon: FileText, label: 'Instagram (Business Suite)', desc: 'Insights → Exportar dados → CSV' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-2.5 px-3 py-2 bg-[#1a1a1a]/50 rounded-lg">
                  <Icon size={14} className="text-orange-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[#cccccc]">{label}</p>
                    <p className="text-xs text-[#555555]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
