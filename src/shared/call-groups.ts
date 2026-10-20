import type { Row } from './types'

export interface CallGroup {
  /** 同组共享的标识 */
  id: string
  /** 起始行下标（含） */
  start: number
  /** 结束行下标（含） */
  end: number
  rows: Row[]
}

/**
 * 一个 call 组 = 连续若干行，且这些行的 `call.groupId` 相同。
 * 同 id 但被别的行隔开时算两块，这样插入、拖拽、删行都不会让组关系变得含糊。
 */
export function readCallGroups(rows: Row[]): CallGroup[] {
  const groups: CallGroup[] = []
  let index = 0
  while (index < rows.length) {
    const id = rows[index].call?.groupId
    if (!id) {
      index += 1
      continue
    }
    let end = index
    while (end + 1 < rows.length && rows[end + 1].call?.groupId === id) end += 1
    groups.push({ id, start: index, end, rows: rows.slice(index, end + 1) })
    index = end + 1
  }
  return groups
}

export interface CallGroupSlot {
  group: CallGroup
  /** 本行是组内第几段（0 起） */
  slot: number
  /** 组内段数 */
  size: number
}

export function callGroupIndex(rows: Row[]): Map<string, CallGroupSlot> {
  const slots = new Map<string, CallGroupSlot>()
  for (const group of readCallGroups(rows)) {
    group.rows.forEach((row, slot) => {
      slots.set(row.id, { group, slot, size: group.rows.length })
    })
  }
  return slots
}

export function findCallGroup(rows: Row[], rowId: string): CallGroupSlot | null {
  return callGroupIndex(rows).get(rowId) ?? null
}

/** 块里各段按顺序拼起来，就是词库里的原始正文（用户改过哪段就是哪段生效）。 */
export function joinGroupText(group: CallGroup, transform: (row: Row) => string): string {
  return group.rows.map(transform).filter((text) => text.trim() !== '').join('\n')
}
