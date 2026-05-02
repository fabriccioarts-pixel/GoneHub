# CLAUDE.md

Contexto para Claude Code ao trabalhar neste projeto.

## Visão Geral

**TrafficHub** — dashboard B2B para agências/freelancers de tráfego pago gerenciarem anúncios Meta (Facebook/Instagram) e crescimento orgânico de múltiplos clientes. Ainda em modo demo (todos os dados são mockados).

## Comandos

```bash
# Da pasta raiz do projeto
npm run dev       # Servidor de desenvolvimento (Vite + HMR)
npm run build     # Build de produção
npm run lint      # ESLint
npm run preview   # Preview do build de produção
```

## Variáveis de Ambiente

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase é opcional — o cliente em `src/lib/supabase.js` retorna `null` graciosamente se as vars não estiverem configuradas.

## Arquitetura

**Roteamento** — React Router DOM v7 com `BrowserRouter`. Rotas definidas em `App.jsx`:
- `/` → Dashboard
- `/ads` → AdsMonitor
- `/instagram` → InstagramGrowth
- `/calendario` → ContentCalendar
- `/relatorios` → Reports
- `/clientes` → Clients
- `/configuracoes` → Settings

**Estado Global** — `src/context/ClientContext.jsx` gerencia a lista de clientes e o cliente ativo (`activeClient`). Não usa Redux nem Zustand — só Context API nativo.

**Layout** — Sidebar fixa de 264px + área de conteúdo principal. Todos os layouts envolvidos por `<ClientProvider>`. Tema dark: fundo `slate-950`.

**Dados** — Tudo mockado em `src/lib/metaApi.js` e `src/lib/instagramApi.js`. As funções reais de API existem mas precisam de tokens reais. Substituir mocks quando integrar backend.

**Charts** — Recharts para todas as visualizações. Tooltips customizados com fundo `#0f172a`. Animações de grid desabilitadas.

**Export PDF** — `Reports.jsx` usa jsPDF + html2canvas. Fundo forçado para `#0f172a` no export.

**PWA** — Configurado via `vite-plugin-pwa` com Workbox. Cache de 24h para chamadas à API do Supabase (NetworkFirst).

## Arquivos-Chave

| Caminho | Propósito |
|---------|-----------|
| `src/App.jsx` | Router, layout global, definição de rotas |
| `src/context/ClientContext.jsx` | Estado global: clientes CRUD, activeClient |
| `src/lib/supabase.js` | Cliente Supabase (env vars) |
| `src/lib/metaApi.js` | Funções Meta Ads API + mock data |
| `src/lib/instagramApi.js` | Funções Instagram Graph API + mock data |
| `src/components/layout/Sidebar.jsx` | Nav + seletor de cliente ativo |
| `src/components/layout/Header.jsx` | Header sticky com nome do cliente |
| `src/components/charts/MetricCard.jsx` | Card reutilizável de KPI |
| `vite.config.js` | Plugins: React, Tailwind v4, PWA |

## Design System

**Cores:**
- Primary: Indigo `#6366f1`
- Backgrounds: Slate 900 `#0f172a`, Slate 800 `#1e293b`
- Acents: Emerald (sucesso), Amber (aviso), Red (erro), Purple, Cyan, Pink

**Fontes:** Inter (fallback: system-ui, sans-serif)

**MetricCard colors:** `indigo | green | amber | purple | cyan | red` — passados via prop `color`.

## Estado Atual do Projeto

**Funcionando:**
- CRUD de clientes (UI completa, estado em memória)
- Troca de cliente ativo
- Todos os dashboards renderizando com dados mock
- Export PDF/Print em Reports
- PWA configurado

**Pendente:**
- Conectar Supabase (persistência de clientes)
- Autenticação Meta Ads (tokens reais)
- Autenticação Instagram Graph API
- Substituir todos os mock data por chamadas reais
- Páginas ContentCalendar e Settings (existem mas estão incompletas)
- Error handling e loading states
- Toast notifications
