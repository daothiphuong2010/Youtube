# Bằng chứng kiểm thử — 28/10/2026

## Tự động

`npm test`: **49/49 pass**. Dùng node:test có sẵn, không thêm framework hoặc dependency.

- Trước sửa, `tests/recovery.test.mjs` tái hiện lỗi JSON lấy đầu-cuối và checkpoint không được await. Sau sửa pass. Không có raw response thật trong ảnh nên không khẳng định đã phục hồi chính lần AI đó.
- Nguồn thẻ: bác trích dẫn bịa và chỉ số ngoài phần đã gửi; nháp không vào lịch; duyệt idempotent; giữ lịch sử, chỉ ôn thẻ đến hạn; cất/khôi phục nháp; xuất HTML an toàn trong TSV.
- Backup bỏ settings/key, giữ nháp trống và source, bác id trùng/source lỗi, job phục hồi không tự chạy.
- Mutation check: đổi điều kiện lọc đến hạn từ AND sang OR. Vòng đầu phát hiện thiếu assertion cho thẻ vừa ôn chưa đến hạn; đã bổ sung assertion theo hành vi. Vòng sau phát hiện mutation; mã gốc khôi phục, toàn suite pass.
- `git diff --check` pass; `node --check` các entry mới pass.

## Trình duyệt thật, profile kiểm thử riêng

Mở app tại `http://127.0.0.1:3219/`, nhập transcript minh họa có mốc 0/5/10 phút bằng UI.

- Chọn phần 2 và Học kiến thức; tạo nháp, nhập câu hỏi/đáp án; reload giữ nguyên phần, nguồn và chữ đã gõ.
- Duyệt → hiện đáp án → nhớ được → reload: 0 thẻ đến hạn, ngày ôn tới hiển thị. Có một lượt ôn, không tự tạo thẻ mới.
- Mở vùng công cụ: 3 phần cũ dựng được; console không có error/warning được ghi nhận trong lượt kiểm tra.
- UI nhập backup thành công. Không mở hoặc chỉnh IndexedDB/key của Chrome đang dùng GitHub Pages.

`tests/browser.html` tại origin riêng `http://127.0.0.1:3220/tests/browser.html` chạy **8/8 pass** khi bấm nút:

1. Hai giao dịch vị trí/nháp giữ cả hai trường.
2. Duyệt đồng thời chỉ tạo một thẻ.
3. Tab cũ không khôi phục nháp đã duyệt.
4. Hai lượt review đồng thời không nhân đôi history.
5. Khôi phục bỏ qua id đã có.
6. Lỗi ghi mô phỏng giữ chữ đang gõ và không báo đã lưu.
7. Chặn AI khi nháp chưa ghi được.
8. AI offline mô phỏng giữ nháp.

Đây là IndexedDB thật trong browser, với provider/lỗi quota được mô phỏng. Để chạy lại: `python -m http.server 3220 --bind 127.0.0.1 --directory .`, mở đường dẫn trên. Fixture qa: được tạo trong origin 3220 riêng, không phải dữ liệu người dùng.

## Tải dài tổng hợp

Fixture nhập qua UI: 7.200 câu, mốc cách 30 giây, duration=216.000 giây, 4.197.600 ký tự. Tiêu đề `KIỂM THỬ GIẢ LẬP 60 GIỜ`. Đây là dữ liệu lặp để kiểm tra cấu trúc/tải, không phải audio hoặc phụ đề thật.

Sau mở: 720 lựa chọn phần, **10 đoạn văn được dựng**, **0 cảnh ở explorer được dựng** khi đóng, 953 DOM elements tổng. Chọn phần 720, đợi Đã lưu, reload: vẫn phần 720/câu 7191. Không đo TTI/peak heap và chưa stress nội dung thực nhiều tên/từ khác nhau; không suy ra năng lực phân tích từ khóa hoặc chất lượng AI từ fixture lặp này.

## Thị giác và khả năng tiếp cận

- Đã xem ảnh desktop tối; ảnh `evidence/desktop.jpg` và `evidence/study-card.jpg` có dữ liệu minh họa. Focus câu hỏi rõ, nguồn và nút duyệt nhìn thấy.
- Viewport mobile 390×844 qua CDP: innerWidth=390, main.width=390, reader.width=358, document.scrollWidth=390, không tràn ngang. Công cụ chụp mobile trả ảnh lỗi/timeout nên **chưa có xác nhận trực quan mobile tin cậy**; đã bỏ ảnh lỗi và reset emulation.
- Đã sửa contrast nút chính dark/chip xanh lá/error dark, thêm focus-visible, live status, reduced-motion và tab wrap. Chưa chạy screen reader, chưa dùng điện thoại thật; chart cũ vẫn còn giới hạn bàn phím.
- Impeccable detector chạy một lần: cảnh báo `transition: width` tại progress cũ. Giữ phạm vi thay đổi, ghi nhận làm việc sau; reduced-motion mới vô hiệu transition khi người dùng yêu cầu.

## Chưa kiểm chứng

AI thật và chi phí/quota hiện tại; phụ đề YouTube/audio thật 60 giờ; chất lượng câu hỏi từ kênh thực; nối hệ ôn/n8n/Anki; trải nghiệm trên điện thoại thật; phát hành GitHub Pages và dữ liệu của origin hiện tại. Không gọi AI thật trong phiên.
