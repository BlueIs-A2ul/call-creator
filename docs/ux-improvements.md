# callCreator 体验评审与优化清单

> 评审基线：`npm run typecheck` 无错误，`npm test` 24 个文件 / 137 个用例全过。
> 下面每一条都标了代码位置，`状态` 一栏随实施更新。

## 一、会让人当场卡住的

### 1. 打开项目后没有回列表的路
`project-store.ts:48` 有 `clear()`，但整个 `src/web` 没有任何组件调用它；`App.tsx:20`
是 `!project` 才渲染 `ProjectList`，Toolbar 里也没有返回按钮。结果：进了某个项目之后
只能刷新浏览器才能换项目。
**状态：已完成** —— Toolbar 左侧新增「← 列表」，有未保存改动时先确认。

### 2. 没有 Ctrl+Z / Ctrl+Shift+Z
全项目零个 `keydown` 监听。撤销只能点按钮，且 `Toolbar.tsx:31-32` 两个按钮空历史时
也照点不误，没有任何反应。`Esc` 同样关不掉任何弹层（CallEditor / 导出 / 词库 / 间奏）。
**状态：已完成** —— `useHotkeys`（Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+S）+
`useEscapeKey`（所有弹层与抽屉）；撤销/重做按钮按历史长度 disabled。
弹层内的输入框不抢 Ctrl+Z，让浏览器原生撤销在草稿里正常工作。

### 3. 自动保存失败是静音的
`useAutosave.ts:38-43`：失败只 `console.error`，`dirty` 保持 true，Toolbar 永远显示
「保存中…」，用户以为在存、其实早就放弃了。而且 `attemptsRef` 只在成功时归零，
累计 3 次失败后**后续保存永久不再重试**。
**状态：已完成** —— store 增加 `saveStatus: idle | saving | error`；失败显示红色
「保存失败 · 重试」，重试按钮重置退避计数；编辑发生后重新获得重试预算。

### 4. 关标签就丢最后几秒的编辑
`useAutosave.ts:49-50`：800ms 防抖，卸载只 `clearTimeout`，没有 flush，也没有
`beforeunload`。
**状态：已完成** —— `visibilitychange`/`pagehide` 时用 `fetch({keepalive:true})`
兜一次底；只有「保存真的失败」时 `beforeunload` 才拦（正常输入不打扰）。

## 二、明显不顺手

| 问题 | 位置 | 状态 |
| --- | --- | --- |
| 词库一次渲染全部 351 条，打开就是一面墙 | `LibraryDrawer.tsx:65-80` | 已改：先渲染 30 条 + 「显示更多」 |
| 词库搜索框打开时不自动聚焦 | `LibraryDrawer.tsx:46` | 已改：`autoFocus` |
| 「刷新」无 loading 态；error/stale 成功后不清空 | `LibraryDrawer.tsx:18-26` | 已改：`busy` 态 + 成功后清空 |
| 搜不到结果时一片空白 | 同上 | 已改：空结果文案 |
| 删行 / 清 call 无即时反馈，撤销藏在右上角 | `SheetTable.tsx:154,178` | 已改：底部 toast + 「撤销」，5 秒消失 |
| 插入行后焦点不落到新行的歌词框 | `project-store.ts:93` | 已改：`insertRow` 返回新 id 并聚焦 |
| 打开项目无 loading 态 | `ProjectList.tsx:130` | 已改：卡片显示「打开中…」 |
| 后端挂了显示「还没有项目」 | `ProjectList.tsx:18` | 已改：区分「读取失败 + 重试」与「空列表」 |
| 弹层无 `role="dialog"`/`aria-modal`；保存状态无 `aria-live` | 各 modal | 已改 |
| 候选歌曲按钮 busy 时可连点 | `ProjectList.tsx:115` | 已改：busy 时禁用 |

## 三、后端已写好、前端没接的死功能

1. **`POST /api/import/xlsx`**（`server/app.ts:89`）前端零调用者，而 `InterludeDialog.tsx:49`
   的文案里还写着「表格导入」。
   **状态：已完成** —— 首页加「导入表格（.xlsx）」。
2. **词条 CRUD**：`POST/PUT/DELETE /api/library/user`、`PUT /api/library/hidden` 全有，前端全没接；
   `web/api.ts:43` 的 `addLibraryEntry` 定义了从未被调用。自定义词条只能手改 JSON。
   **状态：已完成** —— 词库抽屉加「新建词条」表单和自建词条的删除。
3. **`call.overrides` 是死字段**：`CallCell.tsx:33`、`export-map.ts:30,43` 都会读，但没有 UI 能写。
   **状态：已完成** —— CallEditor 里占位符输入分「本表默认」与「仅这个 call」两层；
   顺带把占位符改值从裸 `setState` 收进 `commit`，现在可撤销。

## 四、细节

- **间奏徽标会溢出**：`.col-no` 只有 88px（内容区约 75px），徽标 11px + `nowrap` 约 90px。
  **状态：已完成** —— 列宽 96px，取消 `nowrap`，允许换行。
- 行拖拽没有落点提示（`onDragOver` 只 `preventDefault()`）。
  **状态：已完成** —— 拖动时目标行顶部画一条高亮线。
- `selection-bar` 的 `top: 49px` 硬编码，和工具栏高度耦合。
  **状态：已完成** —— 收进 `--toolbar-h` 变量。
- README 用法列表里有两个连续的「5.」。
  **状态：已完成**

## 实施说明

- 没有新增测试文件（按要求尽量少做测试），只用 `typecheck` + 现有 137 个用例做回归。
- 行为改动都尽量保持既有 DOM 结构与文案，避免影响现有用例。
