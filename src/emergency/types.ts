export type WaterType = "淡水" | "海水";

export interface Tank {
  id: string;
  name: string;
  waterType: WaterType;
}

export interface HoldingTank {
  id: string;
  name: string;
  waterType: WaterType;
  capacity: number;
}

export type IncidentReason = "停电" | "停水" | "过滤故障";

export interface Incident {
  id: string;
  reason: IncidentReason;
  startedAt: string; // ISO 时刻
  note: string;
}

export type WorkOrderStatus = "待接单" | "维修中" | "待回缸" | "已结案";

export interface WorkOrder {
  id: string;
  tankId: string;
  incidents: Incident[]; // 未结期间同缸新异常并入这里
  status: WorkOrderStatus;
  technician: string;
  eta: string; // 预计恢复时刻 ISO，未接单为 ""
  recoveredAt: string;
  closedAt: string;
}

export interface Transfer {
  id: string;
  orderId: string;
  holdingTankId: string;
  fish: string;
  count: number;
  movedAt: string;
  returnedAt: string; // 未回缸为 ""
}

export interface WaterChangeRecord {
  id: string;
  tankId: string;
  percent: number;
  note: string;
  doneAt: string;
}
