# YouTube Scenes — trạng thái 28/10/2026

## Dừng ở đâu

Đã hoàn thành bản nâng cấp local đầu tiên theo `PLAN.md`, nhánh `codex/reading-and-review`. Chưa push/merge/deploy; GitHub Pages vẫn bản gốc. Không thay kho người dùng, settings hoặc key trong Chrome.

## Đã có

- Vùng đọc phần ~5 phút, chọn/trước/sau, nhớ đúng câu đọc; mốc nghe thật/ước tính.
- Chế độ học riêng: nguồn → nháp có thể sửa/cất/khôi phục → duyệt → truy hồi/tự đánh giá → lịch ôn và lịch sử. Không cần AI để dùng; AI chỉ chạy khi bấm, giới hạn phần hiện tại, tối đa 3 gợi ý có trích nguyên văn hợp lệ.
- Nháp/vị trí/lịch lưu trong record cũ qua transaction. Chờ ghi trước điều hướng/rerender sau job; cảnh báo reload khi còn pending/không ghi được. Chặn AI khi chữ chưa lưu. Chống lặp approve/review và chỉnh nháp đã duyệt từ tab cũ.
- Backup JSON nguồn + workspace + lịch sử, không settings/key; nhập giữ id hiện có; TSV thẻ đã duyệt có nguồn.
- Chờ checkpoint AI trước request sau, không nuốt lỗi ghi; parser đọc JSON cân bằng, bác nhiều đối tượng thay vì nhận bừa. Không phục hồi tự động mọi kiểu JSON sai.
- Nhân vật/từ khóa/biểu đồ mở theo nhu cầu; phân tích tên và n-gram chỉ khi mở vùng công cụ. Không thay module nguồn/DB.

## File cần mở

- `app/js/reader.js`: CONFIG/STATE/UI vùng đọc/học và flush ghi.
- `app/js/study.js`: CONFIG và CORE thuần cho nguồn/thẻ/lịch/TSV.
- `app/js/store.js`: cập nhật workspace một giao dịch; `backup.js`: dữ liệu backup.
- `app/js/main.js`, `view.js`: tích hợp tối thiểu, giữ entry signatures.
- `DESIGN-IS-2026-10-28/03-verdict.md`: đánh giá và những thiếu hụt còn lại.
- `TESTING.md`: bằng chứng và giới hạn; `PLAN.md`: giả định và phạm vi.

## Bước nhỏ nhất trong 5 phút

Mở `http://127.0.0.1:3219/` (nếu server dừng: `npm run dev` trong repo). Dán một đoạn kiến thức thật có timestamp, chọn **Học kiến thức**, tạo và duyệt **1 thẻ**. Kiểm tra chính bạn có muốn ôn câu hỏi đó sau một ngày hay không.

## Đã kiểm chứng

49 test pass, 8 kiểm tra browser/IndexedDB pass; nhớ vị trí/nháp sau reload; fixture 60h gồm 7.200 câu/4,2 triệu ký tự dựng 10 đoạn đang đọc, nhớ phần 720. Desktop có ảnh; layout 390px không tràn ngang qua DOM nhưng screenshot mobile lỗi. Chi tiết trong TESTING.md.

## Còn cần quyết định/nghiệm thu

1. “Xem được” nghĩa là đọc chia phần hay truyện có minh họa? Câu hỏi tùy chọn đã gửi, chưa có trả lời; đang ưu tiên văn bản + mốc nghe.
2. Ôn trong app, nối hệ Spaced Repetition hiện có hay Anki? Hiện ôn local + TSV, không tự kết nối hệ cũ.
3. Thử audio/transcript thật dài và 1 kênh kiến thức thật; đánh giá chất lượng AI thực. Chưa gọi provider thật.
4. Sửa/suspend thẻ đã duyệt, đa tầng semantic chapters, raw response recovery, stop job sau checkpoint, đa thiết bị còn ở lộ trình.
5. Nếu chốt phát hành: review diff, backup kho thật trên origin hiện tại, chốt đường chuyển dữ liệu, rồi mới push/merge main (workflow tự publish). Có baseline 6ccfaa3; không push main trước khi chốt.

## Lưu ý tiếp tục

Không đọc key từ Chrome, không tạo scheduler/hệ học thứ hai ở backend theo suy đoán từ ghi nhớ cũ. Lịch đơn giản local không phải FSRS, TSV không mang lịch này vào Anki. Bản ghi cũ `mode`/sections giữ nguyên; chọn Học kiến thức điều khiển `workspace.kind`, ẩn panel AI truyện. Các stub lecture/podcast cũ chưa được quảng bá là pipeline đã hoàn thiện.
