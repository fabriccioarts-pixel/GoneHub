import { useState, useRef } from 'react'
import { Plus, Edit2, Trash2, X, Check, Users, KeyRound, Mail, Lock, Eye, EyeOff, ShieldCheck,
  Upload, FileText, BarChart2, Camera, RefreshCw, FolderOpen, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import Header from '../components/layout/Header'
import { useClients } from '../context/ClientContext'
import { supabase } from '../lib/supabase'
import { detectAndParse } from '../lib/csvParser'

const EMPTY = { name: '', ig_handle: '', meta_account_id: '', meta_token: '', color: '#f97316', contract_value: '', contract_type: '', contract_duration: '' }
const COLORS = ['#f97316', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function Clients() {
  const { clients, addClient, updateClient, removeClient, setActiveClient, getClientData, importClientData, deleteClientData } = useClients()

  // Modal: criar/editar cliente
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  // Modal: criar acesso de login
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessClient, setAccessClient] = useState(null)
  const [accessForm, setAccessForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [showAccessPassword, setShowAccessPassword] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [accessSuccess, setAccessSuccess] = useState('')

  // Gerenciador de arquivos
  const [expandedClient, setExpandedClient] = useState(null)
  const [uploadingFor, setUploadingFor] = useState(null) // { clientId, type }
  const [uploadError, setUploadError] = useState('')
  const [dragOverClient, setDragOverClient] = useState(null)
  const fileInputRef = useRef(null)
  const [pendingUploadClient, setPendingUploadClient] = useState(null)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(client) {
    setEditing(client.id)
    setForm({
      name: client.name,
      ig_handle: client.ig_handle,
      meta_account_id: client.meta_account_id || '',
      meta_token: client.meta_token || '',
      color: client.color,
      contract_value: client.contract_value || '',
      contract_type: client.contract_type || '',
      contract_duration: client.contract_duration || '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    if (editing) await updateClient(editing, form)
    else await addClient(form)
    setShowModal(false)
  }

  function openAccessModal(client) {
    setAccessClient(client)
    setAccessForm({ email: '', password: '', confirmPassword: '' })
    setAccessError('')
    setAccessSuccess('')
    setShowAccessModal(true)
  }

  async function createAccess() {
    if (!supabase) {
      setAccessError('Banco de dados não conectado. Verifique o .env')
      return
    }
    if (accessForm.password !== accessForm.confirmPassword) {
      setAccessError('As senhas não coincidem.')
      return
    }
    if (accessForm.password.length < 6) {
      setAccessError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setAccessLoading(true)
    setAccessError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-client-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: accessForm.email,
            password: accessForm.password,
            client_id: accessClient.id,
          }),
        }
      )
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao criar acesso.')

      await updateClient(accessClient.id, { user_id: result.user.id })
      setAccessSuccess(`Acesso criado! ${accessForm.email} já pode fazer login.`)
    } catch (e) {
      const msg = e.message || ''
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setAccessError('Este email já possui uma conta cadastrada.')
      } else {
        setAccessError(msg || 'Erro ao criar acesso. Tente novamente.')
      }
    } finally {
      setAccessLoading(false)
    }
  }

  // ── Gerenciador de Arquivos ──────────────────────────────────────────────────

  async function handleFileUpload(clientId, file) {
    if (!file || !file.name.endsWith('.csv')) {
      setUploadError('Selecione um arquivo .csv válido.')
      return
    }
    setUploadingFor(clientId)
    setUploadError('')
    try {
      const text = await file.text()
      const data = detectAndParse(text)
      await importClientData(clientId, data)
    } catch (e) {
      setUploadError(e.message || 'Erro ao processar o arquivo.')
    } finally {
      setUploadingFor(null)
    }
  }

  function onFileInputChange(e) {
    if (pendingUploadClient && e.target.files[0]) {
      handleFileUpload(pendingUploadClient, e.target.files[0])
    }
    e.target.value = ''
  }

  function triggerUpload(clientId) {
    setPendingUploadClient(clientId)
    fileInputRef.current?.click()
  }

  function onDropFile(e, clientId) {
    e.preventDefault()
    setDragOverClient(null)
    handleFileUpload(clientId, e.dataTransfer.files[0])
  }

  const FILE_TYPES = {
    ads: {
      label: 'Meta Ads',
      icon: BarChart2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      summary: (d) => `${d.campaigns?.length || 0} campanhas · R$ ${Number(d.spend || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    },
    instagram: {
      label: 'Instagram',
      icon: Camera,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20',
      summary: (d) => `${Number(d.followers || 0).toLocaleString('pt-BR')} seguidores · ${d.growth?.length || 0} períodos`,
    },
  }

  return (
    <div>
      <Header title="Clientes" />
      <div className="p-6 space-y-5">

        <div className="flex items-center justify-between">
          <p className="text-sm text-[#888888]">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-all"
          >
            <Plus size={15} /> Novo Cliente
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(c => (
            <div key={c.id} className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5 hover:border-[#333333] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base"
                    style={{ background: c.color }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{c.name}</p>
                    <p className="text-xs text-[#555555]">{c.ig_handle || 'Sem Instagram'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="w-8 h-8 rounded-lg bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-all"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => removeClient(c.id)}
                    className="w-8 h-8 rounded-lg bg-[#222222] text-[#888888] hover:text-red-400 flex items-center justify-center hover:bg-[#2a2a2a] transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-[#555555]">
                <p>Contrato: <span className="text-[#888888]">{c.contract_type || 'N/A'}</span></p>
                <p>Valor: <span className="text-[#888888]">{c.contract_value ? `R$ ${c.contract_value}` : 'N/A'}</span></p>
                <p>Tempo: <span className="text-[#888888]">{c.contract_duration || 'N/A'}</span></p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setActiveClient(c)}
                  className="flex-1 py-2 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg border border-orange-500/20 transition-all"
                >
                  Selecionar
                </button>
                <button
                  onClick={() => openAccessModal(c)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    c.user_id
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'text-[#888888] bg-[#222222] border-[#2a2a2a] hover:text-white hover:bg-[#2a2a2a]'
                  }`}
                >
                  {c.user_id ? <ShieldCheck size={12} /> : <KeyRound size={12} />}
                  {c.user_id ? 'Acesso ativo' : 'Criar acesso'}
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={openAdd}
            className="bg-[#1a1a1a]/20 border border-dashed border-[#2a2a2a] rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-[#444444] hover:text-[#888888] hover:border-[#333333] transition-all min-h-[160px]"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
              <Plus size={18} />
            </div>
            <span className="text-sm">Adicionar cliente</span>
          </button>
        </div>

        {/* ── Gerenciador de Arquivos ── */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a2a2a]/50">
            <FolderOpen size={16} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Gerenciador de Relatórios</h2>
            <span className="text-xs text-[#555] ml-1">Gerencie os CSVs importados por cliente</span>
          </div>

          {/* Input oculto para upload */}
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileInputChange} />

          {uploadError && (
            <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{uploadError}</p>
              <button onClick={() => setUploadError('')} className="ml-auto text-red-400 hover:text-red-300"><X size={12} /></button>
            </div>
          )}

          <div className="divide-y divide-[#2a2a2a]/40">
            {clients.map(client => {
              const data = getClientData(client.id)
              const hasAds = !!data.ads
              const hasIg = !!data.instagram
              const isExpanded = expandedClient === client.id
              const isUploading = uploadingFor === client.id
              const isDragOver = dragOverClient === client.id

              return (
                <div key={client.id}
                  className={`transition-colors ${isDragOver ? 'bg-orange-500/5' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOverClient(client.id) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverClient(null) }}
                  onDrop={e => onDropFile(e, client.id)}
                >
                  {/* Linha do cliente */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#222]/30 transition-colors text-left"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: client.color }}>
                      {client.name.charAt(0)}
                    </div>

                    {/* Nome */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{client.name}</p>
                      <p className="text-xs text-[#555]">{client.ig_handle || 'Sem Instagram'}</p>
                    </div>

                    {/* Badges dos arquivos */}
                    <div className="flex items-center gap-2">
                      {hasAds ? (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                          <BarChart2 size={9} /> Meta Ads
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#222] border border-[#333] text-[#555]">
                          <BarChart2 size={9} /> Sem Ads
                        </span>
                      )}
                      {hasIg ? (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400">
                          <Camera size={9} /> Instagram
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#222] border border-[#333] text-[#555]">
                          <Camera size={9} /> Sem IG
                        </span>
                      )}
                    </div>

                    {/* Ações rápidas */}
                    <button
                      onClick={e => { e.stopPropagation(); triggerUpload(client.id) }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-[#888] hover:text-white bg-[#222] hover:bg-[#2a2a2a] rounded-lg border border-[#333] transition-all"
                    >
                      {isUploading
                        ? <span className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                        : <Upload size={11} />}
                      Upload
                    </button>

                    {/* Chevron */}
                    <div className="text-[#444] flex-shrink-0">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(FILE_TYPES).map(([type, cfg]) => {
                          const fileDataArray = Array.isArray(data[type]) ? data[type] : (data[type] ? [data[type]] : [])
                          const Icon = cfg.icon
                          
                          return (
                            <div key={type}
                              className={`rounded-xl border p-4 transition-all ${
                                fileDataArray.length > 0 ? cfg.bg : 'border-dashed border-[#2a2a2a] bg-[#111]/50'
                              }`}
                            >
                              {fileDataArray.length > 0 ? (
                                /* Arquivos presentes */
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <Icon size={15} className={cfg.color} />
                                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => triggerUpload(client.id)}
                                        title="Importar novo período"
                                        className="text-xs flex items-center gap-1 px-2 py-1 rounded text-[#555] hover:text-white hover:bg-[#333] transition-all"
                                      >
                                        <Plus size={11} /> Adicionar
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2 mt-2">
                                    {fileDataArray.map((fileData, idx) => {
                                      const periodLabel = fileData.dateRange || 'Período Antigo'
                                      return (
                                        <div key={fileData._dbId || idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={16} className={`${cfg.color} opacity-60 flex-shrink-0`} />
                                            <div className="min-w-0">
                                              <p className="text-xs text-white font-medium truncate">{periodLabel}</p>
                                              <p className="text-[10px] text-[#888] truncate">{cfg.summary(fileData)}</p>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => deleteClientData(client.id, fileData._dbType || type)}
                                            title="Excluir período"
                                            className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-all ml-2"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : (
                                /* Sem arquivo */
                                <button
                                  onClick={() => triggerUpload(client.id)}
                                  className="w-full flex flex-col items-center gap-2 py-3 text-center group"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center group-hover:bg-[#222] transition-colors">
                                    <Upload size={14} className="text-[#444] group-hover:text-[#888]" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#666] group-hover:text-[#888] transition-colors">Importar {cfg.label}</p>
                                    <p className="text-[10px] text-[#3a3a3a] mt-0.5">Arraste o CSV aqui ou clique</p>
                                  </div>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Drop hint quando arrastando */}
                      {isDragOver && (
                        <div className="mt-3 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5">
                          <Upload size={14} className="text-orange-400" />
                          <span className="text-xs text-orange-400 font-medium">Solte para importar para {client.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {clients.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen size={32} className="text-[#2a2a2a] mb-3" />
                <p className="text-sm text-[#555]">Nenhum cliente cadastrado ainda.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: criar/editar cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">{editing ? 'Editar' : 'Novo'} Cliente</h3>
              <button onClick={() => setShowModal(false)} className="text-[#555555] hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888888] block mb-1">Nome do cliente *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                    placeholder="Ex: Loja da Maria"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888888] block mb-1">Instagram Handle</label>
                  <input
                    value={form.ig_handle}
                    onChange={e => setForm(f => ({ ...f, ig_handle: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                    placeholder="@usuario"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[#888888] block mb-1">Valor do Contrato</label>
                  <input
                    value={form.contract_value}
                    onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                    placeholder="2000"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888888] block mb-1">Tipo de Contrato</label>
                  <input
                    value={form.contract_type}
                    onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                    placeholder="Ex: Recorrente"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888888] block mb-1">Duração</label>
                  <input
                    value={form.contract_duration}
                    onChange={e => setForm(f => ({ ...f, contract_duration: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                    placeholder="Ex: 6 meses"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#888888] block mb-2">Cor de identificação</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setForm(f => ({ ...f, color }))}
                      className={`w-7 h-7 rounded-full transition-all ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111111]' : ''}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={save}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Check size={16} /> {editing ? 'Salvar alterações' : 'Cadastrar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: criar acesso de login */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: accessClient?.color }}>
                  {accessClient?.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Criar acesso</h3>
                  <p className="text-xs text-[#555555]">{accessClient?.name}</p>
                </div>
              </div>
              <button onClick={() => setShowAccessModal(false)} className="text-[#555555] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#666666] mb-5 mt-3">
              Defina o email e senha que o cliente usará para acessar o painel dele.
            </p>

            {accessError && (
              <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                {accessError}
              </div>
            )}

            {accessSuccess ? (
              <div className="px-3 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                {accessSuccess}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#888888] block mb-1.5">Email do cliente</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                    <input
                      type="email"
                      value={accessForm.email}
                      onChange={e => setAccessForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="cliente@email.com"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-orange-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#888888] block mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                    <input
                      type={showAccessPassword ? 'text' : 'password'}
                      value={accessForm.password}
                      onChange={e => setAccessForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="mínimo 6 caracteres"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-orange-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#888888]"
                    >
                      {showAccessPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#888888] block mb-1.5">Confirmar senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                    <input
                      type={showAccessPassword ? 'text' : 'password'}
                      value={accessForm.confirmPassword}
                      onChange={e => setAccessForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="repita a senha"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-orange-400 transition-colors"
                    />
                  </div>
                </div>

                <button
                  onClick={createAccess}
                  disabled={accessLoading || !accessForm.email || !accessForm.password}
                  className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all mt-1"
                >
                  {accessLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Criando...
                    </span>
                  ) : (
                    <><KeyRound size={14} /> Criar acesso</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
