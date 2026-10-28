```text
/make-plan Redesign luồng ưu tiên đọc/học của YouTube Scenes. Bản gốc commit 6ccfaa3 đạt 12/30 theo Rams; thiếu trực tiếp tác vụ học kiến thức và UI xử lý lấn át nội dung.

Kết luận: REDESIGN luồng ưu tiên đọc/học, vì tác vụ học chưa có và phần giao diện xử lý đang lấn át nội dung (12/30); giữ các module và dữ liệu hiện có, không viết lại ứng dụng.

Giữ: HTML/ES modules không dependency, kho IndexedDB ytscenes/stories và nguồn transcript, phần 5 phút algo.js:26-37, tìm không dấu, bảng alias, liên kết mở đúng đoạn view.js:40-49, bảng màu và tiếng Việt. Không đổi chữ ký hàm hiện có.
Bỏ cách xếp thông tin xử lý/nhân vật trước nội dung (view.js:153-161), và cách coi mọi nội dung là fanfic (main.js:32-40, modes.js:27-44). Bằng chứng theo commit gốc.

Các ưu tiên:
1. Useful (#2): Đưa một phần đọc ngắn và vị trí đọc bền vững lên đầu. Bằng chứng: E1/E2/E4.
2. Understandable (#4): Tách Đọc truyện và Học kiến thức, để mỗi luồng có hành động chính phù hợp. Bằng chứng: E3.
3. Honest/Thorough (#6/#8): Chờ checkpoint ghi xong, báo lỗi ghi và nói rõ mốc ước tính/chi phí chưa xác nhận. Bằng chứng: E5/E6.
4. Useful/Honest (#2/#6): Chỉ đưa thẻ có trích nguồn được duyệt vào lịch ôn; giữ nháp khi nhà cung cấp lỗi. Bằng chứng: E3/E5.
5. Unobtrusive/Minimal (#5/#10): Đưa nhân vật, biểu đồ và từ khóa vào vùng mở khi cần; chỉ dựng phần đang đọc. Bằng chứng: E1/E8.

Các bằng chứng: E1 ảnh panel y208–800 và 162 nhân vật phía dưới, chưa thấy chữ nguồn; E2 vị trí mở chỉ ở DOM; E3 lecture/podcast bị khóa, không có thẻ/lịch; E4 đã có phần 5 phút và liên kết nghe; E5 nuốt lỗi ghi và không await onWindow, parser cắt JSON đầu-cuối; E6 chi phí do setting, timestamp có thể ước tính; E8 60h ≈720 phần nhưng vẽ tất cả cùng lúc.

Phiên hiện tại đã triển khai local ở nhánh codex/reading-and-review. Đọc STATE.md/PLAN.md trước, không làm lại phần đã hoàn thành. Người dùng đã chốt: muốn cả văn bản và hình minh họa nhưng ưu tiên văn bản + mốc nghe trước; ôn ngay trong YouTube Scenes, có thể xuất dữ liệu sau. Những hạng mục tiếp theo: nội dung thật 60h, chất lượng thẻ từ kênh thật, chỉnh/suspend thẻ và semantic chapters. Hình minh họa là giai đoạn sau; chốt mật độ cảnh, chi phí và tính nhất quán nhân vật trước khi tạo hàng loạt. Không xây tích hợp hệ ôn khác theo suy đoán.

Giới hạn: không tự gọi AI, không deploy/push, không tự đồng bộ hay sao chép kho production. Tuân thủ CONFIG/STATE/CORE/UI; pure CORE không DOM. Dùng node --test tests/*.test.mjs và tests/browser.html cho giao dịch/lỗi trình duyệt. Kiểm tra desktop/mobile và nói rõ fixture so với dữ liệu thật.
```
