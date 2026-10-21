# Ocean Deadline Tracker

MVP theo dõi hạn xử lý đơn, trạng thái hồ sơ và lịch liên hệ lại.

## Sửa lỗi build TS18003

Lỗi trước đó xảy ra vì `tsconfig.app.json` trỏ tới `src` nhưng TypeScript không tìm thấy file đầu vào. Bản này cung cấp `src/main.tsx`, `src/App.tsx` và cấu hình `include` tường minh là `src/**/*.ts` / `src/**/*.tsx`.

## Chạy local

Yêu cầu Node.js 22+.

```bash
npm install
cp .env.example .env.local
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY nếu đã tạo Supabase project
npm run dev
```

Không có thông tin Supabase, ứng dụng chạy bằng dữ liệu demo trong bộ nhớ để xem giao diện. Để lưu dữ liệu thật, cấu hình `.env.local`, chạy `supabase/schema.sql` trong SQL Editor và thiết lập chính sách RLS cho nhân viên trước khi sử dụng. Chế độ demo không thay thế yêu cầu cơ sở dữ liệu thật của bản triển khai.

## Build và Docker

```bash
npm run build
docker build -f Dockerfile.static \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -t ocean-deadline-tracker .
docker run --rm -p 8080:80 ocean-deadline-tracker
```

Nếu hệ thống CI có hỗ trợ secrets, truyền biến build từ secret store. Supabase anon/publishable key là khóa client, không phải service-role key; bảo vệ dữ liệu bằng RLS. Không đưa khóa `service_role` vào frontend hoặc Docker build args.

## Chức năng hiện có

- Dashboard tổng quan đơn tồn, cần liên hệ hôm nay, sắp đến hạn, quá hạn và đã hoàn tất.
- Tìm kiếm và lọc trạng thái.
- Thêm đơn demo, ghi lịch sử liên hệ và lịch hẹn tiếp theo.
- Đánh dấu hoàn tất.
- Cảnh báo tính theo ngày lịch; mốc 3 ngày và 1 ngày là cấu hình MVP.
- Khi Supabase được cấu hình, danh sách và thao tác CRUD dùng bảng `orders`, lịch sử dùng `contact_logs`.

## Lưu ý nghiệp vụ

Quy tắc 10 ngày phải được xác nhận với nghiệp vụ trước khi dùng thực tế: ngày bắt đầu tính, ngày lịch/ngày làm việc, múi giờ và ngoại lệ. Ứng dụng không tự động liên hệ khách hàng hay gửi email/Zalo.
