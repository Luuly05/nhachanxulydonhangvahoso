# Ocean Deadline Tracker

MVP web app để nhân viên Ocean – CSKH theo dõi hạn xử lý hồ sơ, lịch liên hệ lại, trạng thái đơn và cảnh báo quá hạn.

## Chức năng đã có

- Dashboard: tổng đơn chưa hoàn tất, lịch liên hệ hôm nay, đơn sắp hạn, đơn quá hạn và tiến độ hoàn tất.
- Danh sách đơn hàng, tìm kiếm theo mã/tên miền/loại đơn, lọc theo trạng thái và cảnh báo.
- Sắp xếp ưu tiên: quá hạn → còn 1 ngày → còn 3 ngày → lịch liên hệ.
- Tạo đơn, cập nhật trạng thái, đánh dấu hoàn tất.
- Chi tiết đơn với lịch sử liên hệ nhiều lần, kênh liên hệ, kết quả, ghi chú và ngày hẹn tiếp.
- Dữ liệu demo cục bộ để xem giao diện ngay khi chưa cấu hình Supabase.
- Supabase/PostgreSQL schema và seed script 150 đơn giả lập.

## Công nghệ

- React + TypeScript + Vite
- Supabase PostgreSQL
- Lucide icons, date-fns

## Chạy ứng dụng

Yêu cầu Node.js 20+ và npm.

```bash
npm install
npm run dev
```

Mở địa chỉ mà Vite hiển thị, thường là `http://localhost:5173`.

Nếu chưa cấu hình Supabase, ứng dụng chạy ở **chế độ demo trên bộ nhớ trình duyệt**. Dữ liệu thêm trong chế độ này không tồn tại sau khi tải lại trang. Để lưu dữ liệu bền vững, làm theo bước bên dưới.

## Kết nối Supabase

1. Tạo project tại https://supabase.com.
2. Mở **SQL Editor** trong dashboard Supabase.
3. Chạy toàn bộ `supabase/schema.sql`.
4. Chạy `supabase/seed.sql` để thêm 150 đơn hàng và dữ liệu giả.
5. Sao chép `.env.example` thành `.env.local`.
6. Điền Project URL và anon/public key trong phần Project Settings → API:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

7. Khởi động lại `npm run dev`.

Khi đã cấu hình, dashboard và danh sách đọc dữ liệu từ Supabase; thao tác tạo đơn, cập nhật trạng thái và ghi lịch sử liên hệ sẽ ghi xuống database.

## Build kiểm tra

```bash
npm run build
npm run preview
```

## Quy tắc hạn xử lý

Ứng dụng dùng trường `deadline_at` đã lưu cho từng đơn, không tự áp dụng hạn 10 ngày cho mọi đơn. Cảnh báo hiện tại:
- `overdue`: ngày còn lại nhỏ hơn 0
- `tomorrow`: còn 0 hoặc 1 ngày
- `soon`: còn 2 hoặc 3 ngày
- `normal`: còn trên 3 ngày hoặc chưa cấu hình hạn
- `completed`: đơn đã hoàn tất

Ngày được tính theo ngày lịch của môi trường trình duyệt. Trước khi dùng nghiệp vụ thật, cần chốt quy tắc “10 ngày” (ngày lịch hay ngày làm việc, có tính ngày tiếp nhận không), múi giờ và ngày nghỉ. Hạn cụ thể cần được nhập hoặc tính theo quy tắc đã được nghiệp vụ xác nhận.

## Lưu ý trước khi triển khai thật

- Dữ liệu seed hoàn toàn giả lập, dùng tên miền `example.com`.
- Schema demo cho phép `anon` truy cập CRUD để tiện trình diễn. **Không dùng chính sách này cho dữ liệu thật.** Trước production, bật Supabase Auth và thay RLS policies bằng chính sách giới hạn người dùng đã xác thực.
- MVP chưa tự gửi email, gọi điện, nhắn Zalo, đọc email, kết nối hệ thống đơn hàng hoặc tự thao tác tên miền.
- Bảng checklist và deadline alerts đã được tạo sẵn trong schema; giao diện checklist và quản trị lịch sử cảnh báo chi tiết có thể phát triển ở sprint tiếp theo.
