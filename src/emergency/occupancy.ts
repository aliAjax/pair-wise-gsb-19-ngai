// 占用判定：纯函数，只读记录，不依赖页面与存储实现

import type { HoldingTank, Transfer, WaterType } from "./types";

/** 一笔转移方案：往哪个暂养缸放多少条 */
export interface Allocation {
  holdingTankId: string;
  fishCount: number;
}

/** 仍在暂养中的转移（未确认回缸）才占用空位 */
export function isActiveTransfer(t: Transfer): boolean {
  return t.returnedAt === null;
}

/** 某暂养缸当前被占用的鱼只位数 */
export function occupiedSlots(holdingTankId: string, transfers: Transfer[]): number {
  return transfers
    .filter((t) => t.toHoldingTankId === holdingTankId && isActiveTransfer(t))
    .reduce((sum, t) => sum + t.fishCount, 0);
}

/** 某暂养缸剩余空位 */
export function remainingSlots(tank: HoldingTank, transfers: Transfer[]): number {
  return Math.max(0, tank.capacity - occupiedSlots(tank.id, transfers));
}

/** 某水质类型全部暂养缸的空位合计 */
export function availableSlots(
  waterType: WaterType,
  holdingTanks: HoldingTank[],
  transfers: Transfer[]
): number {
  return holdingTanks
    .filter((t) => t.waterType === waterType)
    .reduce((sum, t) => sum + remainingSlots(t, transfers), 0);
}

/**
 * 制定转移方案：只找水质类型相同且尚有空位的暂养缸，空位多的优先装满。
 * 空位合计装不下时返回 null —— 调用方必须阻止捞鱼。
 */
export function planTransfer(
  waterType: WaterType,
  fishCount: number,
  holdingTanks: HoldingTank[],
  transfers: Transfer[]
): Allocation[] | null {
  const candidates = holdingTanks
    .filter((t) => t.waterType === waterType)
    .map((tank) => ({ tank, remaining: remainingSlots(tank, transfers) }))
    .filter((c) => c.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const total = candidates.reduce((sum, c) => sum + c.remaining, 0);
  if (total < fishCount) return null;

  const plan: Allocation[] = [];
  let left = fishCount;
  for (const c of candidates) {
    if (left <= 0) break;
    const take = Math.min(c.remaining, left);
    plan.push({ holdingTankId: c.tank.id, fishCount: take });
    left -= take;
  }
  return plan;
}
