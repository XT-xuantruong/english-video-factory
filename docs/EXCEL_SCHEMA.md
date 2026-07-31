# Excel schema v3.2

Input duy nhất là `data/content.xlsx`. Mỗi content type nằm trong một sheet.

## Sheet `vocabulary`

| Cột | Bắt buộc | Mô tả |
|---|---:|---|
| `id` | có | ID chữ thường, số và dấu `-` |
| `enabled` | có | `true` hoặc `false` |
| `status` | có | `draft`, `ready`, `published` |
| `level` | có | A1, A2, B1... |
| `topic` | có | Chủ đề |
| `word` | có | Từ tiếng Anh |
| `ipa` | có | IPA chỉ để hiển thị |
| `part_of_speech` | không | Loại từ |
| `meaning_vi` | có | Nghĩa tiếng Việt |
| `usage_vi` | có | Cách dùng |
| `examples` | có | 2–3 dòng; mỗi dòng `sentence_en || meaning_vi || explanation_vi` |
| `quiz_type` | có | `spelling`, `fill_blank`, `meaning`, `antonym`, `pronunciation`, `correct_sentence` |
| `quiz_question` | có | Câu hỏi |
| `quiz_options` | có | 2–4 lựa chọn, mỗi lựa chọn một dòng |
| `quiz_answer` | có | Phải trùng chính xác một lựa chọn |
| `quiz_explanation_vi` | có | Giải thích đáp án |
| `countdown_sec` | có | Số nguyên từ 5 đến 10 |

## Sheet `vocabulary_recall`

Mỗi dòng tạo một video recall đúng 5 từ.

| Cột | Bắt buộc | Mô tả |
|---|---:|---|
| `id` | có | Video/content id |
| `enabled` | có | `true` hoặc `false` |
| `status` | có | `draft`, `ready`, `published` |
| `level` | có | Level hiển thị ở intro |
| `topic` | có | Chủ đề video |
| `word_ids` | có | Đúng 5 id tồn tại trong sheet `vocabulary` |
| `countdown_sec` | có | Số nguyên từ 5 đến 10 |

`word_ids` phân tách bằng dấu `|` hoặc xuống dòng:

```text
resilient-spelling|adaptable-fill-blank|efficient-meaning|scarce-antonym|comfortable-pronunciation
```

Ràng buộc:

- phải có đúng 5 id;
- không được trùng nhau;
- mọi id phải tồn tại trong sheet `vocabulary`;
- các vocabulary được tham chiếu phải có `enabled=true`.

Đã bỏ `similar_words`, `hook` và quiz `synonym`. Intro và outro do hệ thống tạo, không nhập trong Excel.
