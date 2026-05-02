import { useState, useRef } from 'react'
import { FileDown, Printer, Eye, BarChart2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Header from '../components/layout/Header'
import { useClients } from '../context/ClientContext'

export default function Reports() {
  const { activeClient, getClientData, loading } = useClients()
  const imported = getClientData(activeClient?.id) || {}
  const adsReports = imported.ads || []
  const ads = Array.isArray(adsReports) ? adsReports[0] : adsReports
  const igReports = imported.instagram || []
  const ig = Array.isArray(igReports) ? igReports[0] : igReports
  const [period, setPeriod] = useState('Abril 2026')
  const reportRef = useRef(null)

  const followers = ig?.followers?.total ?? (typeof ig?.followers === 'number' ? ig.followers : 0)
  const igReach = ig?.reach?.total ?? (ig?.weeklyReach || 0)
  const igViews = ig?.views?.total ?? (ig?.weeklyImpressions || 0)
  const growthData = ig?.followers?.dailyData ?? (ig?.growth || [])

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(reportRef.current, {
      backgroundColor: '#080604',
      scale: 2,
      ignoreElements: (el) => el.tagName === 'ASIDE',
    })
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const imgData = canvas.toDataURL('image/png')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`relatorio-${activeClient?.name || 'cliente'}-${period}.pdf`)
  }

  if (loading) {
    return (
      <div>
        <Header title="Relatórios" />
        <div className="p-6 flex justify-center items-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!ads && !ig) {
    return (
      <div>
        <Header title="Relatórios" />
        <div className="p-6 flex flex-col items-center justify-center text-center mt-20 border-2 border-dashed border-[#2a2a2a] rounded-2xl py-20 bg-[#111111]/50">
          <BarChart2 size={48} className="text-[#333333] mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Relatório indisponível</h2>
          <p className="text-[#888888] max-w-md">Importe dados de anúncios ou de Instagram para este cliente para gerar um relatório exportável.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Relatórios" />
      <div className="p-4 md:p-6 space-y-4 md:space-y-5">

        {/* Controles */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400">
              <option>{ig?.dateRange || ads?.dateRange || 'Mês Atual'}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-[#cccccc] hover:bg-[#222222] rounded-lg text-sm transition-all">
              <Printer size={15} /> Imprimir
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-all">
              <FileDown size={15} /> Exportar PDF
            </button>
          </div>
        </div>

        {/* Relatório */}
        <div ref={reportRef} className="bg-[#111111] border border-[#2a2a2a]/50 rounded-2xl overflow-hidden">
          {/* Cabeçalho */}
          <div className="px-4 md:px-8 py-5 md:py-7 border-b border-[#2a2a2a]/50" style={{ background: 'linear-gradient(to right, rgba(67,20,7,0.6), rgba(74,4,78,0.4))' }}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">{activeClient?.name || 'Cliente'}</h1>
                <p className="text-[#888888] text-sm mt-1">Relatório de Performance · {ig?.dateRange || ads?.dateRange || 'Mês Atual'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#555555]">Gerado em</p>
                <p className="text-sm text-[#cccccc]">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="px-4 md:px-8 py-4 md:py-6 space-y-5 md:space-y-8">
            {/* KPIs */}
            <section>
              <h2 className="text-sm font-semibold text-[#888888] uppercase tracking-wider mb-3 md:mb-4">Resumo Executivo</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: 'Investimento em Ads', value: `R$ ${ads ? Number(ads.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`, change: '-', ok: true },
                  { label: 'Alcance do Instagram', value: igReach.toLocaleString('pt-BR'), change: '-', ok: true },
                  { label: 'Novos Seguidores', value: `+${followers.toLocaleString('pt-BR')}`, change: '-', ok: true },
                  { label: 'Visualizações (Imp)', value: igViews.toLocaleString('pt-BR'), change: '-', ok: true },
                ].map((kpi, i) => (
                  <div key={i} className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-[#2a2a2a]/50">
                    <p className="text-xs text-[#555555] mb-1">{kpi.label}</p>
                    <p className="text-xl font-bold text-white">{kpi.value}</p>
                    <p className={`text-xs mt-1 text-[#666]`}>Dados consolidados do período</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Gráfico */}
            <section>
              <h2 className="text-sm font-semibold text-[#888888] uppercase tracking-wider mb-4">Crescimento de Seguidores</h2>
              <div className="bg-[#1a1a1a]/40 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growthData.map(d => ({ ...d, followers: d.followers !== undefined ? d.followers : d.value }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1208" />
                    <XAxis dataKey="date" tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="followers" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Campanhas */}
            {ads && ads.campaigns && (
              <section>
                <h2 className="text-sm font-semibold text-[#888888] uppercase tracking-wider mb-4">Performance de Campanhas</h2>
                <div className="overflow-hidden rounded-xl border border-[#2a2a2a]/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1a1a1a]/60 border-b border-[#2a2a2a]/50">
                        {['Campanha', 'Investimento', 'Resultados', 'Custo/Res'].map(h => (
                          <th key={h} className="text-left text-[10px] text-[#555555] font-bold pb-3 pt-3 px-4 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f1f1f]">
                      {ads.campaigns.map(c => (
                        <tr key={c.id} className="bg-[#111111]">
                          <td className="py-3 px-4 text-white font-medium text-xs">{c.name}</td>
                          <td className="py-3 px-4 text-[#cccccc] text-xs whitespace-nowrap">R$ {Number(c.spend).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-[#cccccc] text-xs">{Number(c.messages || 0).toLocaleString('pt-BR')} msg</td>
                          <td className="py-3 px-4 text-[#cccccc] text-xs whitespace-nowrap">R$ {Number(c.costPerMessage || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Rodapé */}
            <div className="pt-4 border-t border-[#1f1f1f] flex items-center justify-between text-xs text-[#444444]">
              <span>Gone Hub · Relatório gerado automaticamente</span>
              <span>{activeClient?.ig_handle}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
