import { DEFAULT_LIBRARY_FILE, DEFAULT_LIBRARY_URL, fetchLibraryEntries, writeJson } from '../src/server/library/service'

/**
 * 把远端词库抓下来写进仓库里的快照文件，之后应用默认只读这个本地文件。
 * 用法：npm run library:sync
 */
const remoteUrl = process.env.LIBRARY_URL ?? DEFAULT_LIBRARY_URL
const target = process.env.LIBRARY_FILE ?? DEFAULT_LIBRARY_FILE

const { entries, meta } = await fetchLibraryEntries(remoteUrl)
await writeJson(target, entries)

console.log(`词库已保存到 ${target}`)
console.log(`条目数：${meta.count}（来源：${remoteUrl}，时间：${meta.fetchedAt}）`)
