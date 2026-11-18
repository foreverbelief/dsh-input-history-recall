# dsh-input-history-recall

在 DeepSeek Harness（DSH）Web 输入框里**快速连按两次 ↑/↓**，回溯本会话已发送的消息，像终端历史一样上下翻。

Double-press <kbd>ArrowUp</kbd> / <kbd>ArrowDown</kbd> in the DSH Web composer to walk through this session's sent messages. Single press keeps native cursor movement.

- 单按：原生光标移动，不拦截
- 双击 ↑：往前翻一条本会话已发送的用户消息，填回输入框
- 双击 ↓：往回走；越过最新一条时恢复进入历史前正在打的草稿
- 无网络请求、不落盘、纯前端，按会话隔离

## 安装

### 方式一：作为 profile bundle（持久，推荐）

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
npm install github:foreverbelief/dsh-input-history-recall
```

然后在同一个 `package.json` 的 `dsh.profile.bundles` 数组里加一项：

```json
"dsh-input-history-recall"
```

重启 DSH（或刷新页面）即生效。

> 包内自带 `cordis.patch.yml`，作为 bundle 启动时会自动插入加载行；**不要**再往 profile 的 `cordis.patch.yml` 手动插行，否则会重复注册。

### 方式二：本地开发

```powershell
npm install file:D:/path/to/dsh-input-history-recall
```

同样加进 `dsh.profile.bundles`。改完 `lib/client.js` 刷新页面即可，HMR 会在 bundle 变化后换 rev。

## 使用

| 手势 | 行为 |
| --- | --- |
| 单按 ↑ / ↓ | 原生光标移动 / 选区 |
| 200ms 内连按两次 ↑ | 上一条已发送消息 |
| 200ms 内连按两次 ↓ | 下一条；到最新处恢复草稿 |
| 长按（自动重复） | 不拦截 |
| Shift + 方向键 | 不拦截（选区扩展） |
| 中文输入法组合中 | 不拦截 |
| 斜杠/命令菜单打开时 | 不拦截（方向键归菜单） |
| 命令提交中 / 忙碌态 | 不拦截 |

## 兼容性

- 适配 **DSH 0.1.3-alpha.1（2026-09-07）** 起的 Lexical `contenteditable` composer（`[data-composer-input]`），同时兼容旧版 textarea composer。
- 历史数据优先读 chat 视图快照（`ChatSnapshot.order` + `nodes`），回退到旧的 `session.nodes`；两者都缺失时降级为空历史，不会报错。
- 只支持 Web 端（`platform: "web"`）。
- 更高版本若改了 composer 或快照结构，可能失效。排查顺序：① 输入框是否仍带 `data-composer-input`；② chat 快照是否仍有 `order` 与 `nodes`；③ 插槽 `conversation.input.overlay` 是否仍存在。

## 实现

- **Host 半体**（`lib/index.js`）是空壳：只为让 Cordis Loader 激活入口，client-modules 扫描到入口后才会向浏览器提供 `/plugins/dsh-input-history-recall/client.js`。
- **Client 半体**（`lib/client.js`）向 `conversation.input.overlay` 插槽注册一个不渲染的组件，在 `document` 上挂 capture 阶段 `keydown`：
  - 200ms 内同键第二次按下才算手势，第一次直接放行；
  - 历史来自 `useChat`（权威）→ `useConversation` 视图存储 → 旧 `session.nodes`（兜底）；
  - 回填走输入机的 `inputActions.setDraft`，不直接改 DOM；
  - 自己写入草稿后记下 `appliedText`，用户手动改动即退出历史导航。

## 目录

```
lib/
  index.js              host 半体（空壳）
  client.js             浏览器半体（本插件的全部逻辑）
  types/                手写的 d.ts
cordis.patch.yml        bundle 补丁：插入 input-history-recall 加载行
package.json            dsh.bundle / dsh.client 元数据
```

## 开发

无构建步骤，`lib/client.js` 就是源码（`__ModuleLoader__` 包装的浏览器 bundle）。类型文件手写，与实现同步维护。

```powershell
npm run check   # node --check 两个入口
```

## English

**What it does.** Double-press <kbd>ArrowUp</kbd> in the composer to fill the previous user message from this session into the input; double-press <kbd>ArrowDown</kbd> to move forward, restoring the draft you had before entering history. Single presses, long presses, <kbd>Shift</kbd>+arrows, IME composition, and open slash menus are left untouched.

**Install.**

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
npm install github:foreverbelief/dsh-input-history-recall
```

Add `"dsh-input-history-recall"` to `dsh.profile.bundles` in the same `package.json`, then restart DSH. The package ships its own `cordis.patch.yml`, so do not insert the row manually.

**Compatibility.** Targets the Lexical `contenteditable` composer from DSH 0.1.3-alpha.1 (2026-09-07) and keeps a fallback for the legacy textarea. Web platform only. If a newer DSH changes the composer or the chat snapshot shape, the gesture may stop working — check `[data-composer-input]`, `ChatSnapshot.order`/`nodes`, and the `conversation.input.overlay` slot.

**How it works.** The host half is intentionally empty; the client half registers an invisible component in `conversation.input.overlay` and listens for `keydown` in the capture phase, using `inputActions.setDraft` to write history entries back into the composer.

## License

[MIT](LICENSE)