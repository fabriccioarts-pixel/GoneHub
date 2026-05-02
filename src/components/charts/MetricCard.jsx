import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const COLOR_MAP = {
  indigo: {
    icon: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    accent: 'border-l-orange-400',
  },
  green: {
    icon: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20',
    accent: 'border-l-emerald-500',
  },
  amber: {
    icon: 'bg-amber-600/10 text-amber-400 border-amber-600/20',
    accent: 'border-l-amber-500',
  },
  red: {
    icon: 'bg-red-600/10 text-red-400 border-red-600/20',
    accent: 'border-l-red-500',
  },
  purple: {
    icon: 'bg-purple-600/10 text-purple-400 border-purple-600/20',
    accent: 'border-l-purple-500',
  },
  cyan: {
    icon: 'bg-cyan-600/10 text-cyan-400 border-cyan-600/20',
    accent: 'border-l-cyan-500',
  },
}

export default function MetricCard({ title, value, change, changeLabel, icon: Icon, color = 'indigo', prefix = '', suffix = '' }) {
  const { icon: iconClass, accent } = COLOR_MAP[color] ?? COLOR_MAP.indigo
  const isPositive = change > 0
  const isNeutral = change === 0 || change === undefined

  return (
    <div className={`bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 border-l-2 ${accent} rounded-xl p-6 hover:border-[#333333] hover:shadow-lg transition-all duration-200`}>
      {/* Label + Icon — tertiary layer */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-[#888888] uppercase tracking-widest leading-none">
          {title}
        </p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${iconClass}`}>
            <Icon size={16} />
          </div>
        )}
      </div>

      {/* Value — primary layer, maximum weight */}
      <p className="text-3xl font-bold text-white tracking-tight leading-none mb-3">
        {prefix}{value}{suffix}
      </p>

      {/* Trend — secondary layer */}
      {change !== undefined && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${isNeutral ? 'text-[#555555]' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isNeutral
            ? <Minus size={11} />
            : isPositive
              ? <TrendingUp size={11} />
              : <TrendingDown size={11} />
          }
          <span>{isPositive ? '+' : ''}{change}%</span>
          <span className="text-[#555555] font-normal">{changeLabel || 'vs mês anterior'}</span>
        </div>
      )}
    </div>
  )
}
