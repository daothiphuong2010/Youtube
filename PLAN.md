# YouTube Scenes — kế hoạch nâng cấp 28/10/2026

Mục tiêu: mở lại sau một tuần vẫn đọc tiếp ngay; lấy kiến thức từ transcript thành thẻ có nguồn, do người dùng duyệt.

## Quyết định đã chốt với người dùng — 28/10/2026

- Truyện dài: muốn cả văn bản và hình minh họa, **ưu tiên văn bản chia phần + mốc nghe trước**. Hình minh họa là giai đoạn sau, không phải yêu cầu bị loại bỏ.
- Kiến thức: **ôn ngay trong YouTube Scenes**, có thể xuất dữ liệu sau. Lịch ôn trong app là luồng chính; xuất file là tùy chọn, không cần nối hệ Spaced Repetition khác để sử dụng.

## Phạm vi phiên này

1. CORE/STATE: tái hiện lỗi JSON, chờ lưu checkpoint trước lượt AI tiếp; báo lỗi lưu rõ ràng.
2. CONFIG/CORE/UI: vùng đọc một phần ~5 phút, chọn phần, trước/sau, lưu câu đang đọc; hiện mốc thật/ước tính. Giữ transcript và cảnh đã có.
3. CONFIG/STATE/CORE/UI: chế độ Đọc truyện / Học kiến thức; soạn thẻ từ đoạn đang đọc, tùy chọn AI tạo tối đa 3 thẻ nháp trong phạm vi đoạn đó. Mỗi thẻ có câu nguồn và trích dẫn kiểm tra được; chỉ thẻ được duyệt mới vào lịch ôn. Lộ đáp án rồi tự đánh giá; lưu lịch sử và lần tới, không phạt vì nghỉ lâu.
4. STATE/UI: xuất sao lưu nguồn + vị trí + thẻ; nhập vào local không ghi đè video đã có; xuất TSV cho Anki. Giữ tên DB và schema cũ, không lưu key trong bản sao lưu.
5. Kiểm thử core + toàn bộ test có sẵn; trình duyệt desktop/mobile, reload, lỗi AI/lưu và khôi phục. Cập nhật STATE.md.

## Tiêu chí chấp nhận

- Không tự gọi AI trong luồng mới. AI học chỉ gửi phần hiện tại sau khi bấm nút và thông báo phạm vi.
- Nháp sống qua reload; nguồn không do AI tự viết; thiếu/sai trích dẫn không nhập thành thẻ.
- Không lặp lịch sử khi bấm hai lần; mỗi thẻ có id ổn định; không đưa nháp vào ôn.
- Đọc chính chỉ render một phần; bản đồ tìm kiếm cũ vẫn dùng được ở khu vực mở rộng.
- Lỗi ghi không báo đã lưu; phần AI sau không chạy trước khi checkpoint trước ghi xong.
- Không deploy/push trong phiên; GitHub Pages xuất bản khi push main, cần quyết định phát hành riêng.

## Sau phiên này

- Hoàn thiện văn bản + mốc nghe trước; sau đó thiết kế truyện có hình minh họa. Trước khi tạo ảnh cho nội dung dài, cần chốt mật độ cảnh, chi phí và độ nhất quán nhân vật.
- Hoàn thiện trải nghiệm ôn ngay trong app trước; xuất dữ liệu là tùy chọn. Không xây đồng bộ với hệ ôn khác khi chưa có nhu cầu mới.
- Đánh giá transcript thực 60 giờ, hiệu suất phân tích từ khóa, worker nền/cancel job, giữ bản phản hồi AI để phục hồi định dạng và tránh gửi lại khi kết quả chưa rõ.
- Chất lượng kiến thức: transcript là lời của kênh, chưa phải sự thật đã kiểm chứng. Cần bước đối chiếu tài liệu cho nội dung quan trọng.
