# Changelog

## 0.1.0 — 2026-09-08

首个公开版本。

- 双击 ↑/↓ 在输入框里回溯本会话已发送消息；越过最新一条恢复草稿。
- 首次发布为 2026-08-21，随后在 2026-09-08 完成与 DSH 0.1.3-alpha.1 新 composer 的适配：
  - 编辑器判定同时识别 Lexical `contenteditable`（`[data-composer-input]`）与旧版 textarea；
  - 历史数据源改为优先读 chat 视图快照（`ChatSnapshot.order` / `nodes`），旧 `session.nodes` 兜底；
  - 斜杠/命令菜单打开时不劫持方向键；
  - 缺失 `useChat` / `useConversation` / `useSession` 时降级为空历史，不崩溃。