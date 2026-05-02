import { useState } from 'react'
import { DollarSign, Eye, MousePointer, TrendingUp, BarChart2, Activity, Award, AlertTriangle, Lightbulb, FileText, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import Header from '../components/layout/Header'
import MetricCard from '../components/charts/MetricCard'
import ChartTooltip from '../components/charts/ChartTooltip'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS = {
  ACTIVE: { bg: 'bg-emerald-600/20', text: 'text-emerald-400', label: 'Ativa' },
  PAUSED: { bg: 'bg-amber-600/20', text: 'text-amber-400', label: 'Pausada' },
  ARCHIVED: { bg: 'bg-[#2a2a2a]/20', text: 'text-[#888888]', label: 'Arquivada' },
}

export default function AdsMonitor() {
  const { activeClient, getClientData, deleteClientData, loading } = useClients()
  const { isAdmin } = useAuth()
  const imported = getClientData(activeClient?.id)
  const adsReports = imported?.ads || []
  const [selectedReportIdx, setSelectedReportIdx] = useState(0)

  // Garantir que o index existe
  const safeIdx = selectedReportIdx >= adsReports.length ? 0 : selectedReportIdx
  const data = adsReports[safeIdx] || null
  
  const [period, setPeriod] = useState('7d')
  const [campaignSort, setCampaignSort] = useState({ by: 'spend', dir: 'desc' })

  function toggleSort(col) {
    setCampaignSort(prev => ({
      by: col,
      dir: prev.by === col && prev.dir === 'desc' ? 'asc' : 'desc'
    }))
  }

  const sortedCampaigns = data ? [...(data.campaigns || [])].sort((a, b) => {
    const { by, dir } = campaignSort
    if (by === 'name') {
      const cmp = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
      return dir === 'asc' ? cmp : -cmp
    }
    const av = Number(a[by]) || 0
    const bv = Number(b[by]) || 0
    return dir === 'desc' ? bv - av : av - bv
  }) : []

  async function handleDelete() {
    if (confirm('Tem certeza que deseja apagar este relatório de anúncios?')) {
      await deleteClientData(activeClient.id, data._dbType || 'ads')
      setSelectedReportIdx(0)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Monitor de Anúncios" />
        <div className="p-6 flex justify-center items-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <Header title="Monitor de Anúncios" />
        <div className="p-6 flex flex-col items-center justify-center text-center mt-20 border-2 border-dashed border-[#2a2a2a] rounded-2xl py-20 bg-[#111111]/50">
          <BarChart2 size={48} className="text-[#333333] mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Nenhum dado encontrado</h2>
          <p className="text-[#888888] max-w-md">Para visualizar este painel, conecte o Supabase ou importe um relatório em CSV do Meta Ads para o cliente atual.</p>
        </div>
      </div>
    )
  }

  const creatives = data.creatives || []
  const hasCreatives = creatives.length > 0
  const analysisItems = hasCreatives ? creatives : data.campaigns

  const hasMessages = Number(data.messages) > 0

  // Filter out items with very low impressions to avoid noise
  const validItems = analysisItems.filter(item => Number(item.impressions) > 100)
  
  let topPerf = []
  let worstPerf = []
  const metricLabel = hasMessages ? 'Custo/Msg' : 'CTR'

  if (hasMessages) {
    const validMsgItems = analysisItems.filter(item => Number(item.messages) > 0)
    topPerf = [...validMsgItems].sort((a, b) => Number(a.costPerMessage) - Number(b.costPerMessage)).slice(0, 3)
    worstPerf = [...validMsgItems].sort((a, b) => Number(b.costPerMessage) - Number(a.costPerMessage)).slice(0, 3)
  } else {
    topPerf = [...validItems].sort((a, b) => Number(b.ctr) - Number(a.ctr)).slice(0, 3)
    worstPerf = [...validItems].sort((a, b) => Number(a.ctr) - Number(b.ctr)).slice(0, 3)
  }

  return (
    <div>
      <Header title="Monitor de Anúncios" />
      <div className="p-6 space-y-6">

        {/* Gerenciador de Arquivos / Dados */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Relatório do Meta Ads</p>
              {adsReports.length > 1 ? (
                <select 
                  className="mt-1 bg-[#111] border border-[#333] text-emerald-400 text-xs rounded px-2 py-1 outline-none"
                  value={safeIdx}
                  onChange={e => setSelectedReportIdx(Number(e.target.value))}
                >
                  {adsReports.map((report, idx) => (
                    <option key={report._dbId || idx} value={idx}>
                      {report.dateRange ? `Período: ${report.dateRange}` : `Relatório ${idx + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-emerald-400">
                  {data.dateRange 
                    ? `CSV Importado (${data.dateRange})` 
                    : 'CSV Importado com sucesso'}
                </p>
              )}
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleDelete} className="flex items-center justify-center gap-2 px-3 py-2 bg-red-900/10 border border-red-900/30 text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded-lg text-xs font-medium transition-all w-full md:w-auto">
              <Trash2 size={14} /> Excluir Relatório
            </button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard title="Investimento Total" value={`R$ ${Number(data.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="indigo" />
          <MetricCard title="Impressões" value={Number(data.impressions).toLocaleString('pt-BR')} icon={Eye} color="cyan" />
          <MetricCard title="Mensagens Iniciadas" value={Number(data.messages || 0).toLocaleString('pt-BR')} icon={Activity} color="purple" />
          <MetricCard title="Custo por Mensagem" value={`R$ ${data.costPerMessage || '0.00'}`} icon={BarChart2} color="emerald" />
          <MetricCard title="Cliques no Link" value={Number(data.clicks || 0).toLocaleString('pt-BR')} icon={MousePointer} color="blue" />
          <MetricCard title="Taxa de Cliques (CTR)" value={`${data.ctr}%`} icon={TrendingUp} color="amber" />
        </div>

        {/* Gráficos */}
        {(() => {
          const hasDaily = data.daily && data.daily.length > 0
          // Prepara dados por campanha como fallback (trunca nome para caber no eixo)
          const campaignChartData = (data.campaigns || [])
            .filter(c => Number(c.spend) > 0 || Number(c.impressions) > 0)
            .map(c => ({
              name: c.name.replace(/^Post do Instagram:\s*/i, '').slice(0, 22) + '…',
              fullName: c.name,
              spend: Number(c.spend),
              impressions: Number(c.impressions),
            }))
            .sort((a, b) => b.spend - a.spend)

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-section-title">
                      {hasDaily ? 'Investimento Diário (R$)' : 'Investimento por Campanha (R$)'}
                    </h2>
                    {!hasDaily && (
                      <p className="text-[10px] text-[#555] mt-0.5">
                        💡 Para ver por dia, exporte com detalhamento Tempo › Dia no Meta Ads
                      </p>
                    )}
                  </div>
                  {hasDaily && (
                    <div className="flex gap-1">
                      {['7d', '30d'].map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={`px-2.5 py-1 text-xs rounded-lg transition-all ${period === p ? 'bg-orange-500 text-white' : 'bg-[#222222] text-[#888888] hover:bg-[#2a2a2a]'}`}>{p}</button>
                      ))}
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hasDaily ? data.daily : campaignChartData} margin={{ bottom: hasDaily ? 0 : 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1208" />
                    <XAxis
                      dataKey={hasDaily ? 'date' : 'name'}
                      tick={{ fill: '#888888', fontSize: hasDaily ? 11 : 9 }}
                      axisLine={false}
                      tickLine={false}
                      angle={hasDaily ? 0 : -35}
                      textAnchor={hasDaily ? 'middle' : 'end'}
                      interval={0}
                    />
                    <YAxis tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} formatter={(v, n, p) => hasDaily ? [v, n] : [`R$ ${Number(v).toFixed(2)}`, p.payload?.fullName || n]} />
                    <Bar dataKey="spend" name="Investimento (R$)" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
                <div className="mb-4">
                  <h2 className="text-section-title">
                    {hasDaily ? 'Impressões Diárias' : 'Impressões por Campanha'}
                  </h2>
                  {!hasDaily && (
                    <p className="text-[10px] text-[#555] mt-0.5">
                      💡 Para ver por dia, exporte com detalhamento Tempo › Dia no Meta Ads
                    </p>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  {hasDaily ? (
                    <LineChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1208" />
                      <XAxis dataKey="date" tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="impressions" name="Impressões" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={campaignChartData} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1208" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#888888', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} formatter={(v, n, p) => [Number(v).toLocaleString('pt-BR'), p.payload?.fullName || n]} />
                      <Bar dataKey="impressions" name="Impressões" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* Tabela de Campanhas */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
          <h2 className="text-section-title mb-5">Campanhas Ativas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {[
                    { label: 'Campanha', col: 'name' },
                    { label: 'Status', col: null },
                    { label: 'Investimento', col: 'spend' },
                    { label: 'Mensagens', col: 'messages' },
                    { label: 'Custo/Msg', col: 'costPerMessage' },
                  ].map(({ label, col }) => (
                    <th key={label} className="text-left text-xs text-[#888888] font-medium pb-3 pr-4 uppercase tracking-wider">
                      {col ? (
                        <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-white transition-colors">
                          {label}
                          {campaignSort.by === col
                            ? campaignSort.dir === 'desc'
                              ? <ArrowDown size={12} className="text-orange-400" />
                              : <ArrowUp size={12} className="text-orange-400" />
                            : <ArrowUpDown size={12} className="opacity-30" />}
                        </button>
                      ) : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]/50">
                {sortedCampaigns.map(c => {
                  const s = STATUS_COLORS[c.status] || STATUS_COLORS.ACTIVE
                  return (
                    <tr key={c.id} className="hover:bg-[#222222]/20 transition-colors">
                      <td className="py-3 pr-4 text-white font-medium">{c.name}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                      </td>
                      <td className="py-3 pr-4 text-[#cccccc]">R$ {Number(c.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 pr-4 text-[#cccccc]">{Number(c.messages || 0).toLocaleString('pt-BR')} msg</td>
                      <td className="py-3 pr-4 text-[#cccccc]">R$ {c.costPerMessage || '0.00'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Análise e Otimização */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Award className="text-emerald-400" size={20} />
              <h2 className="text-section-title">Melhor Desempenho (Top {metricLabel})</h2>
            </div>
          <div className="space-y-3">
              {topPerf.length > 0 ? topPerf.map((item, idx) => (
                <div key={item.id || idx} className="bg-[#222222]/40 border border-emerald-900/30 p-4 rounded-xl">
                  <div className="flex items-start gap-3">
                    {/* Ranking badge */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                      ${idx === 0 ? 'bg-amber-500/20 text-amber-400' : idx === 1 ? 'bg-slate-500/20 text-slate-400' : 'bg-orange-900/20 text-orange-600'}`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Nome do anúncio/campanha */}
                      <p className="text-sm text-white font-medium leading-snug" title={item.name}>
                        {item.name || `Item #${item.id}`}
                      </p>
                      {/* Badge de tipo */}
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-500 font-medium">
                        {hasCreatives ? '📢 Anúncio' : '📁 Campanha'}
                      </span>
                    </div>
                  </div>
                  {/* Métricas em linha */}
                  <div className="mt-3 pt-3 border-t border-[#333] grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">{hasMessages ? 'Custo/Msg' : 'CTR'}</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {hasMessages ? `R$ ${item.costPerMessage}` : `${item.ctr}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">{hasMessages ? 'Mensagens' : 'CPC'}</p>
                      <p className="text-sm font-semibold text-[#ccc]">
                        {hasMessages ? `${item.messages} msg` : `R$ ${item.cpc}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">Invest.</p>
                      <p className="text-sm font-semibold text-[#ccc]">R$ {Number(item.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#444] mt-1">{Number(item.impressions).toLocaleString('pt-BR')} impressões</p>
                </div>
              )) : <p className="text-sm text-[#888888]">Dados insuficientes para análise (&gt;100 impressões).</p>}
            </div>
          </div>

          <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="text-red-400" size={20} />
              <h2 className="text-section-title">Atenção (Pior {metricLabel})</h2>
            </div>
            <div className="space-y-3">
              {worstPerf.length > 0 ? worstPerf.map((item, idx) => (
                <div key={item.id || idx} className="bg-[#222222]/40 border border-red-900/30 p-4 rounded-xl">
                  <div className="flex items-start gap-3">
                    {/* Ranking badge */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-red-900/20 text-red-500">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Nome do anúncio/campanha */}
                      <p className="text-sm text-white font-medium leading-snug" title={item.name}>
                        {item.name || `Item #${item.id}`}
                      </p>
                      {/* Badge de tipo */}
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-red-900/20 text-red-500 font-medium">
                        {hasCreatives ? '📢 Anúncio' : '📁 Campanha'}
                      </span>
                    </div>
                  </div>
                  {/* Métricas em linha */}
                  <div className="mt-3 pt-3 border-t border-[#333] grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">{hasMessages ? 'Custo/Msg' : 'CTR'}</p>
                      <p className="text-sm font-bold text-red-400">
                        {hasMessages ? `R$ ${item.costPerMessage}` : `${item.ctr}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">{hasMessages ? 'Mensagens' : 'CPC'}</p>
                      <p className="text-sm font-semibold text-[#ccc]">
                        {hasMessages ? `${item.messages} msg` : `R$ ${item.cpc}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">Invest.</p>
                      <p className="text-sm font-semibold text-[#ccc]">R$ {Number(item.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#444] mt-1">{Number(item.impressions).toLocaleString('pt-BR')} impressões</p>
                </div>
              )) : <p className="text-sm text-[#888888]">Dados insuficientes para análise (&gt;100 impressões).</p>}
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="text-indigo-400" size={20} />
              <h2 className="text-section-title text-indigo-100">Sugestões de Otimização</h2>
            </div>
            <ul className="space-y-3 text-sm text-indigo-200/80">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>Os itens em <strong className="text-red-400">Atenção</strong> indicam que a mensagem não está retendo a atenção. Considere pausá-los se o custo estiver alto ou teste novas variações com um "gancho" diferente nos primeiros 3 segundos.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>Analise o padrão dos itens em <strong className="text-emerald-400">Melhor Desempenho</strong>. O que eles têm em comum? Formato (vídeo/imagem), cores, ou a copy? Modele esses elementos vencedores em novas criações.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>
                  {hasCreatives 
                    ? "Excelente! Como você tem dados a nível de anúncio, você tem a visão granular necessária. Foque o investimento nos 3 melhores anúncios e pause os piores." 
                    : "Dica: Exporte seu relatório do Meta Ads com o detalhamento por 'Nome do Anúncio'. Isso fará com que este painel exiba os criativos vencedores e perdedores, permitindo uma otimização mais cirúrgica."}
                </span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
