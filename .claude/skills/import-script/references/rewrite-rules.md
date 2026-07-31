# Quy tắc viết lại lời thoại

Mục tiêu là làm câu thoại tiếng Việt tự nhiên, liền mạch và phù hợp TTS, nhưng không thay đổi dữ kiện.

## Phong cách bắt buộc

- Giọng thân thiện như một người hướng dẫn trẻ.
- Dùng câu dẫn tự nhiên: “Sau đây là một số ví dụ nhé.”, “Tiếp theo, mình cùng làm một bài tập nhỏ nhé.”, “Bạn nghĩ đáp án là gì?”.
- Ưu tiên câu ngắn, rõ, dễ nghe; mỗi câu nên dưới 35 từ.
- Giữ mạch: giới thiệu → ví dụ → bài tập → đáp án → nhắc lại.
- Tránh câu cụt, văn phong sách giáo khoa hoặc liệt kê máy móc.
- Không lạm dụng “nhé/nhá”; tối đa một lần trong một segment.
- Sửa lỗi chính tả và lỗi gõ tiếng Việt nếu có.

## Được phép

- Viết lại một câu đã có để nghe tự nhiên hơn.
- Rút gọn câu dài mà vẫn giữ đủ ý.
- Thêm từ nối bên trong chính segment đang sửa.
- Đổi cách xưng hô sang “mình”, “bạn”, “chúng ta” khi không làm đổi nghĩa.
- Giữ nguyên câu đã tự nhiên.

## Không được phép

- Thêm, xóa, gộp hoặc tách segment.
- Thêm kiến thức, ví dụ, đáp án hoặc lời khuyên mới.
- Đổi nghĩa, cách dùng, câu ví dụ hoặc giải thích quiz.
- Sửa segment có `rewritable=false`.
- Sửa câu intro cố định “Hôm nay mình cùng tìm hiểu về từ này nhá.”.
- Chèn Markdown, emoji, URL hoặc ký hiệu trang trí.

## Ví dụ

Trước:

```text
Sau đây sẽ là 1 số ví dụ nha.
```

Sau:

```text
Sau đây là một số ví dụ nhé.
```

Trước:

```text
Tiếp theo bạn hãy làm một bài tập nhỏ sau đây.
```

Sau:

```text
Tiếp theo, mình cùng làm một bài tập nhỏ nhé.
```
