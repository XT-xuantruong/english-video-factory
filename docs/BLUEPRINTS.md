# Blueprints v3.2

## Single-word vocabulary

Mỗi dòng sheet `vocabulary` tạo một video theo `quiz_type`.

| quiz_type | blueprint | quiz scene | answer scene |
|---|---|---|---|
| `spelling` | `vocabulary-spelling` | `vocabulary-quiz-spelling` | `vocabulary-answer-spelling` |
| `fill_blank` | `vocabulary-fill-blank` | `vocabulary-quiz-fill-blank` | `vocabulary-answer-fill-blank` |
| `meaning` | `vocabulary-meaning` | `vocabulary-quiz-meaning` | `vocabulary-answer-meaning` |
| `antonym` | `vocabulary-antonym` | `vocabulary-quiz-antonym` | `vocabulary-answer-antonym` |
| `pronunciation` | `vocabulary-pronunciation` | `vocabulary-quiz-pronunciation` | `vocabulary-answer-pronunciation` |
| `correct_sentence` | `vocabulary-correct-sentence` | `vocabulary-quiz-correct-sentence` | `vocabulary-answer-correct-sentence` |

Cấu trúc:

```text
shared-intro
→ vocabulary-word
→ vocabulary-examples
→ vocabulary-quiz-<type>
→ vocabulary-answer-<type>
→ shared-outro
```

Quiz `spelling` dùng instruction cố định:

> Hãy chọn cách viết đúng chính tả của từ sau đây.

## Meaning-to-word recall

Sheet: `vocabulary_recall`

Blueprint:

```text
vocabulary-meaning-recall
```

Cấu trúc cố định:

```text
shared-intro
→ vocabulary-recall-item
→ vocabulary-recall-item
→ vocabulary-recall-item
→ vocabulary-recall-item
→ vocabulary-recall-item
→ vocabulary-recall-summary
→ shared-channel-outro
```

Mỗi `vocabulary-recall-item`:

1. Hiện nghĩa tiếng Việt và chỗ trống.
2. Countdown từ `countdown_sec` về 1.
3. Reveal từ tiếng Anh.
4. Edge TTS chỉ đọc đúng từ tiếng Anh.

Scene summary cuối liệt kê lại 5 từ và nghĩa.

### Vocabulary recall ending

- `vocabulary-recall-summary`: role `main`; đọc 5 cặp English word → Vietnamese meaning.
- `shared-channel-outro`: role `outro`; hiển thị logo kênh, brand, CTA follow và thả tim.
