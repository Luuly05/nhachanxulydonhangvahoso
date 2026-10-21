import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownUp, BellRing, CalendarClock, CheckCircle2, ChevronRight,
  CirclePlus, Clock3, FileCheck2, Filter, LayoutDashboard, ListTodo, LoaderCircle,
  Mail, MessageCircle, Phone, RefreshCw, Search, ShieldAlert, X, ClipboardList
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { alertLabel, channelLabel, enrichOrders, formatDate, formatDateTime, resultLabel, statusLabel } from './lib/orders'
import type { ContactChannel, ContactLog, ContactResult, EnrichedOrder, Order, ProcessingStatus } from './types'

type View = 'dashboard' | 'orders' | 'today' | 'alerts'
const today = () => new Date().toISOString().slice(0,10)
const emptyOrder = { order_code:'', domain_name:'', order_type:'Bổ sung hồ sơ', received_at:today(), deadline_at:'', processing_status:'new' as ProcessingStatus }
const demoOrders: Order[] = Array.from({length: 36}, (_, i) => {
  const received = new Date(); received.setDate(received.getDate() - ((i * 3 + 1) % 28))
  const deadline = new Date(received); deadline.setDate(deadline.getDate() + (i % 4 === 0 ? 10 : 15 + (i % 6)))
  const status: ProcessingStatus = i % 11 === 0 ? 'completed' : i % 4 === 0 ? 'waiting_customer' : i % 3 === 0 ? 'processing' : 'new'
  return {
    id:`demo-${i+1}`, order_code:`OC-DEMO-${String(1000+i)}`, domain_name:`demo-${i+1}.example.com`,
    order_type:['Đăng ký mới','Cập nhật thông tin','Bổ sung hồ sơ','Gia hạn'][i%4],
    received_at:received.toISOString(), deadline_at:deadline.toISOString(),
    processing_status:status, completed_at:status==='completed'?new Date().toISOString():null,
    created_at:received.toISOString(), updated_at:received.toISOString()
  }
})
const demoLogs: ContactLog[] = demoOrders.filter((_,i)=>i%5===0).map((o,i)=>({
  id:`log-${i}`, order_id:o.id, contacted_at:new Date(Date.now()-i*86400000).toISOString(),
  channel:(['phone','email','zalo'][i%3]) as ContactChannel,
  result:(['no_answer','waiting_documents','callback_scheduled'][i%3]) as ContactResult,
  note:'Dữ liệu demo, không chứa thông tin khách hàng thật.',
  next_contact_at:i%2===0?new Date(Date.now()+((i%3)+1)*86400000).toISOString():null,
  created_at:new Date().toISOString()
}))

function App() {
  const [view,setView] = useState<View>('dashboard')
  const [orders,setOrders] = useState<Order[]>([])
  const [logs,setLogs] = useState<ContactLog[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [query,setQuery] = useState('')
  const [statusFilter,setStatusFilter] = useState('all')
  const [alertFilter,setAlertFilter] = useState('all')
  const [selected,setSelected] = useState<EnrichedOrder|null>(null)
  const [showCreate,setShowCreate] = useState(false)
  const [saving,setSaving] = useState(false)
  const [newOrder,setNewOrder] = useState(emptyOrder)
  const [contactForm,setContactForm] = useState({channel:'phone' as ContactChannel,result:'no_answer' as ContactResult,note:'',next_contact_at:''})
  const [toast,setToast] = useState('')

  async function loadData() {
    setLoading(true); setError('')
    if (!supabase) {
      setOrders(demoOrders); setLogs(demoLogs); setLoading(false); return
    }
    const [o,l] = await Promise.all([
      supabase.from('orders').select('*').order('received_at',{ascending:false}),
      supabase.from('contact_logs').select('*').order('contacted_at',{ascending:false})
    ])
    if (o.error || l.error) {
      setError(o.error?.message || l.error?.message || 'Không thể tải dữ liệu.')
      setOrders([]); setLogs([])
    } else { setOrders((o.data ?? []) as Order[]); setLogs((l.data ?? []) as ContactLog[]) }
    setLoading(false)
  }
  useEffect(()=>{ void loadData() },[])
  useEffect(()=>{ if (!toast) return; const t=window.setTimeout(()=>setToast(''),2800); return ()=>window.clearTimeout(t) },[toast])

  const enriched = useMemo(()=>enrichOrders(orders,logs),[orders,logs])
  const active = enriched.filter(o=>o.processing_status!=='completed')
  const dueToday = active.filter(o=>o.nextContactAt && o.nextContactAt.slice(0,10)<=today())
  const overdue = active.filter(o=>o.alert==='overdue')
  const soon = active.filter(o=>o.alert==='soon'||o.alert==='tomorrow')
  const risk = active.filter(o=>o.alert==='overdue'||o.alert==='tomorrow')
  const completed = enriched.filter(o=>o.processing_status==='completed')
  const filtered = useMemo(()=>{
    let list = enriched.filter(o => `${o.order_code} ${o.domain_name} ${o.order_type}`.toLowerCase().includes(query.toLowerCase()))
    if (statusFilter!=='all') list=list.filter(o=>o.processing_status===statusFilter)
    if (alertFilter!=='all') list=list.filter(o=>o.alert===alertFilter)
    if (view==='today') list=list.filter(o=>o.processing_status!=='completed' && o.nextContactAt && o.nextContactAt.slice(0,10)<=today())
    if (view==='alerts') list=list.filter(o=>o.processing_status!=='completed' && ['overdue','tomorrow','soon'].includes(o.alert))
    return list.sort((a,b)=>priority(a)-priority(b) || (a.daysLeft ?? 999)-(b.daysLeft ?? 999))
  },[enriched,query,statusFilter,alertFilter,view])

  function priority(o:EnrichedOrder) {
    if (o.alert==='overdue') return 0
    if (o.alert==='tomorrow') return 1
    if (o.alert==='soon') return 2
    if (o.nextContactAt && o.nextContactAt.slice(0,10)<=today()) return 3
    return 4
  }
  async function createOrder(e:React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { ...newOrder, received_at:new Date(newOrder.received_at+'T09:00:00').toISOString(),
      deadline_at:newOrder.deadline_at?new Date(newOrder.deadline_at+'T23:59:59').toISOString():null }
    if (supabase) {
      const {data,error:err}=await supabase.from('orders').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setOrders(prev=>[data as Order,...prev])
    } else {
      const order:Order={...payload,id:crypto.randomUUID(),completed_at:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
      setOrders(prev=>[order,...prev])
    }
    setShowCreate(false); setNewOrder(emptyOrder); setSaving(false); setToast('Đã tạo đơn hàng.')
  }
  async function updateStatus(order:EnrichedOrder,status:ProcessingStatus) {
    const patch={processing_status:status,completed_at:status==='completed'?new Date().toISOString():null,updated_at:new Date().toISOString()}
    if (supabase) {
      const {error:err}=await supabase.from('orders').update(patch).eq('id',order.id)
      if (err) { setError(err.message); return }
    }
    setOrders(prev=>prev.map(o=>o.id===order.id?{...o,...patch}:o))
    setSelected(prev=>prev?.id===order.id?{...prev,...patch}:prev)
    setToast(status==='completed'?'Đã đánh dấu hoàn tất.':'Đã cập nhật trạng thái.')
  }
  async function addContact(e:React.FormEvent) {
    e.preventDefault(); if(!selected) return; setSaving(true)
    const payload={order_id:selected.id,contacted_at:new Date().toISOString(),channel:contactForm.channel,result:contactForm.result,
      note:contactForm.note.trim()||null,next_contact_at:contactForm.next_contact_at?new Date(contactForm.next_contact_at+'T09:00:00').toISOString():null}
    if (supabase) {
      const {data,error:err}=await supabase.from('contact_logs').insert(payload).select().single()
      if(err){setError(err.message);setSaving(false);return}
      setLogs(prev=>[data as ContactLog,...prev])
    } else {
      setLogs(prev=>[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...prev])
    }
    if(contactForm.result==='waiting_documents'||contactForm.result==='callback_scheduled') await updateStatus(selected,'waiting_customer')
    setContactForm({channel:'phone',result:'no_answer',note:'',next_contact_at:''}); setSaving(false); setToast('Đã lưu lịch sử liên hệ.')
  }

  const navItems:[View,string,typeof LayoutDashboard][]=[
    ['dashboard','Tổng quan',LayoutDashboard],['orders','Tất cả đơn hàng',ClipboardList],['today','Cần liên hệ hôm nay',CalendarClock],['alerts','Cảnh báo hạn',BellRing]
  ]
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Clock3 size={22}/></div><div><strong>ocean</strong><span>DEADLINE TRACKER</span></div></div>
      <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav>{navItems.map(([id,label,Icon])=><button key={id} className={`nav-item ${view===id?'active':''}`} onClick={()=>setView(id)}><Icon size={18}/><span>{label}</span>{id==='today'&&dueToday.length>0&&<b className="nav-count">{dueToday.length}</b>}{id==='alerts'&&risk.length>0&&<b className="nav-count danger">{risk.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="team-avatar">O</div><div className="team-copy"><strong>Ocean · CSKH</strong><span>Nhóm chăm sóc khách hàng</span></div><span className="online-dot"/></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Ocean / <strong>{navItems.find(n=>n[0]===view)?.[1]}</strong></div><div className="top-actions"><span className={`connection ${isSupabaseConfigured?'connected':''}`}><i/>{isSupabaseConfigured?'Supabase đã kết nối':'Chế độ demo'}</span><button className="icon-button" title="Làm mới dữ liệu" onClick={()=>void loadData()}><RefreshCw size={17}/></button><div className="user-avatar">CS</div></div></header>
      <div className="page-content">
        {error&&<div className="error-banner"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>setError('')}><X size={15}/></button></div>}
        {view==='dashboard'&&<Dashboard orders={enriched} active={active.length} dueToday={dueToday.length} soon={soon.length} overdue={overdue.length} completed={completed.length} risk={risk.length} loading={loading} onOpen={setSelected} onNavigate={setView} onCreate={()=>setShowCreate(true)}/>}
        {view!=='dashboard'&&<section>
          <div className="page-heading"><div><div className="eyebrow">QUẢN LÝ VẬN HÀNH</div><h1>{navItems.find(n=>n[0]===view)?.[1]}</h1><p>{view==='today'?'Các đơn đã đến lịch cần liên hệ lại và chưa hoàn tất.':view==='alerts'?'Ưu tiên xử lý các hồ sơ sắp đến hạn hoặc đã quá hạn.':'Theo dõi, lọc và cập nhật toàn bộ đơn hàng.'}</p></div><button className="primary-button" onClick={()=>setShowCreate(true)}><CirclePlus size={17}/> Tạo đơn hàng</button></div>
          <div className="filterbar"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã đơn, tên miền..."/></div><div className="filter-select"><Filter size={16}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="new">Mới tiếp nhận</option><option value="processing">Đang xử lý</option><option value="waiting_customer">Chờ khách hàng</option><option value="completed">Đã hoàn tất</option></select></div><div className="filter-select"><ShieldAlert size={16}/><select value={alertFilter} onChange={e=>setAlertFilter(e.target.value)}><option value="all">Mọi mức cảnh báo</option><option value="overdue">Quá hạn</option><option value="tomorrow">Còn 1 ngày</option><option value="soon">Sắp đến hạn</option><option value="normal">Trong hạn</option><option value="completed">Hoàn tất</option></select></div><span className="result-count">{filtered.length} đơn</span></div>
          <OrdersTable orders={filtered} loading={loading} onOpen={setSelected}/>
        </section>}
      </div>
      <footer className="footer"><span>Ocean Deadline Tracker <b>·</b> MVP</span><span>Dữ liệu demo không chứa thông tin khách hàng thật</span></footer>
    </main>
    {selected&&<div className="drawer-backdrop" onClick={()=>setSelected(null)}><aside className="detail-drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-header"><div><span className="eyebrow">CHI TIẾT ĐƠN HÀNG</span><h2>{selected.order_code}</h2></div><button className="icon-button" onClick={()=>setSelected(null)}><X size={18}/></button></div>
      <div className="drawer-body">
        <div className="domain-card"><div className="domain-icon">.com</div><div><strong>{selected.domain_name}</strong><span>{selected.order_type}</span></div><StatusPill status={selected.processing_status}/></div>
        <div className="deadline-panel"><div><span>HẠN HOÀN TẤT HỒ SƠ</span><strong>{formatDate(selected.deadline_at)}</strong></div><div className={`days-chip ${selected.alert}`}><strong>{selected.daysLeft===null?'—':selected.daysLeft<0?Math.abs(selected.daysLeft):selected.daysLeft}</strong><span>{selected.daysLeft===null?'chưa có hạn':selected.daysLeft<0?'ngày quá hạn':'ngày còn lại'}</span></div></div>
        <div className="detail-grid"><Info label="Ngày tiếp nhận" value={formatDate(selected.received_at)}/><Info label="Trạng thái" value={statusLabel(selected.processing_status)}/><Info label="Lịch liên hệ tiếp" value={formatDateTime(selected.nextContactAt)}/><Info label="Cập nhật gần nhất" value={formatDateTime(selected.updated_at)}/></div>
        <label className="field-label">Cập nhật trạng thái</label><select className="full-select" value={selected.processing_status} onChange={e=>void updateStatus(selected,e.target.value as ProcessingStatus)}><option value="new">Mới tiếp nhận</option><option value="processing">Đang xử lý</option><option value="waiting_customer">Chờ khách hàng</option><option value="completed">Đã hoàn tất</option></select>
        <div className="section-title"><h3><Phone size={17}/> Ghi nhận liên hệ</h3><span>{logs.filter(l=>l.order_id===selected.id).length} lần</span></div>
        <form className="contact-form" onSubmit={addContact}>
          <div className="form-row"><div className="field"><label>Kênh liên hệ</label><select value={contactForm.channel} onChange={e=>setContactForm({...contactForm,channel:e.target.value as ContactChannel})}><option value="phone">Điện thoại</option><option value="email">Email</option><option value="zalo">Zalo</option><option value="other">Khác</option></select></div><div className="field"><label>Kết quả</label><select value={contactForm.result} onChange={e=>setContactForm({...contactForm,result:e.target.value as ContactResult})}><option value="contacted">Đã liên hệ</option><option value="no_answer">Không nghe máy</option><option value="no_response">Chưa phản hồi</option><option value="callback_scheduled">Hẹn liên hệ lại</option><option value="waiting_documents">Chờ bổ sung hồ sơ</option></select></div></div>
          <div className="field"><label>Hẹn liên hệ lại (nếu có)</label><input type="date" min={today()} value={contactForm.next_contact_at} onChange={e=>setContactForm({...contactForm,next_contact_at:e.target.value})}/></div>
          <div className="field"><label>Ghi chú xử lý</label><textarea rows={2} value={contactForm.note} onChange={e=>setContactForm({...contactForm,note:e.target.value})} placeholder="Ví dụ: Khách hẹn gửi giấy tờ vào thứ Sáu..."/></div>
          <button className="primary-button full-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<CirclePlus size={16}/>} Lưu lần liên hệ</button>
        </form>
        <div className="section-title history-title"><h3><MessageCircle size={17}/> Lịch sử liên hệ</h3></div>
        <div className="timeline">{logs.filter(l=>l.order_id===selected.id).sort((a,b)=>b.contacted_at.localeCompare(a.contacted_at)).map(log=><div className="timeline-item" key={log.id}><div className="timeline-dot"/><div className="timeline-content"><div className="timeline-top"><strong>{resultLabel(log.result)}</strong><time>{formatDateTime(log.contacted_at)}</time></div><span>{channelLabel(log.channel)}{log.note?` · ${log.note}`:''}</span>{log.next_contact_at&&<small><CalendarClock size={13}/> Hẹn lại: {formatDateTime(log.next_contact_at)}</small>}</div></div>)}
          {logs.filter(l=>l.order_id===selected.id).length===0&&<div className="empty-history">Chưa có lịch sử liên hệ. Hãy ghi nhận lần liên hệ đầu tiên ở trên.</div>}
        </div>
      </div>
    </aside></div>}
    {showCreate&&<div className="modal-backdrop" onClick={()=>setShowCreate(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">TẠO BẢN GHI MỚI</span><h2>Tạo đơn hàng</h2></div><button className="icon-button" onClick={()=>setShowCreate(false)}><X size={18}/></button></div><form onSubmit={createOrder}><div className="field"><label>Mã đơn hàng *</label><input required value={newOrder.order_code} onChange={e=>setNewOrder({...newOrder,order_code:e.target.value})} placeholder="OC-DEMO-1200"/></div><div className="field"><label>Tên miền minh họa *</label><input required value={newOrder.domain_name} onChange={e=>setNewOrder({...newOrder,domain_name:e.target.value})} placeholder="example.com"/></div><div className="field"><label>Loại đơn hàng</label><select value={newOrder.order_type} onChange={e=>setNewOrder({...newOrder,order_type:e.target.value})}><option>Đăng ký mới</option><option>Cập nhật thông tin</option><option>Bổ sung hồ sơ</option><option>Gia hạn</option><option>Khác</option></select></div><div className="form-row"><div className="field"><label>Ngày tiếp nhận *</label><input type="date" required value={newOrder.received_at} onChange={e=>setNewOrder({...newOrder,received_at:e.target.value})}/></div><div className="field"><label>Hạn hoàn tất</label><input type="date" min={newOrder.received_at} value={newOrder.deadline_at} onChange={e=>setNewOrder({...newOrder,deadline_at:e.target.value})}/></div></div><div className="field"><label>Trạng thái ban đầu</label><select value={newOrder.processing_status} onChange={e=>setNewOrder({...newOrder,processing_status:e.target.value as ProcessingStatus})}><option value="new">Mới tiếp nhận</option><option value="processing">Đang xử lý</option><option value="waiting_customer">Chờ khách hàng</option></select></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowCreate(false)}>Hủy</button><button className="primary-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<CirclePlus size={16}/>} Tạo đơn</button></div></form></div></div>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>
}

function Dashboard({orders,active,dueToday,soon,overdue,completed,risk,loading,onOpen,onNavigate,onCreate}:{orders:EnrichedOrder[],active:number,dueToday:number,soon:number,overdue:number,completed:number,risk:number,loading:boolean,onOpen:(o:EnrichedOrder)=>void,onNavigate:(v:View)=>void,onCreate:()=>void}) {
  const urgent=orders.filter(o=>o.processing_status!=='completed').sort((a,b)=>({overdue:0,tomorrow:1,soon:2,normal:3,completed:4}[a.alert]-({overdue:0,tomorrow:1,soon:2,normal:3,completed:4}[b.alert]))).slice(0,6)
  return <section>
    <div className="welcome-row"><div><div className="eyebrow">THỨC DẬY VÀ KIỂM SOÁT HẠN</div><h1>Tổng quan công việc <span>✦</span></h1><p>Một nơi để biết đơn nào cần xử lý, trước khi thời hạn lên tiếng.</p></div><button className="primary-button" onClick={onCreate}><CirclePlus size={17}/> Tạo đơn hàng</button></div>
    {!isSupabaseConfigured&&<div className="demo-notice"><div className="notice-icon"><ClipboardList size={19}/></div><div><strong>Bạn đang xem dữ liệu mẫu</strong><p>Kết nối Supabase để lưu đơn hàng và lịch sử liên hệ bền vững. Dữ liệu demo sẽ được thay bằng dữ liệu trong cơ sở dữ liệu.</p></div><span>DEMO</span></div>}
    <div className="stats-grid">
      <StatCard label="Đơn chưa hoàn tất" value={active} note="Đang cần theo dõi" icon={ListTodo} tone="blue" onClick={()=>onNavigate('orders')}/>
      <StatCard label="Liên hệ hôm nay" value={dueToday} note="Đến lịch hẹn hoặc đã trễ" icon={CalendarClock} tone="purple" onClick={()=>onNavigate('today')}/>
      <StatCard label="Sắp đến hạn" value={soon} note="Còn tối đa 3 ngày" icon={Clock3} tone="orange" onClick={()=>onNavigate('alerts')}/>
      <StatCard label="Đã quá hạn" value={overdue} note="Cần ưu tiên xử lý" icon={AlertTriangle} tone="red" onClick={()=>onNavigate('alerts')}/>
    </div>
    <div className="dashboard-grid">
      <div className="panel task-panel"><div className="panel-heading"><div><h2><ShieldAlert size={19}/> Đơn cần ưu tiên</h2><p>Được sắp xếp theo mức độ khẩn cấp</p></div><button className="text-button" onClick={()=>onNavigate('alerts')}>Xem tất cả <ChevronRight size={15}/></button></div>
        {loading?<div className="loading-state"><LoaderCircle className="spin"/> Đang tải dữ liệu...</div>:urgent.length===0?<div className="empty-state"><CheckCircle2 size={27}/><strong>Không có đơn cần xử lý</strong><span>Mọi thứ đang trong tầm kiểm soát.</span></div>:<div className="priority-list">{urgent.map(o=><button className="priority-row" key={o.id} onClick={()=>onOpen(o)}><div className={`priority-symbol ${o.alert}`}><AlertTriangle size={17}/></div><div className="priority-main"><strong>{o.order_code}</strong><span>{o.domain_name}</span></div><div className="priority-deadline"><strong>{o.daysLeft===null?'Chưa có hạn':o.daysLeft<0?`Trễ ${Math.abs(o.daysLeft)} ngày`:o.daysLeft===0?'Hạn hôm nay':`Còn ${o.daysLeft} ngày`}</strong><span>{formatDate(o.deadline_at)}</span></div><StatusPill status={o.processing_status}/><ChevronRight className="row-chevron" size={16}/></button>)}</div>}
      </div>
      <div className="panel summary-panel"><div className="panel-heading"><div><h2><LayoutDashboard size={19}/> Tình hình xử lý</h2><p>Tổng quan trạng thái đơn hàng</p></div></div>
        <div className="progress-summary"><div className="progress-number"><strong>{orders.length}</strong><span>Tổng đơn hàng</span></div><div className="progress-track"><span style={{width:`${orders.length?completed/orders.length*100:0}%`}}/></div><div className="progress-legend"><span><i className="legend-complete"/>Hoàn tất <b>{completed}</b></span><span><i className="legend-active"/>Đang mở <b>{active}</b></span></div></div>
        <div className="summary-row"><div className="summary-icon green"><FileCheck2 size={17}/></div><div><strong>Đã hoàn tất</strong><span>Đã đóng hồ sơ</span></div><b>{completed}</b></div>
        <div className="summary-row"><div className="summary-icon orange"><Clock3 size={17}/></div><div><strong>Sắp đến hạn</strong><span>Còn 1 đến 3 ngày</span></div><b>{soon}</b></div>
        <div className="summary-row"><div className="summary-icon red"><ShieldAlert size={17}/></div><div><strong>Nguy cơ cao</strong><span>Quá hạn hoặc còn 1 ngày</span></div><b className={risk?'red-text':''}>{risk}</b></div>
        <button className="outline-button" onClick={()=>onNavigate('orders')}>Mở danh sách đơn hàng <ArrowDownUp size={15}/></button>
      </div>
    </div>
    <div className="tip-strip"><div className="tip-icon"><BellRing size={18}/></div><div><strong>Nhắc nhỏ cho hôm nay</strong><span>Ghi nhận kết quả sau mỗi lần liên hệ và đặt lịch tiếp theo để đơn tự quay lại đúng ngày.</span></div><button onClick={()=>onNavigate('today')}>Xem lịch hẹn <ChevronRight size={15}/></button></div>
  </section>
}
function StatCard({label,value,note,icon:Icon,tone,onClick}:{label:string,value:number,note:string,icon:typeof Clock3,tone:string,onClick:()=>void}) {
  return <button className="stat-card" onClick={onClick}><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={19}/></div></div><div className="stat-value">{value}</div><div className="stat-note"><span className={`stat-dot ${tone}`}/>{note}</div></button>
}
function OrdersTable({orders,loading,onOpen}:{orders:EnrichedOrder[],loading:boolean,onOpen:(o:EnrichedOrder)=>void}) {
  if(loading)return <div className="panel loading-state"><LoaderCircle className="spin"/> Đang tải danh sách...</div>
  return <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>MÃ ĐƠN / TÊN MIỀN</th><th>NGÀY TIẾP NHẬN</th><th>HẠN XỬ LÝ</th><th>CÒN LẠI</th><th>TRẠNG THÁI</th><th>CẢNH BÁO</th><th></th></tr></thead><tbody>{orders.map(o=><tr key={o.id} onClick={()=>onOpen(o)}><td><div className="order-cell"><strong>{o.order_code}</strong><span>{o.domain_name}</span></div></td><td>{formatDate(o.received_at)}</td><td>{formatDate(o.deadline_at)}</td><td><span className={`days-text ${o.alert}`}>{o.processing_status==='completed'?'Đã đóng':o.daysLeft===null?'Chưa đặt':o.daysLeft<0?`Trễ ${Math.abs(o.daysLeft)} ngày`:o.daysLeft===0?'Hôm nay':`${o.daysLeft} ngày`}</span></td><td><StatusPill status={o.processing_status}/></td><td><AlertPill alert={o.alert}/></td><td><button className="row-open" title="Mở chi tiết"><ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>
    {orders.length===0&&<div className="empty-state"><Search size={26}/><strong>Không tìm thấy đơn hàng</strong><span>Thử thay đổi từ khóa hoặc bộ lọc.</span></div>}
  </div>
}
function StatusPill({status}:{status:string}) { return <span className={`status-pill status-${status}`}><i/>{statusLabel(status)}</span> }
function AlertPill({alert}:{alert:string}) { return <span className={`alert-pill alert-${alert}`}>{alertLabel(alert)}</span> }
function Info({label,value}:{label:string,value:string}) { return <div className="info-item"><span>{label}</span><strong>{value}</strong></div> }
export default App
