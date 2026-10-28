# Bằng chứng kiểm thử — 28/10/2026

## Tự động

`npm test`: **59/59 pass** (lượt đầu 49). Dùng node:test có sẵn, không thêm framework hoặc dependency cho app.

- Trước sửa, `tests/recovery.test.mjs` tái hiện lỗi JSON lấy đầu-cuối và checkpoint không được await. Sau sửa pass. Không có raw response thật trong ảnh nên không khẳng định đã phục hồi chính lần AI đó.
- Nguồn thẻ: bác trích dẫn bịa và chỉ số ngoài phần đã gửi; nháp không vào lịch; duyệt idempotent; giữ lịch sử, chỉ ôn thẻ đến hạn; cất/khôi phục nháp; xuất HTML an toàn trong TSV.
- Backup bỏ settings/key, giữ nháp trống và source, bác id trùng/source lỗi, job phục hồi không tự chạy.
- Mutation check: đổi điều kiện lọc đến hạn từ AND sang OR. Vòng đầu phát hiện thiếu assertion cho thẻ vừa ôn chưa đến hạn; đã bổ sung assertion theo hành vi. Vòng sau phát hiện mutation; mã gốc khôi phục, toàn suite pass.
- `git diff --check` pass; `node --check` các entry mới pass.
- Mới: sửa thẻ qua nháp có thể cất/khôi phục; giữ id/nguồn/history, reset hạn khi nội dung đổi, giữ lịch nếu không đổi; ngừng/tiếp tục không tạo review; bác phiên bản cũ, giữ thẻ ngừng khi sửa; backup mang lịch sử sửa; gộp câu giữ đủ chữ/chỉ số/mốc và không sửa input. Mutation kiểm tra version bị bắt, sau đó khôi phục byte gốc.
- WebVTT: tái hiện trước sửa rồi pass; bỏ tag/dòng rolling lặp, giữ mốc đầu 0,16 với dòng chỉ có khoảng trắng, giữ lặp có chủ ý của VTT thủ công. `learningInput()` đọc được ngoại lệ ngay sau ranh giới phần, không nhận thẻ có nguồn ngoài phần chính, không lấy mốc thời gian ở xa bị đảo thứ tự làm ngữ cảnh.

## Trình duyệt thật, profile kiểm thử riêng

Mở app tại `http://127.0.0.1:3219/`, nhập transcript minh họa có mốc 0/5/10 phút bằng UI.

- Chọn phần 2 và Học kiến thức; tạo nháp, nhập câu hỏi/đáp án; reload giữ nguyên phần, nguồn và chữ đã gõ.
- Duyệt → hiện đáp án → nhớ được → reload: 0 thẻ đến hạn, ngày ôn tới hiển thị. Có một lượt ôn, không tự tạo thẻ mới.
- Mở vùng công cụ: 3 phần cũ dựng được; console không có error/warning được ghi nhận trong lượt kiểm tra.
- UI nhập backup thành công. Không mở hoặc chỉnh IndexedDB/key của Chrome đang dùng GitHub Pages.

`tests/browser.html` tại origin riêng `http://127.0.0.1:3220/tests/browser.html` chạy **17/17 pass** khi bấm nút:

1. Hai giao dịch vị trí/nháp giữ cả hai trường.
2. Duyệt đồng thời chỉ tạo một thẻ.
3. Tab cũ không khôi phục nháp đã duyệt.
4. Hai lượt review đồng thời không nhân đôi history.
5. Khôi phục bỏ qua id đã có.
6. Lỗi ghi mô phỏng giữ chữ đang gõ và không báo đã lưu.
7. Chặn AI khi nháp chưa ghi được.
8. AI offline mô phỏng giữ nháp.
9. Nháp sửa thẻ đã duyệt được ghi vào IndexedDB.
10. Lưu sửa đồng thời giữ cùng id, history và một thay đổi.
11. Tab cũ không phục hồi bản sửa đã áp dụng.
12. Ngừng ôn giữ review history.
13. Bác sửa cũ và giữ nháp trong kho.
14. Xung đột phiên bản không khóa nút cất nháp như lỗi ghi.
15. Chỉ dựng tối đa 10 thẻ mỗi trang.
16. Trang tiếp theo có đúng số thẻ còn lại.
17. TSV bị vô hiệu khi mọi thẻ đều ngừng ôn.

Đây là IndexedDB thật trong browser, với provider/lỗi quota được mô phỏng. Để chạy lại: `python -m http.server 3220 --bind 127.0.0.1 --directory .`, mở đường dẫn trên. Fixture qa: được tạo trong origin 3220 riêng, không phải dữ liệu người dùng.

## Tải dài tổng hợp

Fixture nhập qua UI: 7.200 câu, mốc cách 30 giây, duration=216.000 giây, 4.197.600 ký tự. Tiêu đề `KIỂM THỬ GIẢ LẬP 60 GIỜ`. Đây là dữ liệu lặp để kiểm tra cấu trúc/tải, không phải audio hoặc phụ đề thật.

Số đo lượt đầu, trước khi gộp câu thành đoạn: 720 lựa chọn phần, **10 đoạn văn được dựng**, **0 cảnh ở explorer được dựng** khi đóng, 953 DOM elements tổng. Chọn phần 720, đợi Đã lưu, reload: vẫn phần 720/câu 7191. Không đo TTI/peak heap và chưa stress nội dung thực nhiều tên/từ khác nhau; không suy ra năng lực phân tích từ khóa hoặc chất lượng AI từ fixture lặp này. Lượt tiếp tục kiểm tra gộp đoạn trên nguồn thật bên dưới.

## Transcript truyện thật — lượt tiếp tục

Nguồn: [video trong ảnh người dùng](https://www.youtube.com/watch?v=Dn1gzLBo3k8), tên/kênh khớp ảnh; player hiện **21:12:50**, không phải 60 giờ. Chỉ đọc transcript đang hiển thị, không tải audio/video, không gọi provider AI.

- Công cụ export transcript báo không có bản chép lời, nhưng mô tả có nút mở. Mở đúng nút qua UI; bảng có **9.875 đoạn**. AX snapshot toàn trang quá nặng, nên đọc giới hạn DOM qua CUA/CDP, không đọc cookies/settings/keys.
- Đo nguồn: **1.824.585 ký tự**, mốc đầu 0, cuối **76367 giây**, không có mốc đi ngược sau làm sạch; **19.689 câu**, **252 phần** ~5 phút, **21 cửa sổ AI** nếu dùng cấu hình 60 phút (chưa gọi).
- Tạo backup riêng ở thư mục TEMP và nhập bằng UI vào profile local, không ghi đè id khác. Không đưa toàn bộ transcript vào Git hoặc trang xuất bản.
- Browser: phần đầu link nghe `https://youtu.be/Dn1gzLBo3k8?t=0`; chọn phần 252, đợi Đã lưu, reload vẫn phần 252/câu 19655, link đầu phần `t=76241`. Sau nghiệm thu trả lại phần 1.
- Dữ liệu thật làm lộ 63 đoạn câu/nút trong phần đầu. Đã gộp 5 câu/đoạn: **13 đoạn** ở phần đầu và **7 đoạn** ở phần cuối (trước đó 35), giữ đủ chữ/chỉ số/mốc theo test CORE. Không viết lại hoặc sửa tên ASR.
- Sửa thẻ minh họa qua UI, reload giữ câu hỏi/đáp án/source. Lưu giữ một thẻ và một lượt review, thêm change; ngừng ôn → reload không còn due; tiếp tục → về đúng lịch; đã xem lịch sử và điều khiển bằng Tab. Ảnh `evidence/card-management.jpg` dùng dữ liệu minh họa.
- Nguồn thật ở viewport **390×844**: documentWidth=390, readerWidth=358, không tràn ngang. Đã clear emulation sau đo.
- Có lỗi cache module khi preview thêm `readingParagraphs`: reader mới gặp algo cũ. Hard reload bỏ cache đã nạp đúng module, render lại và kiểm tra không có console error/warning mới; không sửa cài đặt cache lâu dài. Khi phát hành cần kiểm tra tab mới/tab giữ bản cũ.

## Thị giác và khả năng tiếp cận

- Đã xem ảnh desktop tối; ảnh `evidence/desktop.jpg` và `evidence/study-card.jpg` có dữ liệu minh họa. Focus câu hỏi rõ, nguồn và nút duyệt nhìn thấy.
- Viewport mobile 390×844 qua CDP: innerWidth=390, main.width=390, reader.width=358, document.scrollWidth=390, không tràn ngang. Công cụ chụp mobile trả ảnh lỗi/timeout nên **chưa có xác nhận trực quan mobile tin cậy**; đã bỏ ảnh lỗi và reset emulation.
- Đã sửa contrast nút chính dark/chip xanh lá/error dark, thêm focus-visible, live status, reduced-motion và tab wrap. Chưa chạy screen reader, chưa dùng điện thoại thật; chart cũ vẫn còn giới hạn bàn phím.
- Impeccable detector chạy một lần: cảnh báo `transition: width` tại progress cũ. Giữ phạm vi thay đổi, ghi nhận làm việc sau; reduced-motion mới vô hiệu transition khi người dùng yêu cầu.

## Video kiến thức VFacts do người dùng chọn

Nguồn [CCQ_dDkS7V0](https://www.youtube.com/watch?v=CCQ_dDkS7V0), 10:36. Xem phân tích nội dung và hai nháp trong `KNOWLEDGE-REVIEW.md`.

- Export trong browser báo không có; bảng transcript UI bị trống. `uvx --from yt-dlp yt-dlp --skip-download --write-sub --write-auto-sub --sub-lang vi,en` lấy được VTT tiếng Việt 98.694 byte vào TEMP; phụ đề tiếng Anh lỗi 429 nên không thử lại. Không tải file media hoặc thêm dependency vào app.
- Parser mới đọc 240 đoạn, làm sạch thành 129 câu, 3 phần; mốc đầu 0,16, mốc câu cuối 626,64. Kiểm thử nhập nội dung VTT thật qua UI tại origin QA 3220: 3 phần, không còn `WEBVTT`/tag `<c>` trong vùng đọc, nhận đúng mốc nguồn.
- Hai nháp được soạn và đối chiếu bởi Codex, không phải chạy nút AI/provider thật. Nháp thứ nhất có nguồn câu 65 ở 300,32 giây; thứ hai có nguồn câu 24–25 ở 93,24 giây. Backup validation nhận trích dẫn đúng chữ; sau nhập/reload, câu hỏi còn nguyên, link nguồn `t=300`, 1 gợi ý chờ và 0 thẻ đến hạn.
- Đầu vào AI cho phần đầu: câu 1–64, mốc cuối 297,639; câu giới hạn cờ trắng ở 300,32. `learningInput()` mới bao gồm ngoại lệ này, tổng 5.082 ký tự, dưới cap 12.000; validator vẫn bác thẻ có start/end ngoài phần chính. Đây là bằng chứng chuẩn bị đầu vào, chưa phải chất lượng trả lời của provider thật.
- Prompt được sửa để tránh số/tên ASR đáng ngờ, khẳng định tuyệt đối, quảng cáo và câu hỏi thiếu chủ đề. Không tuyên bố tự động kiểm chứng sự thật; vẫn cần người dùng duyệt.
- Đã đối chiếu phân biệt cờ trắng/đầu hàng với tài liệu ICRC; không biến mốc 2020 đáng nghi trong ASR thành một thẻ học.

## Chưa kiểm chứng

AI/provider thật và chi phí/quota hiện tại; phụ đề/audio thật **60 giờ** (21 giờ đã thử); phản hồi người dùng về hai nháp VFacts; chia hồi ngữ nghĩa; trải nghiệm điện thoại thật; phát hành GitHub Pages và dữ liệu của origin hiện tại. Không gọi provider thật trong phiên; ôn trong app đã được chọn làm luồng chính, tích hợp hệ khác không nằm trong phạm vi hiện tại.
