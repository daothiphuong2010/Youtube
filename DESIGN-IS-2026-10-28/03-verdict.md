# Kết luận

**REDESIGN luồng ưu tiên đọc/học**, vì tác vụ học chưa có và phần giao diện xử lý đang lấn át nội dung (12/30); giữ các module và dữ liệu hiện có, không viết lại ứng dụng.

1. Useful (#2): Đưa một phần đọc ngắn và vị trí đọc bền vững lên đầu. Bằng chứng: E1/E2/E4.
2. Understandable (#4): Tách Đọc truyện và Học kiến thức, để mỗi luồng có hành động chính phù hợp. Bằng chứng: E3.
3. Honest/Thorough (#6/#8): Chờ checkpoint ghi xong, báo lỗi ghi và nói rõ mốc ước tính/chi phí chưa xác nhận. Bằng chứng: E5/E6.
4. Useful/Honest (#2/#6): Chỉ đưa thẻ có trích nguồn được duyệt vào lịch ôn; giữ nháp khi nhà cung cấp lỗi. Bằng chứng: E3/E5.
5. Unobtrusive/Minimal (#5/#10): Đưa nhân vật, biểu đồ và từ khóa vào vùng mở khi cần; chỉ dựng phần đang đọc. Bằng chứng: E1/E8.

## Những gì còn thiếu để sản phẩm mạnh hơn

- **Truyện dài:** bản đồ nhiều tầng (tập/hồi/cảnh), đọc tiếp không spoil phần sau, lọc đúng nhân vật và sửa các tên nhận sai. Phần 5 phút chỉ là đường cơ sở để dùng ngay, chưa phải chia hồi theo ngữ nghĩa.
- **Kiến thức:** đã bổ sung sửa/ngừng/tiếp tục ôn, lịch sử thay đổi và 2 nháp từ video VFacts người dùng chọn. Còn cần gộp ý trùng ở nhiều video và nghiệm thu provider thật. Mỗi thẻ cần một ý, phân biệt lời tác giả với kiến thức đã đối chiếu; AI viết được câu hỏi không có nghĩa câu trả lời đã đúng. Chi tiết ca thử trong `KNOWLEDGE-REVIEW.md`.
- **Tiếp nhận:** bookmarklet còn phụ thuộc YouTube/phụ đề; khi không có transcript, chưa có pipeline nhận dạng giọng nói. Nhập tay cần sửa tiêu đề/channel và giữ xuất xứ tốt hơn.
- **Độ bền:** backup/restore theo origin; quản lý job nền, dừng sau checkpoint và lưu raw response để phục hồi JSON mà giảm gửi lại. Tab đóng không có server xử lý tiếp.
- **Ôn và xuất dữ liệu:** người dùng đã chọn ôn ngay trong YouTube Scenes, xuất dữ liệu là tùy chọn. Tập trung chất lượng lịch ôn trong app; không cần nối hệ khác. TSV hiện chỉ là file; lịch local không tự chuyển thành lịch của Anki.
- **Bằng chứng:** đã thử transcript truyện thật 21 giờ và video kiến thức VFacts đã chọn; vẫn cần nguồn thật 60 giờ và phản hồi provider thật. Fixture tải dài và mock provider chưa chứng minh chất lượng đầu ra AI thực tế.

## Quan điểm thiết kế

Giống một cuốn sách có dấu trang và vài tấm thẻ bên lề: mở ra biết mình đang ở đâu, đọc một đoạn, chỉ giữ điều đáng nhớ. Không bắt người dùng vận hành một bảng điều khiển AI trước khi đọc. Người dùng đã xác nhận muốn truyện có hình ở giai đoạn sau văn bản + mốc nghe; trước khi tạo ảnh hàng loạt cần chốt mật độ cảnh, độ nhất quán nhân vật và chi phí.
