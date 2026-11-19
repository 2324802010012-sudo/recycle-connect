import { useState } from 'react'
import { Activity, ChartNoAxesColumnIncreasing, PieChart } from 'lucide-react'

const statuses = [
  { key: 'CHO_NHAN', label: 'Chờ nhận', color: '#e6a94a' },
  { key: 'DA_NHAN', label: 'Đã nhận', color: '#5686d3' },
  { key: 'HOAN_THANH', label: 'Hoàn thành', color: '#167d61' },
]
const number = new Intl.NumberFormat('vi-VN')
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 })
const panel = 'min-w-0 rounded-3xl border bg-white p-5 shadow-sm sm:p-6'

function ChartHeading({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-2.5 text-base font-semibold text-[#163c30] sm:text-lg">
      <Icon size={20} className="shrink-0 text-[#167d61]" aria-hidden="true" />
      {children}
    </h3>
  )
}

function StatusChart({ total, byStatus }) {
  const shares = statuses.map(({ key, label, color }) => {
    const count = byStatus[key] ?? 0
    return { key, label, color, count, share: total ? count / total : 0 }
  })
  const gradient = shares.map((item, index) => {
    const start = shares.slice(0, index).reduce((sum, segment) => sum + segment.share, 0)
    return `${item.color} ${start * 100}% ${(start + item.share) * 100}%`
  }).join(', ')

  return (
    <section className={panel}>
      <ChartHeading icon={PieChart}>Phân bố trạng thái</ChartHeading>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:flex-nowrap">
        <div
          className="grid size-36 shrink-0 place-items-center rounded-full"
          style={{ background: total ? `conic-gradient(${gradient})` : '#edf2ef' }}
        >
          <div className="grid size-28 place-content-center rounded-full bg-white text-center">
            <strong className="text-2xl tabular-nums text-[#163c30]">{number.format(total)}</strong>
            <span className="text-xs text-slate-600">Tổng số đơn</span>
          </div>
        </div>
        <ul className="min-w-36 flex-1 space-y-3 text-sm">
          {shares.map(item => (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
              <span className="whitespace-nowrap tabular-nums">
                <strong>{number.format(item.count)}</strong>
                <span className="ml-1 text-xs text-slate-600">({percent.format(item.share)})</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ActivityChart({ byDay }) {
  const [period, setPeriod] = useState(7)
  const days = byDay.slice(-period)
  const max = Math.max(1, ...days.flatMap(day => [day.created, day.completed]))
  const hasActivity = days.some(day => day.created > 0 || day.completed > 0)

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChartHeading icon={Activity}>Hoạt động theo ngày</ChartHeading>
        <div className="flex gap-1 rounded-xl bg-[#eef4f1] p-1" aria-label="Khoảng thời gian">
          {[7, 14].map(count => (
            <button key={count} type="button" aria-pressed={period === count} onClick={() => setPeriod(count)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === count ? 'bg-white text-[#12644e] shadow-sm' : 'text-slate-600 hover:text-[#12644e]'}`}>
              {count} ngày
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-700">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#167d61]" />Đơn mới</span>
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#5686d3]" />Đơn hoàn thành</span>
      </div>
      {hasActivity ? (
        <ul className="mt-5 grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day, index) => {
            const label = day.date.slice(5).split('-').reverse().join('/')
            const summary = `${label}, ${day.created} đơn mới, ${day.completed} đơn hoàn thành`
            const showLabel = period === 7 || index === days.length - 1
              || (index % 3 === 0 && index < days.length - 2)
            return (
              <li key={day.date} className="min-w-0 text-center" title={summary}>
                <span className="sr-only">{summary}</span>
                <div aria-hidden="true" className="flex h-36 items-end justify-center gap-0.5 border-b bg-gradient-to-t from-[#f2f7f4] to-white px-0.5">
                  <span className="w-2/5 max-w-6 rounded-t-sm bg-[#167d61]" style={{ height: `${day.created / max * 100}%` }} />
                  <span className="w-2/5 max-w-6 rounded-t-sm bg-[#5686d3]" style={{ height: `${day.completed / max * 100}%` }} />
                </div>
                <span aria-hidden="true" className="mt-2 block text-[10px] tabular-nums text-slate-600 sm:text-xs">
                  {showLabel ? label : '\u00a0'}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-5 grid min-h-36 place-items-center rounded-2xl bg-[#f5f8f6] p-4 text-center text-sm text-slate-600">
          Chưa có hoạt động trong khoảng thời gian này.
        </p>
      )}
    </section>
  )
}

export default function AdminCharts({ stats, wasteLabels }) {
  const { total, byStatus, byWasteType = [], byDay = [] } = stats
  const sortedWaste = [...byWasteType].sort((a, b) => b.count - a.count)
  return (
    <div className="space-y-5">
      {byDay.length > 0 && <ActivityChart byDay={byDay} />}
      <div className="grid gap-5 lg:grid-cols-2">
        <StatusChart total={total} byStatus={byStatus} />
        {sortedWaste.length > 0 && (
          <section className={panel}>
            <ChartHeading icon={ChartNoAxesColumnIncreasing}>Yêu cầu theo loại rác</ChartHeading>
            <ul className="mt-5 space-y-3">
              {sortedWaste.map(({ wasteType, count }) => (
                <li key={wasteType}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{wasteLabels[wasteType] ?? wasteType}</span>
                    <span className="font-semibold tabular-nums">{number.format(count)}</span>
                  </div>
                  <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[#edf2ef]">
                    <div className="h-full rounded-full bg-[#167d61]" style={{ width: `${total ? count / total * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
