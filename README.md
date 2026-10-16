# YT Scenes · repo `Youtube`

Bấm 1 lần trên video YouTube → một trang web biến video dài (truyện audio 20h+) thành **mục lục tìm kiếm được**.
**Miễn phí**: phần từ khóa chạy ngay trong trình duyệt, không cần AI. Phần chia cảnh + chấm điểm dùng **key Gemini miễn phí** của bạn.
Không có máy chủ: trang tĩnh trên GitHub Pages, key nằm trong trình duyệt, kết quả lưu trong máy.

**Trang:** https://daothiphuong2010.github.io/Youtube/

## Lần đầu (2 phút)

1. Mở trang → **kéo** nút cam **🎬 YT Scenes** lên thanh dấu trang Chrome (`Ctrl+Shift+B` để hiện thanh).
2. (Tùy chọn, để có chia cảnh + điểm) Lấy key Gemini miễn phí — xem 3 bước bên dưới — rồi bấm ⚙️ **Cài đặt** → dán key → **Kiểm tra key** → **Lưu**.

### Lấy key Gemini miễn phí (3 bước)

1. Vào https://aistudio.google.com và đăng nhập bằng tài khoản Google bạn đang có.
2. Bấm **Get API key** → **Create API key** (chọn project mặc định nếu được hỏi).
3. Bấm **Copy**, rồi dán vào ⚙️ Cài đặt của trang. Không cần thẻ tín dụng.

> Gói miễn phí: Google có thể dùng nội dung gửi lên để cải thiện sản phẩm. Đừng dùng cho tài liệu riêng tư.

## Mỗi lần dùng

1. Mở video YouTube → bấm dấu trang **🎬 YT Scenes**.
2. Trang tự mở: có ngay **đoạn 5 phút + từ khóa + "lần đầu xuất hiện" + biểu đồ mật độ** (miễn phí, không cần key).
3. Muốn chia cảnh + chấm điểm: bấm **Chia cảnh + chấm điểm bằng AI** (hiện chi phí $0 với gói miễn phí). Cảnh hiện dần ngay khi từng phần xong, có thanh tiến độ + thời gian còn lại.
   - **Giữ tab mở** (để ở nền cũng được) trong lúc AI chạy. Lỡ đóng tab: lần sau mở trang sẽ tự chạy tiếp, phần đã xong không làm lại.
   - Hết lượt miễn phí trong ngày: trang hiện **"Tiếp tục lúc …"** (0h giờ Mỹ Thái Bình Dương, tức khoảng 14h–15h giờ Việt Nam) và tự chạy tiếp lúc đó nếu trang đang mở, hoặc khi bạn mở lại trang.

Bấm **▶ Mở video tại đây** ở bất kỳ cảnh, đoạn văn hay kết quả tìm kiếm nào để nghe đúng chỗ đó. Trang không hiện mốc giờ.
Không lấy được bản chép lời? Mở bản chép lời trên YouTube, copy, rồi **dán** hoặc **kéo thả file .txt** vào trang; điền link + thời lượng video để có nút mở video (thời gian được ước tính theo vị trí chữ).

## Nó làm gì

| Lớp | Cần key? | Chi tiết |
|---|---|---|
| Lấy chữ | Không | Bookmarklet đọc phụ đề (file phụ đề của player; nếu không được thì tự mở bảng "Hiện bản chép lời" và cuộn hết). Không tải video |
| Làm sạch | Không | Bỏ mốc giờ (`12:34`, "27 phút, 36 giây"), `[Âm nhạc]`, câu quảng cáo đầu/cuối, ghép thành câu có đánh số |
| Từ khóa miễn phí | Không | TF-IDF mỗi đoạn ~5 phút, đánh dấu tên/khái niệm **lần đầu xuất hiện**, biểu đồ mật độ từ khóa dọc video |
| Tìm kiếm | Không | Từ khóa + toàn văn, gõ không dấu được, hiểu **bảng tên nghe nhầm** (vd `Đen Di = Denji`) |
| Chia cảnh (AI) | Có (miễn phí) | Gửi từng đoạn ~1 giờ, AI chỉ trả JSON (câu bắt đầu, tiêu đề, từ khóa theo loại, 1 dòng tóm tắt). Không viết lại truyện. Chạy chậm mà chắc: giữ dưới ~80% hạn mức lượt/phút và token/phút, bị báo quá tải thì chờ đúng thời gian Google yêu cầu rồi tự chậm lại, hết lượt/ngày thì tạm dừng và tự chạy tiếp |
| Điểm + cốt truyện (AI) | Có (miễn phí) | 1 lần gọi nhỏ từ các tóm tắt cảnh |
| Lưu | Không | Mọi video nằm trong 1 kho cục bộ (IndexedDB). Mở lại = 0 lượt gọi AI |

**👤 Nhân vật** (trung tâm của trang): tự dò miễn phí các tên viết hoa lặp lại (không tính chữ đầu câu, bỏ danh xưng như Anh/Cô/Thứ Hai). Mỗi đoạn 5 phút có 2 hàng: **👤 Nhân vật** (tối đa 5, nhắc nhiều nhất) và **🔑 Từ khóa** (5 từ, không bao giờ là tên). Bảng nhân vật ở đầu trang: bấm tên = biểu đồ tên đó dọc video; ✕ = không phải nhân vật. ⚙️ Cài đặt → *Nhân vật*: mỗi dòng `cách viết khác = Tên đúng | vai trò`, dòng `- Tên` để ẩn; dùng cho mọi video. Phụ đề tự động hay viết thường hết tên: bấm **✨ Lập danh sách nhân vật** (1 lượt Gemini, gửi vài đoạn trích rải đều) để AI liệt kê tên, cách viết nghe nhầm và vai trò.
**Bảng tên nghe nhầm**: ⚙️ Cài đặt → mỗi dòng `sai, sai = đúng`. Dùng cho tìm kiếm, từ khóa miễn phí, và gửi kèm cho AI.
**🔌 FreeLLMAPI (tuỳ chọn)**: nếu máy bạn chạy FreeLLMAPI, trang gửi AI qua nó trước để đỡ hết lượt Gemini. ⚙️ Cài đặt → *Đường gửi AI* = Tự động (mặc định) / Chỉ FreeLLMAPI / Chỉ Gemini; mục *FreeLLMAPI*: địa chỉ (mặc định `http://localhost:3001/v1`), token (`freellmapi-…`), model (mặc định `auto:smart`), nút **Kiểm tra kết nối**. Làm 1 lần: thêm `https://daothiphuong2010.github.io` vào `DASHBOARD_ORIGINS` của FreeLLMAPI; Chrome hỏi quyền "thiết bị trong mạng cục bộ" thì bấm **Cho phép**. Máy tắt hoặc FreeLLMAPI lỗi: tự chuyển sang Gemini (hiện nhãn "Đang dùng Gemini"), Gemini vẫn được giãn nhịp như cũ.
**Hạn mức**: ⚙️ Cài đặt → *Hạn mức AI* đã điền sẵn (Gemini Flash miễn phí: 5 lượt/phút, 250.000 token/phút, 20 lượt/ngày). Google không công bố số cố định; số thật của key bạn ở [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit), sửa lại cho khớp nếu khác. Video rất dài mà ít lượt/ngày: tăng *Mỗi lượt AI đọc bao nhiêu phút audio* (vd 120) để cần ít lượt hơn.
**Đổi AI**: ⚙️ Cài đặt → Gemini (mặc định) / Claude Haiku (trả phí, rất rẻ) / API kiểu OpenAI. Tên model sửa được; **Kiểm tra key** liệt kê model có sẵn.

## Liên kết

- Sổ đăng ký chung của Super Tools: repo `daothiphuong2010/SuperTools` (`REGISTRY.md`).
- Sau này: nhận link từ menu Chia sẻ trên Android, đọc tóm tắt bằng giọng nói, tìm trên mọi video đã xử lý, gửi ý tưởng worldbuilding sang kho ý tưởng của app Gác cổng (Zalo/Messenger).

## Cho người phát triển (English)

- `app/` is the whole site: plain HTML + ES modules, no build, no dependencies. `app/bookmarklet.js` is the only YouTube-facing code (most fragile; fix only that file when YouTube changes). `app/js/ai.js` is the provider adapter (Gemini native API, Anthropic, OpenAI-compatible) with pacing + retry.
- **Content-agnostic core; genre lives in `app/js/modes.js`** (prompts, keyword categories, verdict labels). Ships `fanfic`; `podcast` and `lecture` are stubs (`ready: false`).
- **Data format** (one record per video, IndexedDB `ytscenes` / store `stories`):
  `{id, video_id, title, channel, url, duration, mode, segments:[{i, t, text}], sections:[{start, end, title, summary, keywords:[{text, category}]}], overview:{score, why, plot[]}, glossary:[{wrong[], right}], usage}`. `t` = seconds, used only for video links, never shown.
- Tests: `node --test tests/*.test.mjs`. Deploy: `.github/workflows/pages.yml` publishes `app/` to GitHub Pages on every push to `main`.
- No keys or secrets live in this repo: users paste their own key, stored in their browser's localStorage.
