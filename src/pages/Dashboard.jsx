import { DollarSign, Users, Eye, TrendingUp, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Header from '../components/layout/Header'
import MetricCard from '../components/charts/MetricCard'
import ChartTooltip from '../components/charts/ChartTooltip'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { activeClient, getClientData, loading } = useClients()
  const { isClient } = useAuth()
  const imported = getClientData(activeClient?.id)
  const adsReports = imported?.ads || []
  const ads = Array.isArray(adsReports) ? adsReports[0] : adsReports
  const igReports = imported?.instagram || []
  const ig = Array.isArray(igReports) ? igReports[0] : igReports

  if (loading) {
    return (
      <div>
        <Header title="Dashboard" />
        <div className="p-6 flex justify-center items-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!activeClient) {
    return (
      <div>
        <Header title="Dashboard" />
        <div className="p-6 flex flex-col items-center justify-center text-center mt-20 border-2 border-dashed border-[#2a2a2a] rounded-2xl py-20 bg-[#111111]/50">
          <Zap size={48} className="text-[#333333] mb-4" />
          {isClient ? (
            <>
              <h2 className="text-xl font-medium text-white mb-2">Painel em configuração</h2>
              <p className="text-[#888888] max-w-md">Seu acesso está sendo configurado pelo seu gestor. Em breve os dados aparecerão aqui. Se isso persistir, entre em contato.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-medium text-white mb-2">Selecione um Cliente</h2>
              <p className="text-[#888888] max-w-md">Para visualizar os dados do painel, escolha um cliente ativo na barra lateral.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!ads && !ig) {
    return (
      <div>
        <Header title="Dashboard" />
        <div className="p-6 flex flex-col items-center justify-center text-center mt-20 border-2 border-dashed border-[#2a2a2a] rounded-2xl py-20 bg-[#111111]/50">
          <Zap size={48} className="text-[#333333] mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Painel Vazio</h2>
          <p className="text-[#888888] max-w-md">Nenhum dado importado para o cliente "{activeClient.name}". Vá para a aba Anúncios ou Instagram para importar um CSV.</p>
        </div>
      </div>
    )
  }

  // Derive KPIs
  const totalSpend = ads ? Number(ads.spend) : 0
  const followers = ig?.followers?.total ?? (ig?.followers || 0)
  const igImpressions = ig?.views?.total ?? (ig?.weeklyImpressions || 0)
  const totalImpressions = (ads ? Number(ads.impressions) : 0) + igImpressions
  const messages = ads ? Number(ads.messages) : 0
  const igClicks = ig?.clicks?.total ?? 0

  // Construir o gráfico diário de anúncios
  let chartData = []
  if (ads && ads.daily) {
    chartData = ads.daily.map(d => ({
      data: d.date,
      investimento: d.spend,
      impressoes: d.impressions
    }))
  } else if (ig) {
    const growthData = ig.followers?.dailyData ?? ig.growth ?? []
    chartData = growthData.map(d => ({
      data: d.date,
      seguidores: d.followers || d.value
    }))
  }

  const topCampaigns = ads && ads.campaigns 
    ? [...ads.campaigns].sort((a, b) => (b.messages || 0) - (a.messages || 0)).slice(0, 4) 
    : []
  
  const igStats = ig ? [
    { label: 'Novos Seguidores', value: followers.toLocaleString('pt-BR'), color: 'text-emerald-400' },
    { label: 'Alcance', value: (ig.reach?.total ?? ig.weeklyReach ?? 0).toLocaleString('pt-BR'), color: 'text-amber-400' },
    { label: 'Visualizações', value: igImpressions.toLocaleString('pt-BR'), color: 'text-cyan-400' },
    { label: 'Cliques no Link', value: igClicks.toLocaleString('pt-BR'), color: 'text-pink-400' },
  ] : []

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-4 md:p-6 space-y-5 md:space-y-8">

        {/* Banner de Boas-Vindas para Clientes */}
        {isClient && (
          <section className="bg-gradient-to-r from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-xl p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-bold text-white mb-2">👋 Bem-vindo ao Gone Hub!</h2>
            <p className="text-sm text-[#c8c8c8] leading-relaxed max-w-4xl">
              Este é o seu painel central de resultados. Aqui você pode acompanhar o desempenho das suas campanhas de 
              tráfego pago, visualizar o crescimento do seu Instagram e, na aba <strong>Calendário</strong>, 
              acompanhar os criativos e posts que estamos produzindo. <br/><br/>
              Sempre que disponibilizarmos uma arte nova para análise, você será notificado no sininho ali em cima. 
              Fique à vontade para deixar seus comentários e feedbacks diretamente em cada post!
            </p>
          </section>
        )}

        {/* KPIs */}
        <section>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <p className="text-label">Visão geral do Cliente</p>
            <p className="text-xs text-[#888888]">{activeClient.name}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <MetricCard title="Investimento (Meta)" value={`R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="indigo" />
            <MetricCard title="Novos Seguidores" value={followers.toLocaleString('pt-BR')} icon={Users} color="purple" />
            <MetricCard title="Impressões Totais" value={totalImpressions.toLocaleString('pt-BR')} icon={Eye} color="cyan" />
            <MetricCard title="Mensagens Recebidas" value={messages.toLocaleString('pt-BR')} icon={TrendingUp} color="green" />
          </div>
        </section>

        {/* Gráfico */}
        {chartData.length > 0 && (
          <section>
            <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div>
                  <h2 className="text-section-title">Evolução de Desempenho</h2>
                  <p className="text-xs text-[#555555] mt-0.5">{ads ? 'Investimento e Impressões (Meta)' : 'Crescimento de Seguidores (IG)'}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1208" />
                  <XAxis dataKey="data" tick={{ fill: '#666666', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#666666', fontSize: 12 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#888888', paddingTop: '16px' }} />
                  {ads ? (
                    <>
                      <Line type="monotone" dataKey="investimento" name="Investimento (R$)" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="impressoes" name="Impressões" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </>
                  ) : (
                    <Line type="monotone" dataKey="seguidores" name="Seguidores" stroke="#10b981" strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Resumo rápido */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">

            <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4 md:p-6">
              <h3 className="text-section-title flex items-center gap-2 mb-4 md:mb-5">
                <TrendingUp size={15} className="text-orange-400" />
                Top Campanhas (Meta Ads)
              </h3>
              {topCampaigns.length > 0 ? (
                <div className="divide-y divide-slate-700/40">
                  {topCampaigns.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <p className="text-xs text-[#555555] mt-0.5">
                          R$ {Number(c.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · 
                          <span className="text-emerald-400 font-medium ml-1">{c.messages || 0} mensagens</span>
                        </p>
                      </div>
                      <span className="ml-4 text-xs px-2.5 py-1 bg-emerald-600/15 text-emerald-400 rounded-full font-medium flex-shrink-0">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#555555] py-4 text-center">Nenhuma campanha importada.</p>
              )}
            </div>

            <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4 md:p-6">
              <h3 className="text-section-title flex items-center gap-2 mb-4 md:mb-5">
                <Users size={15} className="text-purple-400" />
                Resumo Instagram
              </h3>
              {igStats.length > 0 ? (
                <div className="divide-y divide-slate-700/40">
                  {igStats.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <p className="text-sm text-[#888888]">{item.label}</p>
                      <p className={`text-sm font-semibold ml-4 flex-shrink-0 ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#555555] py-4 text-center">Nenhum dado do Instagram importado.</p>
              )}
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}
