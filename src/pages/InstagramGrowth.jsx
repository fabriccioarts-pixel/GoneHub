import { useState, useRef, useEffect } from 'react'
import { Users, Eye, Trash2, Camera, Link, BarChart2, MousePointerClick, Upload, ChevronDown, Check } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Header from '../components/layout/Header'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'


const SORT_OPTIONS = [
  { value: 'reach',      label: 'Alcance' },
  { value: 'views',      label: 'Visualizações' },
  { value: 'likes',      label: 'Curtidas' },
  { value: 'follows',    label: 'Seguimentos' },
  { value: 'engagement', label: 'Taxa de Eng.' },
  { value: 'date',       label: 'Data' },
]

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = SORT_OPTIONS.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
          open
            ? 'bg-[#1a1a1a] border-pink-500/40 text-pink-300'
            : 'bg-[#111] border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#333]'
        }`}
      >
        Ordenar: <span className="text-pink-300">{selected?.label}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/60 overflow-hidden py-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-4 px-4 py-2 text-xs font-medium transition-colors text-left ${
                opt.value === value
                  ? 'text-pink-300 bg-pink-500/10'
                  : 'text-[#888] hover:text-white hover:bg-[#1e1e1e]'
              }`}
            >
              {opt.label}
              {opt.value === value && <Check size={11} className="text-pink-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-[#666] text-xs mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value?.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  )
}

function StatBadge({ label, value, color = 'text-white' }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-base font-bold ${color}`}>{value}</span>
      <span className="text-[11px] text-[#555] uppercase tracking-wider font-medium">{label}</span>
    </div>
  )
}

function PeriodDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find(o => o.monthKey === value)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#444] font-medium uppercase tracking-wider">Período</span>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            open
              ? 'bg-[#1a1a1a] border-pink-500/40 text-pink-300'
              : 'bg-[#111] border-[#2a2a2a] text-pink-300 hover:border-[#333]'
          }`}
        >
          {selected?.display ?? 'Selecionar'}
          <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[140px] bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/60 overflow-hidden py-1">
            {options.map(opt => (
              <button
                key={opt.monthKey}
                onClick={() => { onChange(opt.monthKey); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-4 px-4 py-2 text-xs font-medium transition-colors text-left ${
                  opt.monthKey === value
                    ? 'text-pink-300 bg-pink-500/10'
                    : 'text-[#888] hover:text-white hover:bg-[#1e1e1e]'
                }`}
              >
                {opt.display}
                {opt.monthKey === value && <Check size={11} className="text-pink-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function InstagramGrowth() {
  const { activeClient, getClientData, deleteClientData, loading } = useClients()
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('growth')
  const [selectedGrowthMonth, setSelectedGrowthMonth] = useState('')
  const [selectedPostsMonth, setSelectedPostsMonth] = useState('')
  const [sortBy, setSortBy] = useState('reach')

  const imported = getClientData(activeClient?.id)
  const igReports = imported?.instagram || []

  // Agrupa por mês e marca o que cada mês tem
  const reportsByMonth = igReports.reduce((acc, report) => {
    const rDate = report.dateRange || ''
    const match = rDate.match(/(\d{4})-(\d{2})/)
    const monthKey = match ? `${match[1]}-${match[2]}` : `outro_${rDate || Math.random()}`
    if (!acc[monthKey]) acc[monthKey] = { monthKey, display: '', reports: [] }
    acc[monthKey].reports.push(report)
    if (!acc[monthKey].display && match) {
      acc[monthKey].display = `${match[2]}/${match[1]}`
    } else if (!acc[monthKey].display) {
      acc[monthKey].display = 'Sem data'
    }
    return acc
  }, {})

  // Filtra opções de período por tipo de dado
  const allMonthOptions = Object.values(reportsByMonth).sort((a, b) => b.monthKey.localeCompare(a.monthKey))

  function mergeReports(reports) {
    return reports.reduce((merged, r) => ({
      ...merged, ...r,
      posts: r.posts || merged.posts,
      followers: r.followers || merged.followers,
      reach: r.reach || merged.reach,
      views: r.views || merged.views,
      clicks: r.clicks || merged.clicks,
      dateRange: merged.dateRange || r.dateRange,
    }), {})
  }

  const growthMonthOptions = allMonthOptions.filter(opt => {
    const merged = mergeReports(opt.reports)
    return !!(merged.followers || merged.reach || merged.views || merged.clicks)
  })

  const postsMonthOptions = allMonthOptions.filter(opt => {
    const merged = mergeReports(opt.reports)
    return !!(merged.posts?.posts?.length)
  })

  // Auto-select inicial
  if (!selectedGrowthMonth && growthMonthOptions.length > 0) setSelectedGrowthMonth(growthMonthOptions[0].monthKey)
  if (!selectedPostsMonth && postsMonthOptions.length > 0) setSelectedPostsMonth(postsMonthOptions[0].monthKey)

  // Dados merged por aba
  const currentGrowthData = reportsByMonth[selectedGrowthMonth]
  const currentPostsData = reportsByMonth[selectedPostsMonth]

  const igGrowth = currentGrowthData ? mergeReports(currentGrowthData.reports) : null
  const igPosts = currentPostsData ? mergeReports(currentPostsData.reports) : null

  async function handleDeleteGrowth() {
    if (!currentGrowthData) return
    if (confirm(`Apagar dados de crescimento de ${currentGrowthData.display}?`)) {
      for (const r of currentGrowthData.reports) await deleteClientData(activeClient.id, r._dbType)
      setSelectedGrowthMonth('')
    }
  }

  async function handleDeletePosts() {
    if (!currentPostsData) return
    if (confirm(`Apagar dados de posts de ${currentPostsData.display}?`)) {
      for (const r of currentPostsData.reports) await deleteClientData(activeClient.id, r._dbType)
      setSelectedPostsMonth('')
    }
  }

  // ── Helpers ──
  function formatDateRange(raw) {
    if (!raw) return null
    return raw.split(' a ').map(part => {
      const d = new Date(part.trim())
      if (isNaN(d.getTime())) return part.trim()
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    }).join(' – ')
  }

  // ── Loading ──
  if (loading) {
    return (
      <div>
        <Header title="Crescimento Instagram" />
        <div className="p-6 flex justify-center items-center h-[50vh]">
          <div className="w-8 h-8 border-2 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // ── Empty state ──
  if (!igGrowth && !igPosts) {
    return (
      <div>
        <Header title="Crescimento Instagram" />
        <div className="p-6">
          <div className="mt-8 rounded-2xl border border-dashed border-[#2a2a2a] bg-[#0d0d0d] flex flex-col items-center justify-center text-center py-24 px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/20 flex items-center justify-center mb-5">
              <Camera size={28} className="text-pink-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Nenhum dado de Instagram</h2>
            <p className="text-sm text-[#555] max-w-sm leading-relaxed">
              Importe um CSV do Meta Business Suite para visualizar métricas de crescimento e análise de posts.
            </p>
            {isAdmin && (
              <div className="mt-6 flex items-center gap-2 text-xs text-[#444] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5">
                <Upload size={13} className="text-orange-400" />
                Use o botão <span className="text-orange-400 font-medium">Importar CSV</span> no canto superior direito
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Derived: crescimento ──
  const followers = igGrowth?.followers?.total ?? 0
  const reach = igGrowth?.reach?.total ?? 0
  const impressions = igGrowth?.views?.total ?? 0
  const clicks = igGrowth?.clicks?.total ?? 0
  const rawGrowthData = igGrowth?.followers?.dailyData ?? []
  const growthData = rawGrowthData.map(d => ({ ...d, followers: d.followers !== undefined ? d.followers : d.value }))

  // ── Derived: posts ──
  const postsList = igPosts?.posts?.posts || []
  const postsSummary = igPosts?.posts?.summary || {}
  const totalEngagement = postsSummary.likes + postsSummary.comments + postsSummary.shares + postsSummary.saves || 0

  return (
    <div>
      <Header title="Crescimento Instagram" />
      <div className="p-6 space-y-5">

        {/* ── Tab switcher ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex bg-[#111] p-1 rounded-lg border border-[#222] gap-0.5">
            <button
              onClick={() => setActiveTab('growth')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'growth' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40' : 'text-[#555] hover:text-[#888]'
              }`}
            >
              Crescimento
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'posts' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40' : 'text-[#555] hover:text-[#888]'
              }`}
            >
              Posts {postsList.length > 0 ? `(${postsList.length})` : ''}
            </button>
          </div>
        </div>

        {activeTab === 'growth' ? (
          <>
            {/* ── Período + excluir ── */}
            <div className="flex items-center justify-between gap-3">
              {growthMonthOptions.length > 0
                ? <PeriodDropdown options={growthMonthOptions} value={selectedGrowthMonth} onChange={setSelectedGrowthMonth} />
                : <span className="text-xs text-[#555]">Nenhum período disponível</span>
              }
              {isAdmin && igGrowth && (
                <button onClick={handleDeleteGrowth}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-red-400 hover:border-red-900/40 hover:bg-red-900/10 rounded-lg text-xs font-medium transition-all">
                  <Trash2 size={13} /> Excluir
                </button>
              )}
            </div>

            {igGrowth ? (<>
            {/* ── Profile hero banner ── */}
            <div className="relative rounded-2xl overflow-hidden border border-[#2a2a2a]">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-950/60 via-pink-950/40 to-[#0d0d0d]" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDE4YzkuOTQgMCAxOC04LjA2IDE4LTE4eiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMDIiLz48L2c+PC9zdmc+')] opacity-30" />
              <div className="relative flex items-center gap-5 p-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-pink-900/40 flex-shrink-0">
                  {activeClient?.name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-white font-bold text-lg leading-tight">
                      {activeClient?.ig_handle || activeClient?.name}
                    </h2>
                    <Camera size={14} className="text-pink-400 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-[#666]">
                    {formatDateRange(igGrowth?.dateRange) || currentGrowthData?.display || 'Período importado'}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-8 pr-2">
                  <StatBadge label="Seguidores" value={`+${followers.toLocaleString('pt-BR')}`} color="text-pink-300" />
                  <StatBadge label="Alcance" value={reach.toLocaleString('pt-BR')} color="text-purple-300" />
                  <StatBadge label="Impressões" value={impressions.toLocaleString('pt-BR')} color="text-indigo-300" />
                </div>
              </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Novos Seguidores', value: followers, icon: Users, accent: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
                { label: 'Alcance', value: reach, icon: Eye, accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
                { label: 'Impressões', value: impressions, icon: BarChart2, accent: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
                { label: 'Cliques no Link', value: clicks, icon: MousePointerClick, accent: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
              ].map(({ label, value, icon: Icon, accent, bg, border }) => (
                <div key={label} className={`rounded-xl p-4 border bg-[#0d0d0d] ${border} hover:brightness-110 transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-[#555] font-medium uppercase tracking-wider">{label}</p>
                    <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon size={14} className={accent} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${accent}`}>{value.toLocaleString('pt-BR')}</p>
                  {value === 0 && <p className="text-[11px] text-[#3a3a3a] mt-1">Sem dados no período</p>}
                </div>
              ))}
            </div>

            {/* ── Growth chart ── */}
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-white">Evolução de Seguidores</h2>
                  {growthData.length > 0 && (
                    <p className="text-xs text-[#444] mt-0.5">{growthData[0].date} → {growthData[growthData.length - 1].date}</p>
                  )}
                </div>
                {growthData.length > 0 && (
                  <span className="text-xs text-[#444] bg-[#1a1a1a] border border-[#222] px-2 py-1 rounded-lg">{growthData.length} dias</span>
                )}
              </div>
              {growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFollowers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="followers" name="Seguidores" stroke="#ec4899" strokeWidth={2} fill="url(#gradFollowers)" dot={false} activeDot={{ r: 4, fill: '#ec4899' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-60 flex flex-col items-center justify-center text-center border border-dashed border-[#222] rounded-xl">
                  <BarChart2 size={28} className="text-[#2a2a2a] mb-3" />
                  <p className="text-sm text-[#444]">Sem dados de evolução diária</p>
                  <p className="text-xs text-[#333] mt-1">O CSV importado não contém série temporal</p>
                </div>
              )}
            </div>
            </>) : (
              <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#0d0d0d] flex flex-col items-center justify-center text-center py-20">
                <Camera size={28} className="text-[#2a2a2a] mb-3" />
                <p className="text-sm text-[#555]">Nenhum dado de crescimento importado.</p>
              </div>
            )}
          </>
        ) : (
          /* ── POSTS TAB ── */
          <div className="space-y-5">
            {/* ── Período + excluir ── */}
            <div className="flex items-center justify-between gap-3">
              {postsMonthOptions.length > 0
                ? <PeriodDropdown options={postsMonthOptions} value={selectedPostsMonth} onChange={setSelectedPostsMonth} />
                : <span className="text-xs text-[#555]">Nenhum período disponível</span>
              }
              {isAdmin && igPosts && (
                <button onClick={handleDeletePosts}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-red-400 hover:border-red-900/40 hover:bg-red-900/10 rounded-lg text-xs font-medium transition-all">
                  <Trash2 size={13} /> Excluir
                </button>
              )}
            </div>

            {postsList.length > 0 ? (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Alcance Total', value: postsSummary.reach || 0, accent: 'text-white' },
                    { label: 'Engajamento', value: totalEngagement, accent: 'text-pink-400' },
                    { label: 'Seguimentos', value: postsSummary.follows || 0, accent: 'text-emerald-400' },
                    { label: 'Compartilhamentos', value: postsSummary.shares || 0, accent: 'text-white' },
                    { label: 'Salvos', value: postsSummary.saves || 0, accent: 'text-white' },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="bg-[#0d0d0d] border border-[#222] rounded-xl p-4 text-center">
                      <p className="text-[10px] text-[#444] uppercase font-semibold tracking-wider mb-1.5">{label}</p>
                      <p className={`text-xl font-bold ${accent}`}>{value.toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-white">
                    {postsList.length} {postsList.length === 1 ? 'publicação' : 'publicações'} no período
                  </p>
                  <SortDropdown value={sortBy} onChange={setSortBy} />
                </div>

                {/* Post cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...postsList].sort((a, b) => {
                    if (sortBy === 'date') return (b.date || '').localeCompare(a.date || '')
                    if (sortBy === 'views') return b.views - a.views
                    if (sortBy === 'likes') return b.likes - a.likes
                    if (sortBy === 'follows') return (b.follows || 0) - (a.follows || 0)
                    if (sortBy === 'engagement') {
                      const engA = a.reach > 0 ? (a.likes + a.comments + a.shares + a.saves) / a.reach : 0
                      const engB = b.reach > 0 ? (b.likes + b.comments + b.shares + b.saves) / b.reach : 0
                      return engB - engA
                    }
                    return b.reach - a.reach // default: reach
                  }).map((post, idx) => {
                    const embedUrl = post.url
                      ? `${post.url.endsWith('/') ? post.url : post.url + '/'}embed/`
                      : null
                    const totalEng = post.likes + post.comments + post.shares + post.saves
                    const engRate = post.reach > 0 ? ((totalEng / post.reach) * 100).toFixed(2) : '0.00'

                    return (
                      <div key={idx} className="bg-[#0d0d0d] border border-[#222] rounded-2xl overflow-hidden hover:border-pink-500/30 transition-all flex flex-col md:flex-row group">
                        {/* Preview */}
                        {embedUrl ? (
                          <div className="w-full md:w-56 h-72 md:h-auto bg-black flex-shrink-0 border-b md:border-b-0 md:border-r border-[#222] relative overflow-hidden">
                            <iframe src={embedUrl} className="w-full h-full border-0" allowTransparency="true" />
                            <div className="absolute inset-0 pointer-events-none" />
                          </div>
                        ) : (
                          <div className="w-full md:w-56 h-40 md:h-auto bg-[#111] flex flex-col items-center justify-center flex-shrink-0 border-b md:border-b-0 md:border-r border-[#222] gap-2">
                            <Camera size={28} className="text-[#2a2a2a]" />
                            <p className="text-xs text-[#333]">Sem preview</p>
                          </div>
                        )}

                        <div className="flex-1 flex flex-col min-w-0">
                          {/* Header */}
                          <div className="p-4 flex items-start justify-between gap-2 border-b border-[#1a1a1a]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                                {post.type}
                              </span>
                              {(post.follows || 0) > 0 && (
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  +{post.follows} seguidores
                                </span>
                              )}
                            </div>
                            {post.url && (
                              <a href={post.url} target="_blank" rel="noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1a1a1a] text-[#555] hover:text-pink-400 hover:bg-pink-500/10 transition-all flex-shrink-0">
                                <Link size={13} />
                              </a>
                            )}
                          </div>

                          {/* Description */}
                          <div className="p-4 flex-1">
                            <p className="text-sm text-[#888] italic leading-relaxed line-clamp-4">
                              "{post.description || 'Sem descrição'}"
                            </p>
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-4 border-t border-[#1a1a1a] divide-x divide-[#1a1a1a]">
                            {[
                              { label: 'Alcance', val: post.reach },
                              { label: 'Curtidas', val: post.likes },
                              { label: 'Compartilh.', val: post.shares },
                            ].map(({ label, val }) => (
                              <div key={label} className="p-3 text-center">
                                <p className="text-[9px] text-[#444] uppercase font-bold mb-0.5 tracking-wider">{label}</p>
                                <p className="text-xs text-white font-bold">{val.toLocaleString('pt-BR')}</p>
                              </div>
                            ))}
                            <div className="p-3 text-center bg-pink-500/5">
                              <p className="text-[9px] text-pink-500/60 uppercase font-bold mb-0.5 tracking-wider">Taxa Eng.</p>
                              <p className="text-xs text-pink-300 font-bold">{engRate}%</p>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="px-4 py-2.5 flex items-center justify-between border-t border-[#1a1a1a] bg-black/30">
                            <span className="text-[11px] text-[#444] font-medium">{formatDateRange(post.date) || post.date}</span>
                            <div className="flex items-center gap-3 text-[11px] text-[#444]">
                              <span>💬 {post.comments}</span>
                              <span>🔖 {post.saves}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#0d0d0d] flex flex-col items-center justify-center text-center py-24 px-8">
                <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-4">
                  <Camera size={24} className="text-[#333]" />
                </div>
                <p className="text-sm text-[#555] font-medium mb-1.5">Nenhum post encontrado</p>
                <p className="text-xs text-[#3a3a3a] max-w-xs">
                  Importe o arquivo de "Conteúdo do Perfil" do Meta Business Suite para ver a análise de posts.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
