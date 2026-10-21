export type ProcessingStatus = 'new' | 'processing' | 'waiting_customer' | 'completed'
export type DocumentStatus = 'missing' | 'received' | 'needs_revision' | 'not_applicable'
export type ContactChannel = 'phone' | 'email' | 'zalo' | 'other'
export type ContactResult = 'contacted' | 'no_answer' | 'no_response' | 'callback_scheduled' | 'waiting_documents'

export interface Order {
  id: string
  order_code: string
  domain_name: string
  order_type: string
  received_at: string
  deadline_at: string | null
  processing_status: ProcessingStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}
export interface ContactLog {
  id: string
  order_id: string
  contacted_at: string
  channel: ContactChannel
  result: ContactResult
  note: string | null
  next_contact_at: string | null
  created_at: string
}
export interface Checklist {
  id: string
  order_id: string
  document_type: string
  document_status: DocumentStatus
  is_required: boolean
  updated_at: string
}
export type AlertLevel = 'overdue' | 'tomorrow' | 'soon' | 'normal' | 'completed'
export interface EnrichedOrder extends Order {
  daysLeft: number | null
  alert: AlertLevel
  nextContactAt: string | null
  lastContactResult: ContactResult | null
}
