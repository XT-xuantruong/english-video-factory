# Claude Code skills

Hệ thống có hai skill tùy chọn, chạy sau khi CLI tạo `script.base.json` và `script.json`.

## `import-script`

Cải thiện một script:

```text
/import-script output/<content-id>/script.json
```

## `improve-script-all`

Cải thiện tuần tự toàn bộ:

```text
/improve-script-all
```

## Phạm vi được phép

Skill chỉ được sửa:

```text
scenes[*].audioSegments[*].text
```

khi segment gốc có:

```json
{
  "language": "vi",
  "rewritable": true
}
```

Không được sửa:

- intro cố định;
- câu hướng dẫn chính tả cố định;
- từ tiếng Anh;
- nghĩa, IPA, ví dụ, quiz và answer;
- `pauseBeforeMs`, `pauseAfterMs`;
- countdown, scene inputs, scene order, template hoặc blueprint;
- danh sách 5 từ trong video recall.

Recall item chỉ chứa English answer segment có `rewritable=false`; skill không được thay đổi voice của từng từ.

Validator so sánh với `script.base.json` và rollback nếu có thay đổi ngoài phạm vi.
