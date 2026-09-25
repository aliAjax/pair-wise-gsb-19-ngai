import { useSyncExternalStore } from "react";
import type {
  HoldingTank,
  Incident,
  IncidentReason,
  Tank,
  Transfer,
  WaterChangeRecord,
  WorkOrder,
} from "./types";
import { canNet, openOrderForTank, unreturnedTransfers } from "./occupancy";

export interface EmergencyState {
  tanks: Tank[];
  holdingTanks: HoldingTank[];
  workOrders: WorkOrder[];
  transfers: Transfer[];
  waterChanges: WaterChangeRecord[];
  seq: { wo: number; inc: number; tr: number; wc: number };
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

function seedState(): EmergencyState {
  return {
    tanks: [
      { id: "T1", name: "草缸A", waterType: "淡水" },
      { id: "T2", name: "海缸B", waterType: "海水" },
      { id: "T3", name: "三湖缸C", waterType: "淡水" },
      { id: "T4", name: "繁殖缸D", waterType: "淡水" },
    ],
    holdingTanks: [
      { id: "H1", name: "暂养缸·淡水1号", waterType: "淡水", capacity: 20 },
      { id: "H2", name: "暂养缸·海水1号", waterType: "海水", capacity: 10 },
      { id: "H3", name: "暂养缸·淡水2号", waterType: "淡水", capacity: 6 },
    ],
    workOrders: [
      {
        id: "WO-01",
        tankId: "T2",
        incidents: [
          { id: "INC-01", reason: "过滤故障", startedAt: hoursFromNow(-3), note: "主过滤桶停转" },
        ],
        status: "维修中",
        technician: "阿涛",
        eta: hoursFromNow(5),
        recoveredAt: "",
        closedAt: "",
      },
      {
        id: "WO-02",
        tankId: "T1",
        incidents: [
          { id: "INC-02", reason: "停电", startedAt: hoursFromNow(-26), note: "片区检修停电" },
        ],
        status: "已结案",
        technician: "阿涛",
        eta: hoursFromNow(-23),
        recoveredAt: hoursFromNow(-22),
        closedAt: hoursFromNow(-21),
      },
    ],
    transfers: [
      {
        id: "TR-01",
        orderId: "WO-01",
        holdingTankId: "H2",
        fish: "小丑鱼",
        count: 6,
        movedAt: hoursFromNow(-2.5),
        returnedAt: "",
      },
      {
        id: "TR-02",
        orderId: "WO-02",
        holdingTankId: "H1",
        fish: "红鼻剪刀",
        count: 4,
        movedAt: hoursFromNow(-25),
        returnedAt: hoursFromNow(-21),
      },
    ],
    waterChanges: [
      { id: "WC-01", tankId: "T3", percent: 30, note: "例行换水", doneAt: hoursFromNow(-30) },
    ],
    seq: { wo: 3, inc: 3, tr: 3, wc: 2 },
  };
}

let state: EmergencyState = seedState();
const listeners = new Set<() => void>();

function setState(next: EmergencyState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEmergencyState(): EmergencyState {
  return useSyncExternalStore(subscribe, () => state);
}

export function resetState() {
  setState(seedState());
}

/** 登记异常：同缸有未结工单则并入原工单，否则开新工单 */
export function registerIncident(input: {
  tankId: string;
  reason: IncidentReason;
  startedAt: string;
  note: string;
}): { orderId: string; merged: boolean } {
  const incident: Incident = {
    id: `INC-${String(state.seq.inc).padStart(2, "0")}`,
    reason: input.reason,
    startedAt: input.startedAt,
    note: input.note.trim(),
  };
  const existing = openOrderForTank(state.workOrders, input.tankId);
  if (existing) {
    setState({
      ...state,
      seq: { ...state.seq, inc: state.seq.inc + 1 },
      workOrders: state.workOrders.map((o) =>
        o.id === existing.id ? { ...o, incidents: [...o.incidents, incident] } : o
      ),
    });
    return { orderId: existing.id, merged: true };
  }
  const order: WorkOrder = {
    id: `WO-${String(state.seq.wo).padStart(2, "0")}`,
    tankId: input.tankId,
    incidents: [incident],
    status: "待接单",
    technician: "",
    eta: "",
    recoveredAt: "",
    closedAt: "",
  };
  setState({
    ...state,
    seq: { ...state.seq, inc: state.seq.inc + 1, wo: state.seq.wo + 1 },
    workOrders: [order, ...state.workOrders],
  });
  return { orderId: order.id, merged: false };
}

/** 维护师接单，写明预计恢复时刻 */
export function acceptOrder(orderId: string, technician: string, eta: string): string | null {
  const order = state.workOrders.find((o) => o.id === orderId);
  if (!order || order.status !== "待接单") return "工单不在待接单状态";
  if (!technician) return "请填写维护师姓名";
  if (!eta) return "请填写预计恢复时刻";
  setState({
    ...state,
    workOrders: state.workOrders.map((o) =>
      o.id === orderId ? { ...o, status: "维修中", technician, eta } : o
    ),
  });
  return null;
}

/** 标记恢复：有待回缸鱼只则转"待回缸"，否则直接结案 */
export function markRecovered(orderId: string): void {
  const order = state.workOrders.find((o) => o.id === orderId);
  if (!order || order.status !== "维修中") return;
  const now = new Date().toISOString();
  const hasPending = unreturnedTransfers(orderId, state.transfers).length > 0;
  setState({
    ...state,
    workOrders: state.workOrders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: hasPending ? "待回缸" : "已结案",
            recoveredAt: now,
            closedAt: hasPending ? "" : now,
          }
        : o
    ),
  });
}

/** 捞鱼入暂养缸：只认水质相同且空位足够的缸，位置不够直接拒绝 */
export function netFish(
  orderId: string,
  holdingTankId: string,
  fish: string,
  count: number
): string | null {
  const order = state.workOrders.find((o) => o.id === orderId);
  if (!order) return "工单不存在";
  if (order.status !== "待接单" && order.status !== "维修中") return "工单已恢复，不能再捞出鱼只";
  const tank = state.tanks.find((t) => t.id === order.tankId);
  const holding = state.holdingTanks.find((h) => h.id === holdingTankId);
  if (!tank || !holding) return "鱼缸或暂养缸不存在";
  if (holding.waterType !== tank.waterType)
    return `水质类型不同（${tank.waterType}缸 → ${holding.waterType}暂养缸），不能转入`;
  if (!canNet(holding, state.transfers, count))
    return `「${holding.name}」空位不足，位置不够，禁止捞鱼`;
  const transfer: Transfer = {
    id: `TR-${String(state.seq.tr).padStart(2, "0")}`,
    orderId,
    holdingTankId,
    fish: fish || "未命名鱼只",
    count,
    movedAt: new Date().toISOString(),
    returnedAt: "",
  };
  setState({
    ...state,
    seq: { ...state.seq, tr: state.seq.tr + 1 },
    transfers: [...state.transfers, transfer],
  });
  return null;
}

/** 逐条确认回缸；该工单全部回缸后自动结案 */
export function confirmReturn(transferId: string): void {
  const transfer = state.transfers.find((t) => t.id === transferId);
  if (!transfer || transfer.returnedAt) return;
  const now = new Date().toISOString();
  const transfers = state.transfers.map((t) =>
    t.id === transferId ? { ...t, returnedAt: now } : t
  );
  let workOrders = state.workOrders;
  const order = workOrders.find((o) => o.id === transfer.orderId);
  if (order && order.status === "待回缸" && unreturnedTransfers(order.id, transfers).length === 0) {
    workOrders = workOrders.map((o) =>
      o.id === order.id ? { ...o, status: "已结案", closedAt: now } : o
    );
  }
  setState({ ...state, transfers, workOrders });
}

/** 完成换水：鱼缸有未结工单时拒绝 */
export function completeWaterChange(
  tankId: string,
  percent: number,
  note: string
): string | null {
  const open = openOrderForTank(state.workOrders, tankId);
  if (open) return `工单 ${open.id} 未结（${open.status}），该鱼缸不能完成换水`;
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100)
    return "换水量需在 1–100% 之间";
  const record: WaterChangeRecord = {
    id: `WC-${String(state.seq.wc).padStart(2, "0")}`,
    tankId,
    percent,
    note,
    doneAt: new Date().toISOString(),
  };
  setState({
    ...state,
    seq: { ...state.seq, wc: state.seq.wc + 1 },
    waterChanges: [...state.waterChanges, record],
  });
  return null;
}
