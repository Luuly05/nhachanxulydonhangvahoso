export type OrderStatus = 'new' | 'processing' | 'waiting_customer' | 'completed'
export type Channel = 'phone' | 'email' | 'zalo' | 'other'
export type ContactResult = 'contacted' | 'no_answer' | 'no_response' | 'callback_scheduled' | 'waiting_documents'

export interface Order {
  id: string
  order_code: string
  domain_name: string
  order_type: string
  received_at: string
  deadline_at: string | null
  processing_status: OrderStatus
  completed_at: string | null
  created_at?: string
  updated_at?: string
  next_contact_at?: string | null
}
export interface ContactLog {
  id: string
  order_id: string
  contacted_at: string
  channel: Channel
  result: ContactResult
  note: string
  next_contact_at: string | null
}