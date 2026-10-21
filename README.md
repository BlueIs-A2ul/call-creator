# callCreator

把 QQ 音乐 / 网易云的歌曲链接转换成可编辑的「歌词 + call 词」双列表格。

## 开发

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://127.0.0.1:8787

## 生产

```bash
npm run build
npm start
```

然后打开 http://127.0.0.1:8787。

## 用法

1. 粘贴网易云 / QQ 音乐链接，或用「粘贴歌词」自己贴 LRC / 纯文本，生成歌词行；也可以用「导入表格（.xlsx）」把只有歌词列的表读成歌词行。
2. 单行为一个 call：点 Call 格填一段词。
3. **一个长 call 覆盖多行歌词**（歌中常见，不是只有间奏）：点行号选中起止几行（Shift 连选、Ctrl 多选），上方出现「应用一个 call」，从词库选词条即可——词条只取「罗马字」那段，按行切成几段分给每一行，块首写名称，右上角标 `2/4`。
4. 想单独调整某一行，点开它的 Call 编辑器改正文（名称/标签改动会同步整块）；「拆出这一行」可以把它从块里摘出来。
5. **删除 call**：选中整块后点上方「清除 call」一次清掉（歌词行保留）；也可以点某行 Call 格右下角的「清除」只清这一行；编辑器里还有「清空这个 call」。行号栏的 × 是**删除整行歌词**，别和它混。清掉块中间一行时，块会自动断成两块，撤销可以还原。
6. 导出的 xlsx 里，跨行的 call 会**纵向合并成一个单元格**（整段写在一起，行高按内容估算）；打印/PDF 则是每行显示自己那段。
7. 快捷键：`Ctrl+Z` 撤销、`Ctrl+Shift+Z` / `Ctrl+Y` 重做、`Ctrl+S` 立刻保存、`Esc` 关掉最上面那层弹窗。左上角「← 列表」回项目列表。

## 数据

- `data/projects/*.json`：项目
- `data/library.user.json`：自定义词条
- `data/library.hidden.json`：隐藏的内置词条
- `data/cache/library.json`：`refresh=1` 刷新后留下的运行时缓存（可选，git 忽略）

## 词库

词库默认读仓库里的本地文件 `library/library.json`（当前 351 条），**启动与搜索都不联网**。

词库抽屉里可以直接「新建词条」写进 `data/library.user.json`；自建词条（`origin: user`）在列表里带一个「删除」按钮，内置词条不能删。

更新词库有两种方式：

```bash
# 1. 把远端最新数据写回仓库里的快照文件（提交后团队/其他机器都用这份）
npm run library:sync

# 2. 只在运行时刷新一次（写入 data/cache/library.json，不改仓库文件）
#    界面上点词库面板的「刷新」，或请求 /api/library?refresh=1
```

相关环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LIBRARY_FILE` | `library/library.json` | 本地词库快照路径 |
| `LIBRARY_URL` | 上游地址 | 只有显式刷新或本地无数据时才会请求 |

优先级：`data/cache/library.json`（上次刷新结果）→ `library/library.json`（仓库快照）→ 远端（仅在既没缓存也没快照时兜底）。`/api/library` 的 `source` 字段会返回本次数据来自 `cache` / `local` / `remote`，刷新失败但回退到旧数据时 `stale` 为 `true`。

## 抓取失败时看什么

`/api/lyrics` 的失败都会带一个 `code` 和人话说明，界面直接显示这句说明；同时服务端终端会打一行 `[lyrics] ...` 或 `[server] ...`，出问题先看终端。

| code | HTTP | 含义 | 怎么办 |
| --- | --- | --- | --- |
| `INVALID_URL` | 400 | 链接不是歌单页 / 域名不在 `music.163.com`、`y.qq.com` 白名单内 | 换成歌曲详情页链接 |
| `NETWORK` | 502 | 连不上平台：DNS 失败、连接被重置、超时（10 秒）、平台返回 4xx/5xx | 多数是瞬时抖动，服务端已自动重试一次；仍失败就稍后再试或粘贴歌词 |
| `NO_LYRICS` | 422 | 歌存在但没有可用歌词，或 id 查不到 | 换版本，或粘贴歌词 |
| `PROVIDER_PARSE_ERROR` | 502 | 平台返回的不是 JSON（常见于被风控拦下） | 稍后再试 |
| `INTERNAL` | 500 | 本程序自身没料到的异常，`message` 里会带上原始原因 | 看终端堆栈，把那一行贴出来就能定位 |

## 测试

```bash
npm test
npm run typecheck
```

## 说明

歌词版权归原平台与权利人所有。本工具仅用于本地个人编排，不提供公开分发。
