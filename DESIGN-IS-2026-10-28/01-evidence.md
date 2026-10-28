# Bằng chứng bản gốc

Mọi tham chiếu mã nguồn trong tài liệu này là tại commit **6ccfaa3**, trước nâng cấp; xem bằng `git show 6ccfaa3:app/js/view.js`. Đánh giá từ 4 lượt thu thập bằng chứng độc lập (cấu trúc, câu chữ, thị giác/khả năng tiếp cận, trọng lượng). Không lấy suy đoán làm số đo runtime.

## E1 — Nội dung chính không ở vị trí chính

Ảnh screenshot_1793175650: panel đầu chiếm khoảng y208–800; bảng 162 nhân vật bắt đầu y813, chưa thấy transcript trong ảnh 1080px. `view.js:153-161` đặt AI → nhân vật → tìm → biểu đồ → tab → từ khóa → nội dung. Các cảnh báo/chi phí đứng trước tác vụ đọc (`view.js:212-230`). Đồ thị không phải tác vụ chính của người muốn đọc tiếp.

## E2 — Không nhớ người đọc đang ở đâu

`view.js:37-38`: tab và query chỉ là biến tạm. `view.js:87-89`: trạng thái phần mở lấy từ DOM. `store.js:64-68` chỉ đưa tiến độ AI lên kệ. Có cơ chế tiếp tục tính toán; chưa có cơ chế tiếp tục đọc sau một tuần.

## E3 — Chưa có sản phẩm học kiến thức

`main.js:32-40` nhập mọi nội dung vào fanfic. `modes.js:27-44` khóa podcast/lecture. `modes.js:17-19` chấm mức đáng xem theo worldbuilding. Không có câu hỏi/đáp án, duyệt thẻ, lịch ôn, lịch sử hoặc trích nguồn cho thẻ. Không thể coi điểm truyện là điểm đúng sai của kiến thức.

## E4 — Có nền tảng tốt để giữ lại

HTML + ES modules, không framework. `algo.js:26-37` chia phần ~5 phút không AI; `view.js:46-50,77-78` dựng thân văn bản khi mở; `view.js:40-49` mở video đúng đoạn. Lưu IndexedDB có read-modify-write một transaction (`store.js:45-59`). Giữ nguồn, hàm cũ, bảng tên và tìm không dấu thay vì xây lại hệ thống.

## E5 — Lời hứa lưu tiến độ vượt bằng chứng

`main.js:128` nuốt lỗi ghi. `scenes.js:105` không await callback lưu (`main.js:151-155`). UI vẫn hứa phần xong không làm lại (`view.js:228-229`). `ai.js:95-99` cắt từ dấu `{` đầu đến `}` cuối: hai JSON liền nhau tạo lỗi giống ảnh. Đã tái hiện bằng test trước sửa. Chưa có raw response thật của lần lỗi trong ảnh; chưa thể khẳng định đó là đúng hình dạng phản hồi lần ấy.

## E6 — Chi phí và nguồn cần nói thật hơn

`view.js:185,224-225` coi `settings.free` là chi phí $0, kể cả router không có giá xác minh; `view.js:198,206` gọi mọi provider trực tiếp là Gemini. `algo.js:13-22` ước tính mốc khi nhập chữ không có timestamp nhưng UI không nói rõ tại liên kết. Chưa xác minh giá/quota hiện tại của tài khoản; các con số là cấu hình.

## E7 — Khả năng tiếp cận và trạng thái

Token CSS tính được: chữ chính sáng 16,09:1; muted trên trắng 5,30:1. Chip xanh lá 3,77:1; nút chính chữ trắng trên cam ở dark mode 2,26:1; error đỏ trên card tối 3,40:1 (`style.css:4,7-8,18,35,51`). Có empty/loading/error/success/disabled; focus mặc định trình duyệt, status thiếu live region, progress thiếu semantics (`view.js:214-235`). Chart chỉ nhận click (`chart.js:10-16`). Search/metadata dựa placeholder. Responsive có nền, nhưng tab không wrap và sticky offset cố định (`style.css:31,59`). Không có reduced-motion.

## E8 — Tải dài và chi phí xử lý

Đo file: **103.292 byte JS** trong 16 module reachable; ước tính **19 request** trang chủ cold load (HTML, CSS, 16 module, bookmarklet), chưa kể favicon/cache. TTI, heap thực tế của bản gốc chưa đo. Không có animation lặp vô hạn; chỉ transition progress 0,3s. Không có modal mở ban đầu.

60 giờ / 5 phút ≈720 phần; `view.js:85-89` dựng mọi summary mỗi lần tìm. `algo.js:43-58,112-127` dựng n-gram toàn transcript; `names.js:127-144` quét tên theo phần. Rủi ro block main thread, chưa có số RAM thực. Phép thử tổng hợp: 60 cửa sổ AI +1 overview=61 lượt logic ở cấu hình 60 phút; quota cấu hình 20/ngày cần 4 đợt ngày, chưa tính retry/nhân vật. Đây không phải hạn mức thật đã xác minh.

## Giới hạn nguồn đánh giá

Đã mở bản web thật ở trình duyệt mới; kho cục bộ trống ở profile đó. Ảnh người dùng cung cấp là bằng chứng về dữ liệu truyện hiện có trong Chrome, không phải quyền đọc key hoặc chuyển kho của Chrome. Không tự gọi AI thật, không lấy audio 60 giờ thật, không chỉnh dữ liệu tại GitHub Pages.
