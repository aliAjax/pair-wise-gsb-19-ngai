import type { HoldingTank, Transfer, WaterType, WorkOrder } from "./types";

/** 某暂养缸当前被占的位置数（只计未回缸的转移） */
export function occupiedSlots(holdingTankId: string, transfers: Transfer[]): number {
  return transfers
    .filter((t) => t.holdingTankId === holdingTankId && !t.returnedAt)
    .reduce((sum, t) => sum + t.count, 0);
}

/** 某暂养缸剩余空位 */
export function freeSlots(holdingTank: HoldingTank, transfers: Transfer[]): number {
  return Math.max(0, holdingTank.capacity - occupiedSlots(holdingTank.id, transfers));
}

export interface Candidate {
  holdingTank: HoldingTank;
  free: number;
}

/** 可转入的暂养缸：水质类型相同且尚有空位 */
export function candidateHoldingTanks(
  waterType: WaterType,
  holdingTanks: HoldingTank[],
  transfers: Transfer[]
): Candidate[] {
  return holdingTanks
    .filter((h) => h.waterType === waterType)
    .map((h) => ({ holdingTank: h, free: freeSlots(h, transfers) }))
    .filter((c) => c.free > 0);
}

/** 位置够不够捞这一批鱼 */
export function canNet(holdingTank: HoldingTank, transfers: Transfer[], count: number): boolean {
  return Number.isInteger(count) && count > 0 && freeSlots(holdingTank, transfers) >= count;
}

/** 鱼缸当前未结案的工单（有则换水页禁止完成换水） */
export function openOrderForTank(workOrders: WorkOrder[], tankId: string): WorkOrder | undefined {
  return workOrders.find((o) => o.tankId === tankId && o.status !== "已结案");
}

/** 某工单尚未回缸的转移记录 */
export function unreturnedTransfers(orderId: string, transfers: Transfer[]): Transfer[] {
  return transfers.filter((t) => t.orderId === orderId && !t.returnedAt);
}
