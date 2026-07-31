# Bilingual TTS rules

- Segment `vi` được VieNeu đọc.
- Segment `en` được Edge TTS đọc.
- Không đổi language.
- Không đưa từ tiếng Anh cần phát âm chuẩn vào giữa một câu Việt mới viết.
- Không tạo chuỗi chuyển giọng ở cấp từng từ.
- Câu tiếng Anh nguồn luôn có `rewritable=false` và phải giữ nguyên.
- IPA chỉ dùng để hiển thị; không đưa IPA vào câu thoại.
