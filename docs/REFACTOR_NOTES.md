# Refactor notes — v3.2

## Final scope

- Excel only; không có Google Sheets hoặc database.
- Scene templates và blueprints tách riêng.
- Không có effect layer.
- Single-word: một quiz type tương ứng một concrete blueprint.
- Meaning recall: một blueprint cố định gồm đúng 5 từ.
- Script luôn được tạo deterministic trước khi chạy Claude Code skill.
- `import-script` và `improve-script-all` chỉ rewrite câu tiếng Việt được phép.

## New in v3.2

- Quiz spelling có instruction riêng.
- Thêm sheet `vocabulary_recall`.
- Thêm `pauseBeforeMs` cho audio timeline.
- Thêm `vocabulary-recall-item` và `vocabulary-recall-summary`.
- Recall item reveal word và phát English voice tại cùng timestamp.
- Cuối video list lại đủ 5 từ.

## Pipeline retained

- `script.json` là boundary giữa content authoring và rendering.
- Render độc lập từng scene.
- Audio/clip cache và fit-to-narration.
- FFmpeg concat/mux, SRT, optional SFX và quality report.

## TTS

- Vietnamese: VieNeu.
- English: Edge TTS.
- IPA chỉ để hiển thị.
- Python TTS chỉ sinh voice; Node/FFmpeg quản lý mọi pause.
