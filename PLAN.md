# YouTube Scenes — kế hoạch nâng cấp 28/10/2026

Mục tiêu: mở lại sau một tuần vẫn đọc tiếp ngay; lấy kiến thức từ transcript thành thẻ có nguồn, do người dùng duyệt.

Giả định đang áp dụng: ưu tiên văn bản chia phần + mở nghe đúng đoạn; ôn ngay trong app và xuất dữ liệu. Câu hỏi về hình minh họa và hệ ôn đích đã gửi, chưa có trả lời.

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

- Xác nhận cần truyện minh họa hay chỉ văn bản; hình ảnh 60 giờ là hạng mục riêng, phải chốt chi phí và độ nhất quán nhân vật.
- Chốt hợp đồng tích hợp với hệ ôn hiện có trước khi đồng bộ thật. Hiện chỉ xuất file, không tuyên bố kết nối.
- Đánh giá transcript thực 60 giờ, hiệu suất phân tích từ khóa, worker nền/cancel job, giữ bản phản hồi AI để phục hồi định dạng và tránh gửi lại khi kết quả chưa rõ.
- Chất lượng kiến thức: transcript là lời của kênh, chưa phải sự thật đã kiểm chứng. Cần bước đối chiếu tài liệu cho nội dung quan trọng.
