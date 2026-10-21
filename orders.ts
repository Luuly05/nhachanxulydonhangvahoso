import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import type { AlertLevel, EnrichedOrder, Order, ContactLog } from '../types'

export function daysUntilDeadline(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null
  return differenceInCalendarDays(startOfDay(parseISO(deadline)), startOfDay(now))
}
export function getAlert(order: Order, daysLeft: number | null): AlertLevel {
  if (order.processing_status === 'completed') return 'completed'
  if (daysLeft === null) return 'normal'
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= 1) return 'tomorrow'
  if (daysLeft <= 3) return 'soon'
  return 'normal'
}
export function enrichOrders(orders: Order[], logs: ContactLog[]): EnrichedOrder[] {
  return orders.map(order => {
    const related = logs.filter(l => l.order_id === order.id).sort((a,b) => b.contacted_at.localeCompare(a.contacted_at))
    const future = related.filter(l => l.next_contact_at && l.next_contact_at.slice(0,10) >= format(new Date(),'yyyy-MM-dd'))
      .sort((a,b) => (a.next_contact_at || '').localeCompare(b.next_contact_at || ''))[0]
    const daysLeft = daysUntilDeadline(order.deadline_at)
    return { ...order, daysLeft, alert: getAlert(order, daysLeft), nextContactAt: future?.next_contact_at ?? null, lastContactResult: related[0]?.result ?? null }
  })
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Chưa thiết lập'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa thiết lập'
  return new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }).format(date)
}
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date)
}
export function statusLabel(status: string): string {
  return ({new:'Mới tiếp nhận', processing:'Đang xử lý', waiting_customer:'Chờ khách hàng', completed:'Đã hoàn tất'} as Record<string,string>)[status] ?? status
}
export function alertLabel(alert: string): string {
  return ({overdue:'Quá hạn', tomorrow:'Còn 1 ngày', soon:'Sắp đến hạn', normal:'Trong hạn', completed:'Hoàn tất'} as Record<string,string>)[alert] ?? alert
}
export function channelLabel(channel: string): string {
  return ({phone:'Điện thoại', email:'Email', zalo:'Zalo', other:'Khác'} as Record<string,string>)[channel] ?? channel
}
export function resultLabel(result: string): string {
  return ({contacted:'Đã liên hệ', no_answer:'Không nghe máy', no_response:'Chưa phản hồi', callback_scheduled:'Hẹn liên hệ lại', waiting_documents:'Chờ bổ sung hồ sơ'} as Record<string,string>)[result] ?? result
}
