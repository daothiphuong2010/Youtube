# Thử video kiến thức do người dùng chọn — 28/10/2026

Nguồn: [Vì Sao Cờ Trắng Là Biểu Tượng Của Đầu Hàng? — VFacts](https://www.youtube.com/watch?v=CCQ_dDkS7V0), player hiện 10:36. Đây là một tập hỏi–đáp nhiều chủ đề: cờ trắng, chữ quốc ngữ, ước lượng lượng video YouTube.

## Kết quả trong app local

Đã lấy phụ đề tiếng Việt WebVTT, xử lý dòng lặp và tag; có **240 đoạn có mốc**, **129 câu sau làm sạch**, **3 phần đọc**. Mốc đầu 0,16 giây, mốc câu cuối 626,64 giây. Nguồn đã lưu trong profile local ở `#id=yt%3ACCQ_dDkS7V0`, chọn sẵn Học kiến thức.

Đã soạn và lưu **2 thẻ nháp**, **0 thẻ được duyệt**. Đây là nháp do Codex soạn/đối chiếu trong lượt thử, không phải bằng chứng nút AI/provider trong ứng dụng đã chạy:

1. **Giơ cờ trắng có luôn đồng nghĩa với ý định đầu hàng không?** Đáp án nháp: không thể suy ra chắc chắn ý định đầu hàng chỉ từ hành vi này. Câu nguồn số 65, [mốc 5:00](https://www.youtube.com/watch?v=CCQ_dDkS7V0&t=300). Đối chiếu thêm: tài liệu ICRC phân biệt ý định liên lạc/đàm phán với ý định đầu hàng, nên tránh biến cờ trắng thành một khẳng định tuyệt đối. [ICRC, Conduct of operations, phần White Flag of Truce](https://www.icrc.org/sites/default/files/external/doc/en/assets/files/other/law4_final.pdf).
2. **Theo video, màu trắng có lợi gì về khả năng nhận biết trên chiến trường?** Đáp án nháp: dễ nhận ra giữa máu, khói bụi và các lá cờ nhiều màu. Câu nguồn 24–25, [mốc 1:33](https://www.youtube.com/watch?v=CCQ_dDkS7V0&t=93). Giữ cụm “theo video” vì đây là lời giải thích được kênh trình bày; chưa coi mọi lý giải lịch sử trong đoạn là kết luận đã kiểm chứng độc lập.

Mỗi nháp có trích dẫn nguyên văn được kiểm tra bằng CORE; giữ nguồn và mốc để người dùng duyệt. Chưa thêm thẻ vào lịch, chưa gọi Gemini/router hoặc provider thật.

## Những lỗi học cần tránh

- **Cắt đúng 5 phút có thể mất ngoại lệ.** Câu giới hạn ý nghĩa cờ trắng nằm ở 5:00,32, ngay đầu phần 2; phần 1 chỉ có câu 1–64. Nếu chỉ gửi phần 1, AI có thể thiếu câu này và viết một thẻ quá tuyệt đối. Đã bổ sung tối đa 30 giây ngữ cảnh mỗi phía, hoặc 3 câu nếu không có mốc. Validator vẫn chỉ nhận thẻ lấy từ phần chính; UI nói rõ phạm vi gửi.
- **ASR có chi tiết đáng nghi.** Đoạn quanh 0:53 ghi mốc kết thúc triều đại thành 2020. Không đưa con số đó vào thẻ khi chưa nghe lại/đối chiếu; không âm thầm sửa transcript thành một số khác.
- **Tiêu đề không bao phủ mọi chủ đề.** Mỗi câu hỏi phải tự nêu đối tượng, không dùng “ông ấy”, “điều đó” thiếu ngữ cảnh. Không lấy câu đùa, quảng cáo hoặc ước lượng chưa kiểm tra thành kiến thức chắc chắn.
- **Trích dẫn đúng chữ chưa đủ chứng minh đáp án đúng.** Duyệt của người dùng vẫn bắt buộc; kiểm tra schema chỉ chặn nguồn bịa/chỉ số sai, không thay việc đối chiếu nội dung.

## Thay đổi từ ca thử này

- `parseText()` nhận WebVTT; bỏ header/tag, khử dòng cuộn lặp của ASR và giữ các lặp có chủ ý trong VTT thủ công. Có test cho dòng trống chứa khoảng trắng trong cue, tránh làm trễ mốc đầu từ 0,16 sang 2,389 giây.
- Prompt yêu cầu giữ phạm vi theo nguồn, tránh khẳng định tuyệt đối, số/tên đáng ngờ, quảng cáo và đại từ không có bối cảnh. Chưa nghiệm thu hành vi prompt với provider thật.
- `learningInput()` thêm ngữ cảnh liền kề có giới hạn; các thẻ bên ngoài phần chính vẫn bị từ chối. Có kiểm thử qua ranh giới 5 phút.
- Thử nhập WebVTT thật qua giao diện ở origin QA riêng: 3 phần, không còn header/tag trong văn bản, nhận đúng mốc nguồn.

## Giới hạn bằng chứng

Hai đường lấy transcript qua trình duyệt không hoạt động ổn định với video này. Dùng `agent-reach` theo tuyến `yt-dlp` qua `uvx`, chỉ tải phụ đề vi vào TEMP; bản tiếng Anh bị HTTP 429, không thử lại. Không tải file audio/video, không thêm dependency cho app, không sửa Chrome/settings/key và không đưa toàn bộ transcript vào Git. Bản nhập thử không chứng minh bookmarklet tự chạy thành công từ đầu đến cuối trên mọi video.
