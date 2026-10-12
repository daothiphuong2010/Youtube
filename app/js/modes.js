// Everything genre-specific lives here: AI prompts, keyword categories, the verdict
// shown at the top. The rest of the app is content-agnostic.
// To add a genre: copy a mode, change its words, set ready: true.

const sceneRules = (what, cats) => `Bạn chia transcript ${what} (tiếng Việt, phụ đề tự động, có thể sai chính tả) thành các PHẦN theo nội dung.
Mỗi dòng là "số_câu|nội dung". KHÔNG viết lại transcript. Chỉ trả về JSON đúng dạng:
{"sections":[{"s":số_câu_bắt_đầu,"t":"tiêu đề ngắn ≤8 từ","k":{${Object.keys(cats).map(c => `"${c}":["${cats[c].toLowerCase()}"]`).join(',')}},"m":"tóm tắt 1 câu ≤25 từ"}]}`;

export const MODES = {
  fanfic: {
    ready: true,
    label: 'Truyện / fanfic audio',
    unit: 'cảnh',
    categories: { character: 'Nhân vật', power: 'Sức mạnh', place: 'Địa điểm', event: 'Sự kiện' },
    sectionSystem: sceneRules('truyện audio', { character: 'nhân vật', power: 'năng lực/sức mạnh/vật phẩm', place: 'địa điểm', event: 'sự kiện' }) + `
Quy tắc: phần mới (= cảnh) khi đổi bối cảnh/thời gian/xung đột chính; khoảng 4-12 cảnh mỗi giờ; tổng 5-8 từ khóa mỗi cảnh, tên chuẩn hóa nhất quán (cùng một nhân vật luôn cùng một tên); spoil thoải mái; không markdown.`,
    verdictSystem: `Bạn đánh giá một truyện audio dài dựa trên danh sách cảnh (tiêu đề + tóm tắt). Spoil thoải mái. Chỉ trả về JSON:
{"score":số 1-10 (đáng để tìm hiểu không, ưu tiên worldbuilding/hệ thống sức mạnh độc đáo),"why":"1 câu lý do","plot":["~10 dòng tóm tắt cốt truyện theo thứ tự, mỗi dòng ≤30 từ"]}`,
    verdict: { score: 'Đáng xem (1-10)', why: 'Lý do', lines: 'Cốt truyện' },
    castSystem: `Bạn đọc vài đoạn trích rải đều từ một truyện audio dài (phụ đề tự động tiếng Việt: tên riêng hay bị nghe nhầm, viết thường hoặc viết sai).
Liệt kê các NHÂN VẬT có tên (người, quỷ, sinh vật có tên riêng). Không đưa danh xưng chung (anh, cô, ông, thầy…), địa danh, tên chiêu thức.
Gộp mọi cách viết của cùng một nhân vật: "name" là tên chuẩn (đúng chính tả gốc nếu bạn biết, vd Denji), "aliases" là các cách viết khác/nghe nhầm THẬT SỰ có trong đoạn trích hoặc danh sách ứng viên.
Tối đa 30 nhân vật, quan trọng trước. Chỉ trả về JSON:
{"characters":[{"name":"tên chuẩn","aliases":["cách viết khác"],"role":"vai trò ≤12 từ"}]}`,
  },

  // Stubs: prompts sketched, not tested yet, hidden from the menu until ready.
  podcast: {
    ready: false,
    label: 'Podcast / talk show',
    unit: 'chủ đề',
    categories: { person: 'Người', topic: 'Chủ đề', work: 'Sách/tác phẩm', claim: 'Ý chính' },
    sectionSystem: sceneRules('podcast', { person: 'người được nhắc', topic: 'chủ đề', work: 'sách/tác phẩm/sản phẩm', claim: 'ý chính' }) + '\nQuy tắc: phần mới khi đổi chủ đề; 5-8 từ khóa; không markdown.',
    verdictSystem: '{"score":1-10 đáng nghe không,"why":"1 câu","plot":["~10 ý chính"]} — chỉ trả JSON.',
    verdict: { score: 'Đáng nghe (1-10)', why: 'Lý do', lines: 'Ý chính' },
  },
  lecture: {
    ready: false,
    label: 'Bài giảng / học tập',
    unit: 'mục',
    categories: { concept: 'Khái niệm', method: 'Phương pháp', example: 'Ví dụ', source: 'Tài liệu' },
    sectionSystem: sceneRules('bài giảng', { concept: 'khái niệm', method: 'phương pháp/công thức', example: 'ví dụ', source: 'tài liệu' }) + '\nQuy tắc: phần mới khi sang mục mới; 5-8 từ khóa; không markdown.',
    verdictSystem: '{"score":1-10 mức hữu ích,"why":"1 câu","plot":["~10 điều học được"]} — chỉ trả JSON.',
    verdict: { score: 'Hữu ích (1-10)', why: 'Lý do', lines: 'Điều học được' },
  },
};

export const DEFAULT_MODE = 'fanfic';
export const modeOf = rec => MODES[rec?.mode] || MODES[DEFAULT_MODE];
