# Scene Template Catalog

Tất cả template dùng theme `english-modern` và font stack hỗ trợ tiếng Việt:

```css
"Segoe UI", "Noto Sans", Arial, sans-serif
```

| Template | Kind | Mục đích |
|---|---|---|
| `shared-intro` | intro | Intro dùng chung cho single-word và recall |
| `vocabulary-word` | word | Word → IPA → nghĩa → cách dùng |
| `vocabulary-examples` | examples | Hiển thị lần lượt 2–3 ví dụ, nghĩa và giải thích |
| `vocabulary-quiz-spelling` | quiz | Quiz chính tả + đếm ngược 5–10 giây |
| `vocabulary-answer-spelling` | answer | Đáp án chính tả + giải thích |
| `vocabulary-quiz-fill-blank` | quiz | Quiz điền chỗ trống + đếm ngược |
| `vocabulary-answer-fill-blank` | answer | Đáp án điền chỗ trống + giải thích |
| `vocabulary-quiz-meaning` | quiz | Quiz chọn nghĩa + đếm ngược |
| `vocabulary-answer-meaning` | answer | Đáp án nghĩa + giải thích |
| `vocabulary-quiz-antonym` | quiz | Quiz từ trái nghĩa + đếm ngược |
| `vocabulary-answer-antonym` | answer | Đáp án từ trái nghĩa + giải thích |
| `vocabulary-quiz-pronunciation` | quiz | Quiz phân biệt phát âm + đếm ngược |
| `vocabulary-answer-pronunciation` | answer | Đáp án phát âm + giải thích |
| `vocabulary-quiz-correct-sentence` | quiz | Quiz chọn câu đúng + đếm ngược |
| `vocabulary-answer-correct-sentence` | answer | Đáp án câu đúng + giải thích |
| `shared-outro` | outro | Nhắc lại word, nghĩa và CTA |
| `vocabulary-recall-item` | recall_item | Nghĩa Việt + blank + countdown + reveal English word |
| `vocabulary-recall-summary` | summary | List lại 5 từ và nghĩa ở cuối video |

Single-word quiz nhận `countdownDelaySec` từ duration TTS thực tế. Recall item nhận `revealDelaySec` từ `pauseBeforeMs` của English answer segment.

- `shared-channel-outro`: logo kênh và CTA follow/thả tim cho recall video.
