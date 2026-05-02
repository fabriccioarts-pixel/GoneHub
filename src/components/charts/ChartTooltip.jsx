export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-sm shadow-lg">
      <p className="text-[#888888] text-xs mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-[#cccccc]">{p.name}:</span>
          <span className="font-medium">{typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}</span>
        </p>
      ))}
    </div>
  )
}
