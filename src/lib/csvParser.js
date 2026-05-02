// Column name mappings (PT-BR and EN) from Meta Ads Manager exports
const ADS_MAP = {
  campaign:         ['nome da campanha', 'campaign name'],
  ad:               ['nome do anúncio', 'ad name', 'nome do conjunto de anúncios', 'ad set name'],
  status:           ['veiculação', 'entrega', 'delivery', 'status'],
  spend:            ['valor usado', 'amount spent', 'gasto'],
  impressions:      ['impressões', 'impressions'],
  reach:            ['alcance', 'reach'],
  cpm:              ['cpm (custo', 'cpm (cost', 'cpm'],
  cpc:              ['cpc (custo por clique no link)', 'cpc (cost per link click)', 'cpc (todos) (brl)', 'cpc'],
  ctr:              ['ctr (taxa de cliques no link)', 'ctr (link click', 'ctr (todos)', 'ctr'],
  clicks:           ['cliques no link', 'link clicks', 'cliques (todos)', 'clicks'],
  frequency:        ['frequência', 'frequency'],
  date:             ['data', 'date', 'período', 'period', 'dia', 'day'],
  messages:         ['total de contatos por mensagem', 'contatos por mensagem', 'messaging conversations'],
  results:          ['resultados', 'results'],              // coluna genérica de resultados do Meta
  result_indicator: ['indicador de resultados', 'result indicator', 'optimization goal'], // indica o tipo do resultado
  purchases:        ['compras', 'purchases'],
  followers:        ['seguidores', 'followers', 'novos seguidores', 'new followers', 'primary'],
  report_start:     ['início dos relatórios', 'reporting starts'],
  report_end:       ['encerramento dos relatórios', 'reporting ends'],
}

// Columns that should never be used as campaign name or metrics (skip entirely)
const SKIP_COLUMNS = ['configuração de atribuição', 'tipo de orçamento',
  'orçamento do conjunto', 'término', 'shop_clicks', 'custo por resultado',
  'custo por visualização', 'visualizações da página']

const STATUS_MAP = {
  'active': 'ACTIVE', 'ativa': 'ACTIVE', 'ativo': 'ACTIVE',
  'paused': 'PAUSED', 'pausada': 'PAUSED', 'pausado': 'PAUSED',
  'archived': 'ARCHIVED', 'arquivada': 'ARCHIVED',
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        // Verifica se é aspas escapada ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'  // adiciona uma aspas literal
          i += 2          // pula as duas aspas
          continue
        } else {
          inQuotes = false  // fecha o campo quoted
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true   // abre campo quoted
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    i++
  }

  result.push(current.trim())
  return result
}

function normalizeDate(s) {
  if (!s) return null
  // Pega apenas a parte da data se houver horário (ex: "04/22/2026 04:14" -> "04/22/2026")
  let clean = String(s).split(' ')[0].toLowerCase().replace(/de /g, '').replace(/\./g, '').trim()
  
  // Tenta Date padrão (ISO ou MM/DD/YYYY dependendo do browser)
  const d = new Date(clean)
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, '0')
    // Verifica se o ano é razoável
    if (d.getFullYear() > 2000) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
  }

  // Suporte para formatos BR: DD/MM/YYYY ou DD de MMM de YYYY
  const ptMonths = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
  }

  // Regex para DD/MM/YYYY ou MM/DD/YYYY
  const matchSlash = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchSlash) {
    const pad = (n) => String(n).padStart(2, '0')
    let n1 = parseInt(matchSlash[1])
    let n2 = parseInt(matchSlash[2])
    const year = matchSlash[3]

    let day, month
    // Se o segundo número for > 12, ele só pode ser o dia (formato MM/DD/YYYY)
    if (n2 > 12) {
      day = n2
      month = n1
    } else {
      day = n1
      month = n2
    }
    
    return `${year}-${pad(month)}-${pad(day)}`
  }

  // Regex para "03 abr 2026"
  const matchWords = clean.match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/)
  if (matchWords) {
    const month = ptMonths[matchWords[2]]
    if (month) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${matchWords[3]}-${month}-${pad(matchWords[1])}`
    }
  }

  return s
}

function cleanNumber(val) {
  if (!val) return 0;
  let s = String(val).trim().replace(/[R$\s%]/g, '');
  
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    if (s.split(',').length > 2) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (lastDot > -1) {
    if (s.split('.').length > 2) {
      s = s.replace(/\./g, '');
    }
  }
  
  return parseFloat(s) || 0;
}

function matchColumn(header, keys) {
  const h = header.toLowerCase().trim()
  // Check if this column should be skipped entirely
  if (SKIP_COLUMNS.some(s => h.includes(s.toLowerCase()))) return false
  return keys.some(k => h.includes(k.toLowerCase()))
}

function buildColumnIndex(headers) {
  const idx = {}
  headers.forEach((h, i) => {
    const hLower = h.toLowerCase().trim()
    // Skip date-range and non-metric columns
    if (SKIP_COLUMNS.some(s => hLower.includes(s.toLowerCase()))) return
    for (const [field, keys] of Object.entries(ADS_MAP)) {
      if (!(field in idx) && keys.some(k => hLower.includes(k.toLowerCase()))) idx[field] = i
    }
  })
  return idx
}

export function parseMetaAdsCSV(text) {
  let lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('Arquivo CSV inválido ou vazio.')

  // Remove a linha "sep=," que o Excel adiciona em CSVs do Meta Ads
  if (lines[0].trim().toLowerCase().startsWith('sep=')) {
    lines = lines.slice(1)
  }

  const headers = parseCSVLine(lines[0])
  const idx = buildColumnIndex(headers)

  if (idx.spend === undefined && idx.impressions === undefined) {
    throw new Error('Formato não reconhecido. Exporte o relatório de Anúncios do Meta Ads Manager.')
  }

  const campaigns = []
  const creativesMap = {}
  let totalSpend = 0, totalImpressions = 0, totalReach = 0, totalClicks = 0, totalMessages = 0, totalPurchases = 0
  const daily = {}
  let globalStartDate = null
  let globalEndDate = null

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i])
    if (row.every(c => !c)) continue

    if (!globalStartDate && idx.report_start !== undefined && row[idx.report_start]) {
      globalStartDate = row[idx.report_start]
    }
    if (!globalEndDate && idx.report_end !== undefined && row[idx.report_end]) {
      globalEndDate = row[idx.report_end]
    }

    const spend            = cleanNumber(row[idx.spend])
    const impressions       = cleanNumber(row[idx.impressions])
    const reach             = cleanNumber(row[idx.reach])
    const ctr               = cleanNumber(row[idx.ctr])
    const cpc               = cleanNumber(row[idx.cpc])
    const cpm               = cleanNumber(row[idx.cpm])
    const clicks            = cleanNumber(row[idx.clicks])
    const purchases         = cleanNumber(row[idx.purchases])

    // Mensagens: pode vir como coluna dedicada OU como "Resultados" quando o indicador é mensagens
    const rawIndicator      = idx.result_indicator !== undefined ? (row[idx.result_indicator] || '').toLowerCase() : ''
    const isMessagingResult = rawIndicator.includes('messaging') || rawIndicator.includes('mensagem') || rawIndicator.includes('conversation')
    const messagesFromCol   = idx.messages !== undefined ? cleanNumber(row[idx.messages]) : 0
    const messagesFromResult= isMessagingResult && idx.results !== undefined ? cleanNumber(row[idx.results]) : 0
    const messages          = messagesFromCol || messagesFromResult

    // Extrai nome da campanha e limpa aspas extras
    let name = idx.campaign !== undefined ? (row[idx.campaign] || '').trim() : `Campanha ${i}`
    name = name.replace(/^["']+|["']+$/g, '').trim()
    // Pula linhas onde o "nome" é uma data (2026-04-01), um número ou vazio — são linhas de totais
    if (!name || /^\d{4}-\d{2}-\d{2}/.test(name) || /^\d+$/.test(name)) continue

    let adName = idx.ad !== undefined ? (row[idx.ad] || '').trim() : null
    if (adName) adName = adName.replace(/^["']+|["']+$/g, '').trim()
    if (adName && (/^\d{4}-\d{2}-\d{2}/.test(adName) || /^\d+$/.test(adName))) adName = null

    const rawStatus   = idx.status !== undefined ? row[idx.status]?.toLowerCase() : ''
    const status      = STATUS_MAP[rawStatus] || 'ACTIVE'
    const date        = idx.date !== undefined ? row[idx.date] : null


    totalSpend       += spend
    totalImpressions += impressions
    totalReach       += reach
    totalClicks      += clicks
    totalMessages    += messages
    totalPurchases   += purchases

    if (date) {
      if (!daily[date]) daily[date] = { date, spend: 0, impressions: 0 }
      daily[date].spend       += spend
      daily[date].impressions += impressions
    }

    if (name) {
      const existing = campaigns.find(c => c.name === name)
      if (existing) {
        existing.spend       += spend
        existing.impressions += impressions
        existing.clicks      += clicks
        existing.messages    += messages
        existing.purchases   += purchases
      } else {
        campaigns.push({ id: String(i), name, status, spend, impressions, clicks, messages, purchases, ctr, cpc, cpm })
      }
    }

    if (adName) {
      if (creativesMap[adName]) {
        creativesMap[adName].spend += spend
        creativesMap[adName].impressions += impressions
        creativesMap[adName].clicks += clicks
        creativesMap[adName].messages += messages
        creativesMap[adName].purchases += purchases
      } else {
        creativesMap[adName] = { id: `ad-${i}`, name: adName, status, spend, impressions, clicks, messages, purchases, ctr, cpc, cpm }
      }
    }
  }

  const creatives = Object.values(creativesMap).map(c => {
    const c_ctr = c.impressions > 0 && c.clicks > 0 ? ((c.clicks / c.impressions) * 100) : c.ctr
    const c_cpc = c.clicks > 0 ? (c.spend / c.clicks) : c.cpc
    const c_cpm = c.impressions > 0 ? ((c.spend / c.impressions) * 1000) : c.cpm
    const c_costPerMessage = c.messages > 0 ? (c.spend / c.messages) : 0
    return { ...c, ctr: c_ctr, cpc: c_cpc, cpm: c_cpm, costPerMessage: c_costPerMessage }
  })

  const cpm = totalImpressions > 0 ? ((totalSpend / totalImpressions) * 1000).toFixed(2) : '0.00'
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00'
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'
  const costPerMessage = totalMessages > 0 ? (totalSpend / totalMessages).toFixed(2) : '0.00'

  return {
    type: 'ads',
    dateRange: globalStartDate && globalEndDate ? `${globalStartDate} a ${globalEndDate}` : null,
    spend: totalSpend.toFixed(2),
    impressions: String(Math.round(totalImpressions)),
    reach: String(Math.round(totalReach)),
    messages: String(Math.round(totalMessages)),
    purchases: String(Math.round(totalPurchases)),
    cpm, cpc, ctr, costPerMessage,
    creatives: creatives.map(c => ({
      ...c,
      spend: c.spend.toFixed(2),
      impressions: String(Math.round(c.impressions)),
      messages: String(Math.round(c.messages)),
      ctr: c.ctr?.toFixed(2) || '0.00',
      cpc: c.cpc?.toFixed(2) || '0.00',
      cpm: c.cpm?.toFixed(2) || '0.00',
      costPerMessage: c.costPerMessage?.toFixed(2) || '0.00',
    })),
    campaigns: campaigns.map(c => ({
      ...c,
      spend: c.spend.toFixed(2),
      impressions: String(Math.round(c.impressions)),
      messages: String(Math.round(c.messages)),
      costPerMessage: (c.messages > 0 ? (c.spend / c.messages).toFixed(2) : '0.00'),
      ctr: (c.impressions > 0 && c.clicks > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : c.ctr?.toFixed(2)) || ctr,
    })),
    daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function parseInstagramCSV(text) {
  let lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('Arquivo CSV inválido ou vazio.')

  // Remove a linha "sep=," se existir
  if (lines[0].trim().toLowerCase().startsWith('sep=')) {
    lines = lines.slice(1)
  }
  
  let metricLabel = 'Desconhecida'
  // Se não tem vírgula na primeira linha, é o título do Meta (ex: "Visualizações", "Alcance")
  if (!lines[0].includes(',')) {
    metricLabel = lines[0].replace(/"/g, '').trim()
    lines = lines.slice(1)
  }

  const headers = parseCSVLine(lines[0])
  const idx = buildColumnIndex(headers)
  
  // O Meta Business Suite usa sempre "Primary" ou "Seguidores" como a coluna de valores
  const valColIdx = idx.followers !== undefined ? idx.followers : headers.findIndex(h => h.toLowerCase() === 'primary')
  if (valColIdx === -1 && idx.impressions === undefined) {
    // Fallback: se for um arquivo de posts (tem coluna identificação do post), não joga erro aqui
    if (idx.id === undefined) {
      throw new Error('Formato não reconhecido. Exporte o relatório via Meta Business Suite.')
    }
  }

  const dailyData = []
  let totalValue = 0

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i])
    if (row.every(c => !c)) continue
    
    // Se o index da data não foi achado, tenta achar no conteúdo da linha
    let rawDate = idx.date !== undefined ? row[idx.date] : null
    if (!rawDate) {
      const foundIdx = row.findIndex(cell => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(cell))
      if (foundIdx !== -1) {
        idx.date = foundIdx
        rawDate = row[idx.date]
      }
    }

    const date = normalizeDate(rawDate || `Sem ${i}`)
    const value = cleanNumber(row[valColIdx])
    
    dailyData.push({ date, value })
    totalValue += value
  }

  let metricType = 'other'
  const lbl = metricLabel.toLowerCase()
  if (lbl.includes('seguidor')) metricType = 'followers'
  else if (lbl.includes('alcance')) metricType = 'reach'
  else if (lbl.includes('clique')) metricType = 'clicks'
  else if (lbl.includes('visualiza')) metricType = 'views'
  else if (lbl.includes('visita')) metricType = 'visits'

  const startDate = dailyData.length > 0 ? dailyData[0].date : null
  const endDate = dailyData.length > 0 ? dailyData[dailyData.length - 1].date : null

  return {
    type: 'instagram',
    metricType,
    metricLabel,
    total: totalValue,
    dailyData,
    dateRange: startDate && endDate ? `${startDate} a ${endDate}` : null
  }
}

function normalizePostType(raw) {
  const r = raw.toLowerCase()
  if (r.includes('reel') || r.includes('vídeo')) return 'Reel'
  if (r.includes('carrossel') || r.includes('carousel') || r.includes('album')) return 'Carrossel'
  if (r.includes('story') || r.includes('storie')) return 'Story'
  if (r.includes('imagem') || r.includes('image') || r.includes('photo') || r.includes('foto')) return 'Imagem'
  return raw || 'Post'
}

export function parseInstagramPostsCSV(text) {
  let lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('Arquivo CSV inválido ou vazio.')

  // Remove a linha "sep=," se existir
  if (lines[0].trim().toLowerCase().startsWith('sep=')) {
    lines = lines.slice(1)
  }

  const headers = parseCSVLine(lines[0])
  const idx = {}
  headers.forEach((h, i) => {
    const hLower = h.toLowerCase().trim()
    if (hLower.includes('identificação do post') || hLower === 'post id') idx.id = i
    if (hLower.includes('descrição') || hLower.includes('legenda') || hLower.includes('legend')) idx.description = i
    // "Horário de publicação" é a data real; "Data" é coluna de agrupamento (Total/diário)
    if (hLower.includes('horário de publicação') || hLower.includes('publication time') || hLower.includes('published')) idx.pubDate = i
    if (hLower === 'data' || hLower === 'date') idx.dateAgg = i
    if (hLower.includes('link permanente') || hLower.includes('permalink')) idx.url = i
    if (hLower.includes('tipo de post') || hLower.includes('post type')) idx.type = i
    if (hLower.includes('visualizações') || hLower.includes('impressions') || hLower.includes('views')) idx.views = i
    if (hLower.includes('alcance') || hLower.includes('reach')) idx.reach = i
    if (hLower.includes('curtidas') || hLower.includes('likes')) idx.likes = i
    if (hLower.includes('comentários') || hLower.includes('comments')) idx.comments = i
    if (hLower.includes('compartilhamentos') || hLower.includes('shares')) idx.shares = i
    if (hLower.includes('salvamentos') || hLower.includes('saves')) idx.saves = i
    if (hLower.includes('seguimentos') || hLower.includes('follows') || hLower.includes('new followers')) idx.follows = i
    if (hLower.includes('nome de usuário') || hLower.includes('username')) idx.username = i
    if (hLower.includes('duração') || hLower.includes('duration')) idx.duration = i
  })

  // Usa "Horário de publicação" como data; fallback para coluna "Data" se não existir
  idx.date = idx.pubDate ?? idx.dateAgg

  // Parser robusto: lida com quebras de linha em descrições entre aspas
  const allRows = parseFullCSV(text)
  const dataRows = allRows.slice(1)

  // Fallback: localiza coluna de data pelo conteúdo se ainda não encontrada
  if (idx.date === undefined) {
    for (let r = 0; r < Math.min(5, dataRows.length); r++) {
      const foundIdx = dataRows[r].findIndex(cell => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(cell))
      if (foundIdx !== -1) { idx.date = foundIdx; break }
    }
  }

  const posts = []
  let totalViews = 0, totalReach = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalSaves = 0, totalFollows = 0
  let minDate = null, maxDate = null

  dataRows.forEach((row) => {
    if (row.length < 5) return

    // Quando o Meta exporta breakdown diário, cada post tem N linhas diárias + 1 "Total"
    // Só processamos a linha "Total" para não duplicar métricas
    if (idx.dateAgg !== undefined && row[idx.dateAgg] && row[idx.dateAgg].toLowerCase() !== 'total') return

    const postDateStr = row[idx.date] || ''
    const normalized = normalizeDate(postDateStr)
    if (normalized) {
      const d = new Date(normalized + 'T12:00:00')
      if (!isNaN(d.getTime())) {
        if (!minDate || d < minDate) minDate = d
        if (!maxDate || d > maxDate) maxDate = d
      }
    }

    const rawType = (row[idx.type] || '').trim()
    const postType = normalizePostType(rawType)

    const post = {
      id: row[idx.id] || String(Math.random()),
      description: row[idx.description] || '',
      date: normalized || postDateStr,
      url: row[idx.url] || '',
      type: postType,
      duration: idx.duration !== undefined ? cleanNumber(row[idx.duration]) : 0,
      views: cleanNumber(row[idx.views]),
      reach: cleanNumber(row[idx.reach]),
      likes: cleanNumber(row[idx.likes]),
      comments: cleanNumber(row[idx.comments]),
      shares: cleanNumber(row[idx.shares]),
      saves: cleanNumber(row[idx.saves]),
      follows: idx.follows !== undefined ? cleanNumber(row[idx.follows]) : 0,
    }

    totalViews += post.views
    totalReach += post.reach
    totalLikes += post.likes
    totalComments += post.comments
    totalShares += post.shares
    totalSaves += post.saves
    totalFollows += post.follows

    posts.push(post)
  })

  let dateRange = 'Período do Relatório'
  if (minDate && maxDate) {
    const pad = (n) => String(n).padStart(2, '0')
    const startStr = `${minDate.getFullYear()}-${pad(minDate.getMonth() + 1)}-${pad(minDate.getDate())}`
    const endStr = `${maxDate.getFullYear()}-${pad(maxDate.getMonth() + 1)}-${pad(maxDate.getDate())}`
    dateRange = `${startStr} a ${endStr}`
  }

  return {
    type: 'instagram',
    metricType: 'posts',
    dateRange,
    posts: posts.sort((a, b) => b.reach - a.reach), // Ordenar por alcance por padrão
    summary: {
      views: totalViews,
      reach: totalReach,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      saves: totalSaves,
      follows: totalFollows
    }
  }
}

// Parser robusto para CSV com quebras de linha em campos entre aspas
function parseFullCSV(text) {
  const result = []
  let row = []
  let field = ''
  let inQuotes = false

  // Remove o prefixo "sep=," se houver
  let content = text.trim()
  if (content.toLowerCase().startsWith('sep=')) {
    content = content.substring(content.indexOf('\n') + 1)
  }

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(field)
        field = ''
      } else if (char === '\n') {
        row.push(field)
        result.push(row)
        row = []
        field = ''
      } else {
        field += char
      }
    }
  }
  if (row.length > 0 || field.length > 0) {
    row.push(field)
    result.push(row)
  }
  return result
}

export function detectAndParse(text) {
  const t = text.toLowerCase()
  if (t.includes('campanha') || t.includes('campaign')) return parseMetaAdsCSV(text)
  if (t.includes('identificação do post') || t.includes('post id') || t.includes('link permanente')) return parseInstagramPostsCSV(text)
  return parseInstagramCSV(text)
}
