# YouTube Scenes — trạng thái 28/10/2026

## Dừng ở đâu

Đã hoàn thành hai lượt nâng cấp local theo `PLAN.md`, nhánh `codex/reading-and-review`. Chưa push/merge/deploy; GitHub Pages vẫn bản gốc. Không thay kho người dùng, settings hoặc key trong Chrome.

## Đã có

- Vùng đọc phần ~5 phút, chọn/trước/sau, nhớ đúng câu đọc; mốc nghe thật/ước tính.
- Chế độ học riêng: nguồn → nháp có thể sửa/cất/khôi phục → duyệt → truy hồi/tự đánh giá → lịch ôn và lịch sử. Không cần AI để dùng; AI chỉ chạy khi bấm, giới hạn phần hiện tại, tối đa 3 gợi ý có trích nguyên văn hợp lệ.
- **Thẻ đã lưu:** sửa qua nháp tự lưu, giữ id/nguồn/lịch sử; đổi câu hỏi hoặc đáp án đưa thẻ đang ôn về hạn hôm nay. Ngừng/tiếp tục ôn có thể đảo ngược, giữ lịch. Có lịch sử thay đổi và nội dung trước khi sửa; chống lưu từ phiên bản cũ và khôi phục bản sửa đã áp dụng. Danh sách 10 thẻ/trang; TSV chỉ lấy thẻ đang ôn, backup giữ cả thẻ ngừng.
- **Đọc nguồn thật:** đã nạp transcript truyện trong ảnh vào profile local: 9.875 đoạn có mốc → 19.689 câu → 252 phần. Đã kiểm tra phần cuối sau reload và liên kết nghe. Gộp 5 câu thành đoạn, không viết lại chữ đã lưu: phần đầu còn 13 đoạn thay vì 63, phần cuối 7 thay vì 35.
- **Video kiến thức đã chọn:** VFacts `CCQ_dDkS7V0`, 10:36, 240 đoạn phụ đề tiếng Việt →129 câu→3 phần. Đã lưu 2 nháp do Codex đối chiếu/soạn (0 được duyệt), có link nguồn 5:00 và 1:33. Reload giữ nháp; người dùng duyệt trước khi ôn. Xem `KNOWLEDGE-REVIEW.md`.
- **Định dạng/ngữ cảnh:** nhận WebVTT qua luồng nhập có sẵn, bỏ tag/dòng cuộn lặp mà không xóa lặp có chủ ý của VTT thủ công. Lượt tạo thẻ gửi phần chính + tối đa 30 giây ngữ cảnh mỗi phía (không có mốc: 3 câu), vẫn chỉ nhận thẻ trong phần chính. Prompt tránh chi tiết ASR đáng ngờ, khẳng định tuyệt đối và câu hỏi thiếu bối cảnh; chưa kiểm chứng prompt với provider thật.
- Nháp/vị trí/lịch lưu trong record cũ qua transaction. Chờ ghi trước điều hướng/rerender sau job; cảnh báo reload khi còn pending/không ghi được. Chặn AI khi chữ chưa lưu. Chống lặp approve/review và chỉnh nháp đã duyệt từ tab cũ.
- Backup JSON nguồn + workspace + lịch sử, không settings/key; nhập giữ id hiện có; TSV thẻ đã duyệt có nguồn.
- Chờ checkpoint AI trước request sau, không nuốt lỗi ghi; parser đọc JSON cân bằng, bác nhiều đối tượng thay vì nhận bừa. Không phục hồi tự động mọi kiểu JSON sai.
- Nhân vật/từ khóa/biểu đồ mở theo nhu cầu; phân tích tên và n-gram chỉ khi mở vùng công cụ. Không thay module nguồn/DB.

## File cần mở

- `app/js/reader.js`: CONFIG/STATE/UI vùng đọc/học và flush ghi.
- `app/js/study.js`: CONFIG và CORE thuần cho nguồn/thẻ/lịch/TSV.
- `app/js/algo.js`: `readingParagraphs()` gộp câu để đọc, giữ chỉ số và mốc gốc.
- `app/js/cleanup.js`: nhận WebVTT; `study.js`: `learningInput()` giữ ngoại lệ nằm sát ranh giới phần đọc.
- `app/js/store.js`: cập nhật workspace một giao dịch; `backup.js`: dữ liệu backup.
- `app/js/main.js`, `view.js`: tích hợp tối thiểu, giữ entry signatures.
- `DESIGN-IS-2026-10-28/03-verdict.md`: đánh giá và những thiếu hụt còn lại.
- `TESTING.md`: bằng chứng và giới hạn; `PLAN.md`: giả định và phạm vi.

## Bước nhỏ nhất trong 5 phút

Mở `http://127.0.0.1:3219/#id=yt%3ACCQ_dDkS7V0` (nếu server dừng: `npm run dev` trong repo). Đọc thẻ nháp, bấm **Nghe từ đây** để kiểm tra nguồn 5:00 rồi sửa/duyệt nếu thấy đáng ôn. Có 1 gợi ý khác chờ sau đó. Truyện dài vẫn ở kệ, id `yt:Dn1gzLBo3k8`. Dữ liệu này chỉ ở profile thử local, không nhúng trong mã nguồn.

## Đã kiểm chứng

**59 test pass, 17 kiểm tra browser/IndexedDB pass**; mutation test bắt được lỗi bỏ kiểm tra phiên bản sửa. Bản sửa sống qua reload; sửa không nhân đôi thẻ/lịch sử; ngừng/tiếp tục và phân trang hoạt động. Đã thử transcript thật 21:12:50, nhớ phần 252/câu 19655 sau reload; để lại truyện ở phần 1. Video kiến thức 10:36 giữ đúng nháp và link 5:00 sau reload, 0 thẻ đến hạn; đã thử nhập VTT thật qua UI ở origin QA. Fixture 60h đã kiểm tra trong lượt đầu. Desktop có ảnh `evidence/card-management.jpg` và `evidence/knowledge-draft.jpg`; layout nguồn thật ở 390px không tràn ngang. Chi tiết trong TESTING.md.

## Quyết định đã chốt — 28/10/2026

- Người dùng muốn cả văn bản và hình minh họa cho truyện dài; ưu tiên văn bản + mốc nghe trước, hình minh họa làm sau.
- Người dùng chọn ôn ngay trong YouTube Scenes, có thể xuất dữ liệu sau. Không cần xây tích hợp với hệ ôn khác cho phạm vi hiện tại.
- Hai lựa chọn này khớp với bản local đã triển khai; không cần đổi hướng hoặc xây lại.

## Còn cần nghiệm thu/triển khai sau

1. Đã thử truyện thật 21 giờ và video kiến thức VFacts do người dùng chọn. Còn cần người dùng duyệt/nhận xét nháp, chốt cấu hình model nếu muốn nghiệm thu lượt gọi AI thật; chưa gọi provider. 60 giờ hiện mới có fixture, chưa có nguồn thật.
2. Tiếp theo: chia hồi theo nội dung, phục hồi raw response và dừng job sau checkpoint. Sửa/ngừng/tiếp tục ôn thẻ đã hoàn thành.
3. Hình minh họa ở giai đoạn sau: chốt mật độ cảnh, chi phí và cách giữ nhân vật nhất quán trước khi tạo ảnh hàng loạt.
4. Nếu chốt phát hành: review diff, backup kho thật trên origin hiện tại, chốt đường chuyển dữ liệu, rồi mới push/merge main (workflow tự publish). Có baseline 6ccfaa3; không push main trước khi chốt.
5. Đã gặp cache module cũ khi preview thêm export mới; hard reload đã sửa và xác nhận render sạch lỗi. Khi phát hành cần kiểm tra cả tab mới và tab giữ bản cũ, không chỉ tải trang một lần.

## Lưu ý tiếp tục

Không đọc key từ Chrome, không tạo scheduler/hệ học thứ hai ở backend theo suy đoán từ ghi nhớ cũ. Lịch đơn giản local không phải FSRS, TSV không mang lịch này vào Anki. Bản ghi cũ `mode`/sections giữ nguyên; chọn Học kiến thức điều khiển `workspace.kind`, ẩn panel AI truyện. Các stub lecture/podcast cũ chưa được quảng bá là pipeline đã hoàn thiện.
