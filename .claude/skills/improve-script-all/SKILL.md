---
name: improve-script-all
description: Cải thiện tuần tự toàn bộ output/*/script.json trong English Video Factory. Chỉ viết lại text của audio segment tiếng Việt có rewritable=true; validate và rollback riêng từng script khi có lỗi.
---

# Improve Script All

Skill này chạy thủ công sau khi người dùng đã tạo nhiều script bằng CLI.
Nó xử lý tuần tự từng `output/*/script.json`; không gọi AI runtime và không render video.

## Cách gọi

```text
/improve-script-all
```

Có thể yêu cầu giới hạn theo thư mục output cụ thể trong câu lệnh tự nhiên, nhưng mặc định luôn quét:

```text
output/*/script.json
```

## Quy trình bắt buộc

1. Đọc trước:
   - `references/rewrite-rules.md`
   - `references/protected-fields.md`
   - `references/bilingual-tts.md`
2. Liệt kê các thư mục con trong `output/` theo thứ tự tên tăng dần.
3. Chỉ xử lý thư mục có đủ:

```text
script.base.json
script.json
```

4. Mỗi lần chỉ xử lý **một** script:
   - validate trước khi sửa;
   - giữ bản sao nội dung `script.json` hiện tại để rollback;
   - chỉ sửa `scenes[*].audioSegments[*].text` khi segment gốc có `language=vi` và `rewritable=true`;
   - ghi file;
   - validate ngay file đó.
5. Nếu một script validation lỗi:
   - khôi phục đúng nội dung trước lần sửa;
   - đánh dấu `failed`;
   - tiếp tục script kế tiếp.
6. Sau khi hoàn tất, chạy:

```bash
pnpm evf scripts validate-all
```

7. Báo tổng kết:
   - improved;
   - unchanged;
   - skipped vì thiếu base/script;
   - failed và nguyên nhân.

## Ràng buộc tuyệt đối

Không được:

- chạy song song nhiều script;
- sửa `script.base.json`;
- sửa Excel, template, source code hoặc config;
- thêm, xóa, gộp hoặc tách segment;
- thay scene, blueprint, template, inputs, `pauseBeforeMs`, `pauseAfterMs`, language hoặc metadata;
- sửa câu tiếng Anh hay dữ kiện khóa;
- bỏ qua validator khi một file lỗi.

Không bắt buộc thay đổi mọi script hoặc mọi câu. Script đã tự nhiên phải được ghi nhận là `unchanged`.


## Video meaning recall

Với script có `videoType=meaning_recall`:

- không sửa `lockedFacts.items`;
- không sửa meaning, blank, word, IPA hoặc countdown;
- mỗi `recall_item` chỉ có một segment tiếng Anh có `rewritable=false`;
- không thêm câu “Đáp án là” hoặc voice tiếng Việt vào từng item;
- không đổi `pauseBeforeMs`, vì đây là timestamp reveal đáp án.
