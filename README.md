# English Video Factory v3.2.1

Pipeline deterministic tạo video học tiếng Anh từ Excel:

```text
Excel
  ↓
Content resolver
  ↓
Fixed blueprint
  ↓
script.base.json + script.json
  ↓
Claude Code skills (tùy chọn)
  ↓
VieNeu + Edge TTS
  ↓
HyperFrames scenes
  ↓
FFmpeg
  ↓
video.mp4
```

## Thay đổi v3.2.1

- Scene tổng kết của `vocabulary-meaning-recall` đọc lần lượt từ tiếng Anh và nghĩa tiếng Việt.
- Thêm scene `shared-channel-outro` với logo kênh, brand và CTA follow/thả tim.
- CTA mặc định: **“Hãy follow kênh và thả tim để cập nhật thêm nhiều bài học mới nhé.”**
- Recall blueprint tăng từ 7 lên 8 scene.

## Thay đổi v3.2.0

- Quiz `spelling` có câu hướng dẫn riêng:

  > Hãy chọn cách viết đúng chính tả của từ sau đây.

- Thêm video `vocabulary-meaning-recall`:
  - hiển thị nghĩa tiếng Việt và chỗ trống;
  - đếm ngược 5–10 giây;
  - sau countdown mới hiện từ tiếng Anh;
  - voice của mỗi lượt chỉ đọc đúng từ tiếng Anh sau khi đáp án xuất hiện;
  - mỗi video cố định 5 từ;
  - scene cuối liệt kê lại toàn bộ 5 từ và nghĩa.
- Thêm `pauseBeforeMs` cho audio timeline để đồng bộ thời điểm reveal và voice.
- Thêm sheet Excel `vocabulary_recall`.
- Thêm hai scene template:
  - `vocabulary-recall-item`;
  - `vocabulary-recall-summary`.

Các thay đổi v3.1 vẫn được giữ:

- Intro single-word: **“Hôm nay mình cùng tìm hiểu về từ này nhá.”**
- VieNeu và Edge TTS đọc chậm hơn.
- Không còn từ đồng nghĩa.
- Font hỗ trợ tiếng Việt: `Segoe UI`, `Noto Sans`, Arial.
- Quiz có countdown thật.

## Loại video 1 — Single word

Mỗi blueprint có sáu scene:

```text
shared-intro
→ vocabulary-word
→ vocabulary-examples
→ vocabulary-quiz-<type>
→ vocabulary-answer-<type>
→ shared-outro
```

Quiz type:

```text
spelling
fill_blank
meaning
antonym
pronunciation
correct_sentence
```

## Loại video 2 — Meaning recall

Blueprint:

```text
vocabulary-meaning-recall
```

Cấu trúc cố định:

```text
shared-intro
→ vocabulary-recall-item × 5
→ vocabulary-recall-summary
→ shared-channel-outro
```

Scene `vocabulary-recall-summary` đọc lần lượt 5 cặp:

```text
English word → Vietnamese meaning
```

Scene `shared-channel-outro` hiển thị logo kênh và CTA follow/thả tim.

Timeline của mỗi từ:

```text
0s                     countdown_sec             cuối scene
│                            │                         │
├─ hiện nghĩa + chỗ trống ───┼─ hiện từ tiếng Anh ────┤
├─ countdown N → 1 ──────────┤                         │
                             └─ Edge TTS chỉ đọc word
```

## Cài đặt

```powershell
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
Copy-Item .env.example .env
```

Python TTS:

```powershell
python -m venv services/tts-python/.venv
services/tts-python/.venv/Scripts/Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e "services/tts-python[vieneu,dev]"
pnpm tts:start
```

## Kiểm tra input

```powershell
pnpm evf doctor
pnpm evf content validate --excel data/content.xlsx
pnpm evf content list --excel data/content.xlsx --enabled
pnpm evf blueprints list
```

## Tạo video một từ

```powershell
pnpm evf script create `
  --excel data/content.xlsx `
  --id resilient-spelling `
  --force
```

Validate và render:

```powershell
pnpm evf script validate `
  --script output/resilient-spelling/script.json

pnpm evf video render `
  --script output/resilient-spelling/script.json `
  --quality draft `
  --force
```

## Tạo video recall 5 từ

Dùng `id` trong sheet `vocabulary_recall`:

```powershell
pnpm evf script create `
  --excel data/content.xlsx `
  --id daily-recall-01 `
  --force
```

Kết quả:

```text
output/daily-recall-01/
├── script.base.json
└── script.json
```

Render:

```powershell
pnpm evf video render `
  --script output/daily-recall-01/script.json `
  --quality draft `
  --force
```

Hoặc tạo và render trong một lệnh:

```powershell
pnpm evf video create `
  --excel data/content.xlsx `
  --id daily-recall-01 `
  --quality draft `
  --force
```

## Claude Code skills — tùy chọn

Một script:

```text
/import-script output/<content-id>/script.json
```

Toàn bộ script:

```text
/improve-script-all
```

Skill chỉ được sửa:

```text
scenes[*].audioSegments[*].text
```

với:

```json
{
  "language": "vi",
  "rewritable": true
}
```

Các word tiếng Anh trong video recall có `rewritable=false`; skill không được thay đổi chúng, `pauseBeforeMs`, countdown, inputs hoặc danh sách từ.

## Excel input

### Sheet `vocabulary`

```text
id, enabled, status, level, topic, word, ipa, part_of_speech,
meaning_vi, usage_vi, examples, quiz_type, quiz_question,
quiz_options, quiz_answer, quiz_explanation_vi, countdown_sec
```

### Sheet `vocabulary_recall`

```text
id, enabled, status, level, topic, word_ids, countdown_sec
```

`word_ids` phải chứa đúng 5 `id` từ sheet `vocabulary`, phân tách bằng `|` hoặc xuống dòng:

```text
resilient-spelling|adaptable-fill-blank|efficient-meaning|scarce-antonym|comfortable-pronunciation
```

`countdown_sec`: số nguyên từ 5 đến 10.

Chi tiết: `docs/EXCEL_SCHEMA.md`.

## TTS

```env
VIENEU_VOICE=Trúc Ly
VIENEU_STYLE=tu_nhien
VIENEU_RATE=0.94
EDGE_VOICE=en-US-AvaNeural
EDGE_RATE=-10%
SCRIPT_ENGLISH_RATE=-12%
```

Node/FFmpeg sở hữu timeline pause. Python TTS chỉ tổng hợp voice, không xử lý countdown.

## Template

Tất cả 18 scene template dùng theme `english-modern` và font hỗ trợ tiếng Việt:

```css
font-family: "Segoe UI", "Noto Sans", Arial, sans-serif;
```

Danh mục: `templates/CATALOG.md`.

## Kiểm thử

```powershell
pnpm typecheck
pnpm test
pnpm tts:test
```

## Recall summary và channel outro

Blueprint `vocabulary-meaning-recall` kết thúc bằng hai scene riêng:

```text
summary: đọc lần lượt từ tiếng Anh và nghĩa tiếng Việt của 5 từ
channel outro: logo kênh + CTA follow/thả tim
```

CTA mặc định:

```text
Hãy follow kênh và thả tim để cập nhật thêm nhiều bài học mới nhé.
```

Tùy chỉnh trong `.env`:

```env
RECALL_OUTRO_CTA=Hãy follow kênh và thả tim để cập nhật thêm nhiều bài học mới nhé.
CHANNEL_LOGO_URL=https://example.com/logo.png
CHANNEL_LOGO_TEXT=EMN
```

`CHANNEL_LOGO_URL` có thể để trống. Template sẽ hiển thị logo chữ từ `CHANNEL_LOGO_TEXT`.
