export function startOfToday(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dayDiff(dateString: string | null | undefined, today = new Date()): number | null {
  if (!dateString) return null
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return null
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((due.getTime() - startOfToday(today).getTime()) / 86400000)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa thiết lập'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không hợp lệ' : new Intl.DateTimeFormat('vi-VN').format(date)
}

export function dateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function getDeadlineLabel(order: { deadline_at: string | null; processing_status: string }) {
  if (order.processing_status === 'completed') return { label: 'Đã hoàn tất', tone: 'success' }
  const days = dayDiff(order.deadline_at)
  if (days === null) return { label: 'Chưa có hạn', tone: 'muted' }
  if (days < 0) return { label: `Quá hạn ${Math.abs(days)} ngày`, tone: 'danger' }
  if (days === 0) return { label: 'Đến hạn hôm nay', tone: 'danger' }
  if (days === 1) return { label: 'Còn 1 ngày', tone: 'danger' }
  if (days <= 3) return { label: `Còn ${days} ngày`, tone: 'warning' }
  return { label: `Còn ${days} ngày`, tone: 'normal' }
}