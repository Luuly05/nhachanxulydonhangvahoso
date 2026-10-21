-- Creates 150 entirely fictional demo orders spread across multiple weeks.
-- Run schema.sql first, then this file in Supabase SQL Editor.
insert into public.orders
  (order_code, domain_name, order_type, received_at, deadline_at, processing_status, completed_at)
select
  'OC-DEMO-' || lpad(n::text, 4, '0'),
  'demo-' || n || '.example.com',
  (array['Đăng ký mới','Cập nhật thông tin','Bổ sung hồ sơ','Gia hạn'])[((n-1)%4)+1],
  (current_date - ((n * 3) % 52))::timestamp at time zone 'Asia/Ho_Chi_Minh',
  ((current_date - ((n * 3) % 52) + case when n % 9 = 0 then 10 else 14 + (n % 9) end)::timestamp at time zone 'Asia/Ho_Chi_Minh'),
  case when n % 13 = 0 then 'completed'
       when n % 5 = 0 then 'waiting_customer'
       when n % 3 = 0 then 'processing'
       else 'new' end,
  case when n % 13 = 0 then now() - ((n % 14) || ' days')::interval else null end
from generate_series(1,150) as n
on conflict (order_code) do nothing;

insert into public.document_checklists (order_id, document_type, document_status, is_required)
select o.id, doc.document_type,
       case when o.processing_status='completed' then 'received'
            when row_number() over (partition by o.id order by doc.document_type) % 3 = 0 then 'needs_revision'
            else 'missing' end,
       true
from public.orders o
cross join (values ('Bản khai'),('Giấy tờ xác minh'),('Hợp đồng')) as doc(document_type)
where o.order_code like 'OC-DEMO-%'
on conflict do nothing;

insert into public.contact_logs (order_id, contacted_at, channel, result, note, next_contact_at)
select o.id,
       now() - ((n % 12) || ' days')::interval,
       (array['phone','email','zalo','other'])[((n-1)%4)+1],
       (array['no_answer','no_response','callback_scheduled','waiting_documents'])[((n-1)%4)+1],
       'Ghi chú giả lập phục vụ demo.',
       case when n % 2 = 0 then (current_date + (n % 3))::timestamp at time zone 'Asia/Ho_Chi_Minh' else null end
from public.orders o
join lateral (select substring(o.order_code from 9)::int as n) x on true
where o.order_code like 'OC-DEMO-%' and x.n % 4 = 0
on conflict do nothing;
