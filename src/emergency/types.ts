// 应急调度台 · 领域类型（记录层）

export type WaterType = "淡水" | "海水" | "碱性硬水";

export type IncidentReason = "停电" | "停水" | "过滤故障";

export type WorkOrderStatus = "待接单" | "处理中" | "待回缸" | "已结案";

/** 鱼缸 */
export interface Tank {
  id: string;
  name: string;
  waterType: WaterType;
  fishCount: number; // 当前缸内鱼只数：转移出去扣减，确认回缸补回
}

/** 暂养缸 */
export interface HoldingTank {
  id: string;
  name: string;
  waterType: WaterType;
  capacity: number; // 可容纳鱼只数
}

/** 异常登记 */
export interface Incident {
  id: string;
  tankId: string;
  reason: IncidentReason;
  startedAt: string; // datetime-local 字符串
  workOrderId: string;
  merged: boolean; // true = 工单未结期间并入的新异常
}

/** 工单 */
export interface WorkOrder {
  id: string;
  tankId: string;
  status: WorkOrderStatus;
  assignee: string | null; // 接单维护师
  expectedRecoveryAt: string | null; // 预计恢复时刻
  recoveredAt: string | null; // 实际恢复时刻
  closedAt: string | null; // 结案时刻
  createdAt: string;
}

/** 鱼只转移记录 */
export interface Transfer {
  id: string;
  workOrderId: string;
  fromTankId: string;
  toHoldingTankId: string;
  fishCount: number;
  movedAt: string;
  returnedAt: string | null; // 确认回缸时刻；null = 仍在暂养
}

/** 换水记录 */
export interface WaterChange {
  id: string;
  tankId: string;
  percent: number;
  doneAt: string;
}

export interface EmergencyState {
  tanks: Tank[];
  holdingTanks: HoldingTank[];
  incidents: Incident[];
  workOrders: WorkOrder[];
  transfers: Transfer[];
  waterChanges: WaterChange[];
}
