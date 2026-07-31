# Protected fields

Validator chỉ chấp nhận thay đổi tại:

```text
scenes[*].audioSegments[*].text
```

và chỉ khi segment gốc có `rewritable=true`.

Tất cả phần dưới đây bị khóa:

- `version`, `renderer`, `contentType`, `blueprintId`, `themeId`;
- toàn bộ `metadata`, `video`, `lockedFacts`;
- số lượng, thứ tự và ID của scene;
- `role`, `kind`, `templateId`, `inputs`, `minDurationSec`, `transition`, `sfx`;
- số lượng, thứ tự và ID của audio segment;
- `language`, `displayText`, `voice`, `style`, `rate`, `pitch`, `pauseBeforeMs`, `pauseAfterMs`, `rewritable`, `sourceField`;
- `text` của mọi segment có `rewritable=false`.

Không sửa `script.base.json` trong bất kỳ trường hợp nào.

- `lockedFacts.items` và toàn bộ English answer segments của `meaning_recall`.
