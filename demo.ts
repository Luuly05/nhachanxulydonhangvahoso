import type { Order } from './types'

const statuses: Order['processing_status'][] = ['new', 'processing', 'waiting_customer', 'completed']
const today = new Date()
const isoDay = (offset: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

export const demoOrders: Order[] = Array.from({ length: 120 }, (_, i) => {
  const age = (i * 7) % 32
  const status = i % 9 === 0 ? 'completed' : statuses[i % 3]
  const deadlineOffset = [-5, -2, -1, 0, 1, 3, 5, 8, 12][i % 9]
  return {
    id: `demo-${i + 1}`,
    order_code: `OC-${String(2026000 + i + 1)}`,
    domain_name: `demo-${i + 1}.example`,
    order_type: i % 2 ? 'Hoàn thiện hồ sơ' : 'Đăng ký tên miền',
    received_at: isoDay(-age),
    deadline_at: isoDay(deadlineOffset),
    processing_status: status,
    completed_at: status === 'completed' ? isoDay(-1) : null,
    next_contact_at: i % 7 === 0 && status !== 'completed' ? isoDay(0) : null,
  }
})