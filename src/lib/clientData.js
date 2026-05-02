function strHash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h || 1
}

function createRng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    s = s >>> 0
    return s / 4294967296
  }
}

export function generateClientData(clientId, igHandle) {
  const seed = strHash(String(clientId || 'default'))
  const r = createRng(seed)

  // Ads
  const spend = 800 + r() * 3200
  const cpm = 8 + r() * 14
  const ctr = 0.6 + r() * 1.8
  const cpc = cpm / (ctr * 10)
  const impressions = Math.round((spend / cpm) * 1000)
  const reach = Math.round(impressions * (0.45 + r() * 0.35))

  // Período de referência: abril de 2026 (01/04 a 30/04)
  const refStart = new Date(2026, 3, 1) // 1º de abril de 2026

  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(refStart)
    d.setDate(1 + i)
    const daySpend = Math.round((spend / 30) * (0.7 + r() * 0.6))
    return {
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      spend: daySpend,
      impressions: Math.round((daySpend / cpm) * 1000),
    }
  })

  const statusPool = ['ACTIVE', 'ACTIVE', 'PAUSED']
  const campaigns = [
    {
      id: '1',
      name: 'Campanha Conversão – Produto A',
      status: 'ACTIVE',
      spend: (spend * 0.4).toFixed(2),
      impressions: String(Math.round(impressions * 0.4)),
      ctr: (ctr * 1.2).toFixed(2),
    },
    {
      id: '2',
      name: 'Campanha Tráfego – Blog',
      status: 'ACTIVE',
      spend: (spend * 0.25).toFixed(2),
      impressions: String(Math.round(impressions * 0.32)),
      ctr: ctr.toFixed(2),
    },
    {
      id: '3',
      name: 'Remarketing – Carrinho',
      status: statusPool[Math.floor(r() * statusPool.length)],
      spend: (spend * 0.35).toFixed(2),
      impressions: String(Math.round(impressions * 0.28)),
      ctr: (ctr * 0.82).toFixed(2),
    },
  ]

  const ads = {
    spend: spend.toFixed(2),
    impressions: String(impressions),
    reach: String(reach),
    cpm: cpm.toFixed(2),
    cpc: cpc.toFixed(2),
    ctr: ctr.toFixed(2),
    campaigns,
    daily,
  }

  // Instagram
  const r2 = createRng(seed ^ 0xdeadbeef)
  const baseFollowers = Math.round(2000 + r2() * 50000)
  const engagementRate = parseFloat((1.5 + r2() * 6).toFixed(1))
  const weeklyReach = Math.round(baseFollowers * (1.2 + r2() * 2))
  const weeklyImpressions = Math.round(weeklyReach * (1.3 + r2() * 0.8))

  const growthRng = createRng(seed ^ 0xabcd1234)
  let followersCursor = Math.round(baseFollowers * 0.88)
  // Semanas de abril de 2026: 01/04, 08/04, 15/04, 22/04, 30/04
  const aprilWeekDays = [1, 8, 15, 22, 30]
  const growth = aprilWeekDays.map((day) => {
    const d = new Date(2026, 3, day)
    followersCursor += Math.round(baseFollowers * 0.028 * (0.5 + growthRng()))
    return {
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      followers: followersCursor,
    }
  })

  const postTypes = ['IMAGE', 'REELS', 'CAROUSEL']
  const postRng = createRng(seed ^ 0x12345678)
  // Posts recentes dentro de abril de 2026: 30/04, 28/04, 25/04, 22/04
  const postDays = [30, 28, 25, 22]
  const recentPosts = postDays.map((day, i) => {
    const d = new Date(2026, 3, day)
    const likes = Math.round(baseFollowers * (0.015 + postRng() * 0.07))
    const comments = Math.round(likes * (0.03 + postRng() * 0.08))
    return {
      id: String(i + 1),
      type: postTypes[Math.floor(postRng() * 3)],
      likes,
      comments,
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      thumbnail: null,
    }
  })

  const ig = {
    username: igHandle || '@cliente',
    followers: growth[4].followers,
    following: Math.round(80 + r2() * 800),
    posts: Math.round(40 + r2() * 400),
    engagementRate,
    growth,
    weeklyReach,
    weeklyImpressions,
    recentPosts,
  }

  // Dashboard overview (4 semanas)
  const overviewRng = createRng(seed ^ 0xfeedcafe)
  const weeklySpend = spend / 4
  const overviewData = growth.slice(0, 4).map((g, i) => ({
    semana: `Sem ${i + 1}`,
    investimento: Math.round(weeklySpend * (0.7 + overviewRng() * 0.6)),
    seguidores: g.followers,
    alcance: Math.round(weeklyReach * (0.65 + overviewRng() * 0.5)),
  }))

  return { ads, ig, overviewData }
}
