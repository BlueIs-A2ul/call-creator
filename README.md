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
- `data/cache/library.json`：词库缓存
- `data/library.user.json`：自定义词条
- `data/library.hidden.json`：隐藏的内置词条

## 测试

```bash
npm test
npm run typecheck
```

## 说明

歌词版权归原平台与权利人所有。本工具仅用于本地个人编排，不提供公开分发。
