# Architecture v3.2

```text
Excel
  ├── vocabulary
  └── vocabulary_recall
        ↓
packages/excel
        ↓
ContentInput
  ├── VocabularyContent
  └── VocabularyRecallContent
        ↓
packages/blueprints + packages/scenes
        ↓
packages/scripting
        ↓
script.base.json + script.json
        ↓
optional import-script / improve-script-all
        ↓
packages/quality
        ↓
packages/pipeline
  ├── VieNeu / Edge TTS
  ├── scene audio timeline
  ├── HyperFrames
  └── FFmpeg
        ↓
video.mp4
```

## Deterministic core

Runtime không gọi AI. Excel, environment và source version quyết định blueprint, scene order, narration nền và timing. Claude Code chỉ là bước chỉnh câu thủ công sau khi script đã được tạo.

## Hai video type

### `single_word`

```text
intro → word → examples → quiz → answer → outro
```

### `meaning_recall`

```text
intro → recall_item × 5 → summary
```

Blueprint recall cố định đúng 5 item để giữ nguyên nguyên tắc **fixed blueprint = fixed scene sequence**.

## Hai loại pause

```text
pauseBeforeMs
```

Dùng khi voice phải bắt đầu sau một khoảng im lặng. Recall item đặt:

```text
pauseBeforeMs = countdown_sec × 1000
```

Nhờ vậy scene hiện nghĩa và đếm ngược trước; đúng lúc answer reveal, Edge TTS mới đọc từ tiếng Anh.

```text
pauseAfterMs
```

Dùng cho khoảng dừng sau voice, bao gồm thời gian suy nghĩ của quiz single-word.

Python TTS không render pause. Node/FFmpeg sở hữu toàn bộ timeline.

## Countdown synchronization

### Single-word quiz

Pipeline tính:

```text
countdownDelaySec = start của segment cuối + duration của segment cuối
```

Template chỉ bắt đầu countdown sau khi voice hướng dẫn kết thúc.

### Meaning recall

Pipeline lấy:

```text
revealDelaySec = startSec của English answer segment
```

`startSec` đã bao gồm `pauseBeforeMs`, nên visual reveal và voice luôn đồng bộ.

## Protected narration

Dữ kiện Excel và mọi segment tiếng Anh có `rewritable=false`. Skill chỉ sửa câu tiếng Việt có `rewritable=true`.

Trong recall item, mỗi scene chỉ có một segment:

```json
{
  "language": "en",
  "text": "efficient",
  "pauseBeforeMs": 7000,
  "rewritable": false
}
```

## Template ownership

Không có effect registry. Mỗi scene template sở hữu layout, animation và timeline. Tất cả template dùng theme, palette và font chung.

## Recall ending

```text
vocabulary-recall-summary (main)
  - VieNeu lead-in
  - 5 × (Edge word → VieNeu meaning)

shared-channel-outro (outro)
  - channel logo or text fallback
  - brand + follow/heart CTA
```
