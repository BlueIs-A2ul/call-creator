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

## 数据

- `data/projects/*.json`：项目
- `data/library.user.json`：自定义词条
- `data/library.hidden.json`：隐藏的内置词条
- `data/cache/library.json`：`refresh=1` 刷新后留下的运行时缓存（可选，git 忽略）

## 词库

词库默认读仓库里的本地文件 `library/library.json`（当前 351 条），**启动与搜索都不联网**。

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

## 测试

```bash
npm test
npm run typecheck
```

## 说明

歌词版权归原平台与权利人所有。本工具仅用于本地个人编排，不提供公开分发。
