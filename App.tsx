import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronDown, CirclePlus, Clock3, Filter, LayoutDashboard, ListTodo, MessageCircle, Search, ShieldAlert, SlidersHorizontal, X } from 'lucide-react'
import { demoOrders } from './demo'
import { dayDiff, formatDate, getDeadlineLabel } from './lib/dates'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import type { Channel, ContactLog, ContactResult, Order, OrderStatus } from './types'

type FilterKey = 'all' | 'today' | 'soon' | 'overdue' | 'completed'
const statusNames: Record<OrderStatus, string> = {
  new: 'Mới tiếp nhận',
  processing: 'Đang xử lý',
  waiting_customer: 'Chờ khách hàng',
  completed: 'Đã hoàn tất',
}
const channelNames: Record<Channel, string> = { phone: 'Điện thoại', email: 'Email', zalo: 'Zalo', other: 'Khác' }
const resultNames: Record<ContactResult, string> = {
  contacted: 'Đã liên hệ',
  no_answer: 'Không nghe máy',
  no_response: 'Chưa phản hồi',
  callback_scheduled: 'Hẹn liên hệ lại',
  waiting_documents: 'Chờ bổ sung hồ sơ',
}
const initialForm = { order_code: '', domain_name: '', order_type: 'Hoàn thiện hồ sơ', received_at: new Date().toISOString().slice(0, 10), deadline_at: '', processing_status: 'new' as OrderStatus }

export default function App() {
  const [orders, setOrders] = useState<Order[]>(demoOrders)
  const [logs, setLogs] = useState<ContactLog[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [contact, setContact] = useState({ channel: 'phone' as Channel, result: 'no_answer' as ContactResult, note: '', next_contact_at: '' })
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    setLoading(true)
    supabase.from('orders').select('*').order('deadline_at', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setNotice(`Không tải được dữ liệu Supabase: ${error.message}`)
        else if (data) setOrders(data as Order[])
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const openOrders = orders.filter(o => o.processing_status !== 'completed')
  const dueToday = openOrders.filter(o => o.next_contact_at && dayDiff(o.next_contact_at) === 0)
  const dueSoon = openOrders.filter(o => {
    const d = dayDiff(o.deadline_at)
    return d !== null && d >= 0 && d <= 3
  })
  const overdue = openOrders.filter(o => {
    const d = dayDiff(o.deadline_at)
    return d !== null && d < 0
  })
  const highRisk = openOrders.filter(o => {
    const d = dayDiff(o.deadline_at)
    return d !== null && d <= 1
  })

  const visibleOrders = useMemo(() => orders.filter(o => {
    const q = search.toLowerCase().trim()
    const matchesSearch = !q || `${o.order_code} ${o.domain_name} ${o.order_type}`.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || o.processing_status === statusFilter
    let matchesTile = true
    if (activeFilter === 'today') matchesTile = Boolean(o.processing_status !== 'completed' && o.next_contact_at && dayDiff(o.next_contact_at) === 0)
    if (activeFilter === 'soon') matchesTile = Boolean(o.processing_status !== 'completed' && dayDiff(o.deadline_at) !== null && dayDiff(o.deadline_at)! >= 0 && dayDiff(o.deadline_at)! <= 3)
    if (activeFilter === 'overdue') matchesTile = Boolean(o.processing_status !== 'completed' && dayDiff(o.deadline_at) !== null && dayDiff(o.deadline_at)! < 0)
    if (activeFilter === 'completed') matchesTile = o.processing_status === 'completed'
    return matchesSearch && matchesStatus && matchesTile
  }).sort((a, b) => {
    const rank = (o: Order) => {
      if (o.processing_status === 'completed') return 5
      const d = dayDiff(o.deadline_at)
      if (d !== null && d < 0) return 0
      if (d !== null && d <= 1) return 1
      if (o.next_contact_at && dayDiff(o.next_contact_at) !== null && dayDiff(o.next_contact_at)! <= 0) return 2
      if (d !== null && d <= 3) return 3
      return 4
    }
    return rank(a) - rank(b)
  }), [orders, search, statusFilter, activeFilter])

  async function createOrder(e: FormEvent) {
    e.preventDefault()
    const newOrder: Order = {
      id: crypto.randomUUID(), order_code: form.order_code.trim(), domain_name: form.domain_name.trim(),
      order_type: form.order_type, received_at: new Date(`${form.received_at}T09:00:00`).toISOString(),
      deadline_at: form.deadline_at ? new Date(`${form.deadline_at}T23:59:59`).toISOString() : null,
      processing_status: form.processing_status, completed_at: form.processing_status === 'completed' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (supabase) {
      const { data, error } = await supabase.from('orders').insert({
        order_code: newOrder.order_code, domain_name: newOrder.domain_name, order_type: newOrder.order_type,
        received_at: newOrder.received_at, deadline_at: newOrder.deadline_at,
        processing_status: newOrder.processing_status, completed_at: newOrder.completed_at,
      }).select().single()
      if (error) { setNotice(`Không tạo được đơn: ${error.message}`); return }
      if (data) newOrder.id = data.id
    }
    setOrders(prev => [newOrder, ...prev])
    setShowCreate(false); setForm(initialForm); setNotice('Đã tạo đơn hàng.')
  }

  async function markCompleted(order: Order) {
    const completedAt = new Date().toISOString()
    if (supabase && !order.id.startsWith('demo-')) {
      const { error } = await supabase.from('orders').update({ processing_status: 'completed', completed_at: completedAt, updated_at: completedAt }).eq('id', order.id)
      if (error) { setNotice(`Không cập nhật được đơn: ${error.message}`); return }
    }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, processing_status: 'completed', completed_at: completedAt } : o))
    setSelected({ ...order, processing_status: 'completed', completed_at: completedAt })
    setNotice(`${order.order_code} đã được đánh dấu hoàn tất.`)
  }

  async function addContact(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    const log: ContactLog = {
      id: crypto.randomUUID(), order_id: selected.id, contacted_at: new Date().toISOString(),
      channel: contact.channel, result: contact.result, note: contact.note,
      next_contact_at: contact.next_contact_at ? new Date(`${contact.next_contact_at}T09:00:00`).toISOString() : null,
    }
    if (supabase && !selected.id.startsWith('demo-')) {
      const { error } = await supabase.from('contact_logs').insert({
        order_id: log.order_id, contacted_at: log.contacted_at, channel: log.channel,
        result: log.result, note: log.note, next_contact_at: log.next_contact_at,
      })
      if (error) { setNotice(`Không lưu được lịch sử liên hệ: ${error.message}`); return }
    }
    setLogs(prev => [log, ...prev])
    if (log.next_contact_at) {
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, next_contact_at: log.next_contact_at, processing_status: 'waiting_customer' } : o))
      setSelected({ ...selected, next_contact_at: log.next_contact_at, processing_status: 'waiting_customer' })
    }
    setContact({ channel: 'phone', result: 'no_answer', note: '', next_contact_at: '' })
    setNotice('Đã lưu lịch sử liên hệ.')
  }

  const selectTile = (key: FilterKey) => { setActiveFilter(key); setStatusFilter('all') }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">O</div><div><strong>ocean</strong><span>DEADLINE TRACKER</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="nav-item active"><LayoutDashboard size={18}/> Tổng quan</button>
      <button className="nav-item" onClick={() => selectTile('today')}><ListTodo size={18}/> Việc cần làm hôm nay <span className="nav-count">{dueToday.length}</span></button>
      <button className="nav-item" onClick={() => selectTile('soon')}><CalendarClock size={18}/> Sắp đến hạn</button>
      <button className="nav-item" onClick={() => selectTile('overdue')}><ShieldAlert size={18}/> Đơn quá hạn</button>
      <div className="sidebar-bottom"><div className="avatar">OC</div><div className="profile"><strong>Ocean CSKH</strong><span>Nhân viên vận hành</span></div><ChevronDown size={15}/></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">Ocean / <strong>Quản lý hồ sơ</strong></div><div className="top-actions"><span className={`connection ${hasSupabaseConfig ? 'connected' : ''}`}><span/> {hasSupabaseConfig ? 'Supabase' : 'Dữ liệu demo'}</span><button className="icon-button" aria-label="Thông báo" onClick={() => selectTile('soon')}><BellRing size={18}/>{highRisk.length > 0 && <i/>}</button><div className="avatar">OC</div></div></header>

      <div className="page-content">
        <section className="page-heading"><div><div className="eyebrow">THỨ TƯ, NGÀY {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</div><h1>Xin chào, đội ngũ Ocean <span>✦</span></h1><p>Đây là tình hình xử lý hồ sơ của bạn hôm nay.</p></div><button className="primary-button" onClick={() => setShowCreate(true)}><CirclePlus size={18}/> Tạo đơn mới</button></section>

        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Đóng thông báo"><X size={16}/></button></div>}

        <section className="stats-grid">
          <StatCard icon={<ListTodo size={19}/>} label="Đơn chưa hoàn tất" value={openOrders.length} detail="Cần tiếp tục xử lý" tone="teal" onClick={() => selectTile('all')}/>
          <StatCard icon={<MessageCircle size={19}/>} label="Liên hệ hôm nay" value={dueToday.length} detail="Đến lịch hẹn liên hệ lại" tone="blue" onClick={() => selectTile('today')}/>
          <StatCard icon={<Clock3 size={19}/>} label="Sắp đến hạn" value={dueSoon.length} detail="Trong vòng 3 ngày" tone="amber" onClick={() => selectTile('soon')}/>
          <StatCard icon={<AlertTriangle size={19}/>} label="Đã quá hạn" value={overdue.length} detail="Ưu tiên xử lý ngay" tone="red" onClick={() => selectTile('overdue')}/>
        </section>

        <section className="risk-banner"><div className="risk-icon"><ShieldAlert size={21}/></div><div className="risk-copy"><strong>{highRisk.length} hồ sơ có nguy cơ cao</strong><span>Đã quá hạn hoặc chỉ còn tối đa 1 ngày trước hạn hoàn tất.</span></div><button onClick={() => { setActiveFilter('soon'); setStatusFilter('all') }}>Xem danh sách ưu tiên <span>→</span></button></section>

        <section className="orders-panel">
          <div className="panel-heading"><div><h2>Danh sách hồ sơ</h2><p>Theo dõi tiến độ và hạn xử lý của từng đơn hàng.</p></div><div className="panel-tools"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã đơn, tên miền..." /></div><div className="select-wrap"><SlidersHorizontal size={16}/><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Lọc trạng thái"><option value="all">Tất cả trạng thái</option>{Object.entries(statusNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div></div></div>
          <div className="filter-tabs"><button className={activeFilter === 'all' ? 'selected' : ''} onClick={() => selectTile('all')}>Tất cả hồ sơ <span>{orders.length}</span></button><button className={activeFilter === 'today' ? 'selected' : ''} onClick={() => selectTile('today')}>Liên hệ hôm nay</button><button className={activeFilter === 'soon' ? 'selected' : ''} onClick={() => selectTile('soon')}>Sắp đến hạn</button><button className={activeFilter === 'overdue' ? 'selected' : ''} onClick={() => selectTile('overdue')}>Quá hạn</button><button className={activeFilter === 'completed' ? 'selected' : ''} onClick={() => selectTile('completed')}>Đã hoàn tất</button></div>
          <div className="table-wrap"><table><thead><tr><th>MÃ ĐƠN / TÊN MIỀN</th><th>NGÀY TIẾP NHẬN</th><th>HẠN XỬ LÝ</th><th>TRẠNG THÁI</th><th>CẢNH BÁO</th><th></th></tr></thead><tbody>
            {visibleOrders.slice(0, 100).map(order => {
              const deadline = getDeadlineLabel(order)
              return <tr key={order.id} onClick={() => setSelected(order)} className="order-row"><td><div className="order-code">{order.order_code}</div><div className="domain">{order.domain_name}</div></td><td>{formatDate(order.received_at)}</td><td><div className="deadline-date">{formatDate(order.deadline_at)}</div><div className="subtle">{order.deadline_at ? `${dayDiff(order.deadline_at)! < 0 ? 'Quá' : 'Còn'} ${Math.abs(dayDiff(order.deadline_at)!)} ngày` : 'Chưa thiết lập'}</div></td><td><StatusPill status={order.processing_status}/></td><td><span className={`deadline-pill ${deadline.tone}`}>{deadline.tone === 'danger' ? <AlertTriangle size={13}/> : deadline.tone === 'success' ? <CheckCircle2 size={13}/> : <Clock3 size={13}/>} {deadline.label}</span></td><td><button className="more-button" aria-label={`Xem ${order.order_code}`} onClick={e => { e.stopPropagation(); setSelected(order) }}>···</button></td></tr>
            })}
            {visibleOrders.length === 0 && <tr><td colSpan={6} className="empty-state">Không tìm thấy hồ sơ phù hợp.</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Hiển thị {Math.min(visibleOrders.length, 100)} / {visibleOrders.length} hồ sơ</span><span>{loading ? 'Đang đồng bộ dữ liệu…' : 'Cập nhật theo dữ liệu hiện có'}</span></div>
        </section>
        <footer>© 2026 Ocean Deadline Tracker <span>•</span> Quản lý hồ sơ thông minh, chủ động mỗi ngày.</footer>
      </div>
    </main>

    {showCreate && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false) }}><section className="modal"><div className="modal-head"><div><h2>Tạo đơn hàng mới</h2><p>Nhập thông tin theo dõi hồ sơ.</p></div><button className="icon-button" onClick={() => setShowCreate(false)}><X size={18}/></button></div><form onSubmit={createOrder} className="form-grid">
      <label>Mã đơn hàng<input required value={form.order_code} onChange={e => setForm({ ...form, order_code: e.target.value })} placeholder="VD: OC-20261021-01"/></label>
      <label>Tên miền demo<input required value={form.domain_name} onChange={e => setForm({ ...form, domain_name: e.target.value })} placeholder="tenmien.example"/></label>
      <label>Loại đơn<select value={form.order_type} onChange={e => setForm({ ...form, order_type: e.target.value })}><option>Hoàn thiện hồ sơ</option><option>Đăng ký tên miền</option><option>Thay đổi thông tin</option><option>Gia hạn</option></select></label>
      <label>Ngày tiếp nhận<input required type="date" value={form.received_at} onChange={e => setForm({ ...form, received_at: e.target.value })}/></label>
      <label>Hạn xử lý<input type="date" value={form.deadline_at} onChange={e => setForm({ ...form, deadline_at: e.target.value })}/></label>
      <label>Trạng thái<select value={form.processing_status} onChange={e => setForm({ ...form, processing_status: e.target.value as OrderStatus })}>{Object.entries(statusNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Hủy</button><button className="primary-button" type="submit">Lưu đơn hàng</button></div>
    </form></section></div>}

    {selected && <div className="drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null) }}><aside className="detail-drawer"><div className="drawer-head"><div><span className="eyebrow">CHI TIẾT HỒ SƠ</span><h2>{selected.order_code}</h2><p>{selected.domain_name}</p></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18}/></button></div>
      <div className="detail-section"><div className="detail-label">Trạng thái hiện tại</div><StatusPill status={selected.processing_status}/><div className="detail-grid"><div><span>Ngày tiếp nhận</span><strong>{formatDate(selected.received_at)}</strong></div><div><span>Hạn xử lý</span><strong>{formatDate(selected.deadline_at)}</strong></div></div><div className={`detail-deadline ${getDeadlineLabel(selected).tone}`}><CalendarClock size={18}/><div><strong>{getDeadlineLabel(selected).label}</strong><span>Theo hạn được lưu trên đơn hàng</span></div></div></div>
      {selected.processing_status !== 'completed' && <button className="complete-button" onClick={() => markCompleted(selected)}><CheckCircle2 size={17}/> Đánh dấu hồ sơ hoàn tất</button>}
      <div className="detail-section"><h3><MessageCircle size={17}/> Ghi nhận liên hệ</h3><form className="contact-form" onSubmit={addContact}>
        <label>Kênh liên hệ<select value={contact.channel} onChange={e => setContact({ ...contact, channel: e.target.value as Channel })}>{Object.entries(channelNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>Kết quả<select value={contact.result} onChange={e => setContact({ ...contact, result: e.target.value as ContactResult })}>{Object.entries(resultNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>Ghi chú<textarea rows={3} value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value })} placeholder="Tóm tắt kết quả trao đổi..."/></label>
        <label>Hẹn liên hệ lại<input type="date" value={contact.next_contact_at} onChange={e => setContact({ ...contact, next_contact_at: e.target.value })}/></label>
        <button className="primary-button full-width" type="submit">Lưu lịch sử liên hệ</button>
      </form></div>
      <div className="detail-section"><h3><Clock3 size={17}/> Lịch sử liên hệ trong phiên</h3>{logs.filter(l => l.order_id === selected.id).length === 0 ? <p className="no-logs">Chưa có lịch sử liên hệ trong phiên này.</p> : logs.filter(l => l.order_id === selected.id).map(log => <div className="log-item" key={log.id}><div className="log-dot"/><div><strong>{channelNames[log.channel]} · {resultNames[log.result]}</strong><span>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.contacted_at))}</span>{log.note && <p>{log.note}</p>}{log.next_contact_at && <small>Hẹn lại: {formatDate(log.next_contact_at)}</small>}</div></div>)}</div>
      <p className="drawer-note">Lịch sử demo chỉ tồn tại trong phiên trình duyệt. Khi kết nối Supabase, lịch sử liên hệ của đơn thật được lưu trong cơ sở dữ liệu.</p>
    </aside></div>}
  </div>
}

function StatCard({ icon, label, value, detail, tone, onClick }: { icon: React.ReactNode; label: string; value: number; detail: string; tone: string; onClick: () => void }) {
  return <button className="stat-card" onClick={onClick}><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString('vi-VN')}</div><div className="stat-detail">{detail}<span>↗</span></div></button>
}

function StatusPill({ status }: { status: OrderStatus }) {
  const cls = status === 'completed' ? 'complete' : status === 'waiting_customer' ? 'waiting' : status === 'processing' ? 'processing' : 'new'
  return <span className={`status-pill ${cls}`}><i/>{statusNames[status]}</span>
}