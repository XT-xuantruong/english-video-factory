---
name: import-script
description: Cải thiện lời thoại tiếng Việt của đúng một script.json trong English Video Factory. Chỉ viết lại text của audio segment có language=vi và rewritable=true; không thay scene, blueprint, template, input, timing, locked facts hoặc câu tiếng Anh.
---

# Import Script

Skill này được chạy thủ công sau khi CLI đã tạo `script.base.json` và `script.json`.
Tên skill được giữ theo chuẩn dự án: `import-script`; chức năng của nó là đọc và cải thiện **một** script đã có.

## Cách gọi

```text
/import-script output/<content-id>/script.json
```

Hoặc truyền content ID:

```text
/import-script <content-id>
```

Khi nhận content ID, resolve file tại:

```text
output/<content-id>/script.json
```

## Quy trình bắt buộc

1. Resolve đúng một `script.json`.
2. Kiểm tra cùng thư mục có `script.base.json`.
3. Đọc trước:
   - `references/rewrite-rules.md`
   - `references/protected-fields.md`
   - `references/bilingual-tts.md`
4. Validate script hiện tại trước khi sửa:

```bash
pnpm evf script validate --script <script-path>
```

5. Chỉ xem xét các segment có đồng thời:

```json
{
  "language": "vi",
  "rewritable": true
}
```

6. Chỉ được thay đổi trường:

```text
scenes[*].audioSegments[*].text
```

7. Không bắt buộc sửa mọi câu. Giữ nguyên câu đã tự nhiên.
8. Ghi đè đúng file `script.json`; tuyệt đối không sửa `script.base.json`.
9. Validate lại ngay sau khi ghi:

```bash
pnpm evf script validate --script <script-path>
```

10. Báo danh sách segment ID đã thay đổi.

## Ràng buộc tuyệt đối

Không được:

- thêm, xóa, gộp hoặc tách audio segment;
- thay số lượng hoặc thứ tự scene;
- thay `scene.id`, `role`, `kind`, `templateId`, `inputs`;
- thay `pauseBeforeMs`, `pauseAfterMs`, voice, style, rate, pitch hoặc language;
- thay word, IPA, nghĩa, ví dụ tiếng Anh, câu hỏi, lựa chọn, đáp án hoặc locked facts;
- sửa Excel, template, source code hoặc config;
- thêm kiến thức mới, Markdown, emoji hay URL.

Nếu validation sau khi sửa thất bại, khôi phục file về trạng thái trước lần chỉnh và dừng.


## Video meaning recall

Với script có `videoType=meaning_recall`:

- không sửa `lockedFacts.items`;
- không sửa meaning, blank, word, IPA hoặc countdown;
- mỗi `recall_item` chỉ có một segment tiếng Anh có `rewritable=false`;
- không thêm câu “Đáp án là” hoặc voice tiếng Việt vào từng item;
- không đổi `pauseBeforeMs`, vì đây là timestamp reveal đáp án.
