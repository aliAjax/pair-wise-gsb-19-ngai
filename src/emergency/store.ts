// 记录层：应急调度的全部状态、查询与变更动作；页面只读状态、调动作

import { useSyncExternalStore } from "react";
import { availableSlots, isActiveTransfer, planTransfer } from "./occupancy";
import { seedSeq, seedState } from "./seed";
import type {
  EmergencyState,
  Incident,
  IncidentReason,
  Transfer,
  WaterChange,
  WorkOrder,
} from "./types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

/* ---------- 查询 ---------- */

/** 鱼缸当前未结案的工单（有且只应有一个） */
export function openOrderForTank(state: EmergencyState, tankId: string): WorkOrder | undefined {
  return state.workOrders.find((o) => o.tankId === tankId && o.status !== "已结案");
}

export function incidentsOfOrder(state: EmergencyState, orderId: string): Incident[] {
  return state.incidents.filter((i) => i.workOrderId === orderId);
}

export function transfersOfOrder(state: EmergencyState, orderId: string): Transfer[] {
  return state.transfers.filter((t) => t.workOrderId === orderId);
}

/* ---------- 存储 ---------- */

type Seq = { incident: number; order: number; transfer: number; waterChange: number };

class EmergencyStore {
  private state: EmergencyState;
  private listeners = new Set<() => void>();
  private seq: Seq;

  constructor(initial: EmergencyState, seq: Seq) {
    this.state = initial;
    this.seq = { ...seq };
  }

  getState = (): EmergencyState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(next: EmergencyState): void {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  private nextId(kind: keyof Seq, prefix: string): string {
    this.seq[kind] += 1;
    return `${prefix}-${String(this.seq[kind]).padStart(3, "0")}`;
  }

  /** 登记异常：同缸有未结工单则并入原工单，否则生成新工单 */
  reportIncident(input: { tankId: string; reason: IncidentReason; startedAt: string }): ActionResult {
    const tank = this.state.tanks.find((t) => t.id === input.tankId);
    if (!tank) return fail("鱼缸不存在");
    if (!input.startedAt) return fail("请填写开始时刻");

    const existing = openOrderForTank(this.state, tank.id);
    const incident: Incident = {
      id: this.nextId("incident", "INC"),
      tankId: tank.id,
      reason: input.reason,
      startedAt: input.startedAt,
      workOrderId: existing ? existing.id : "",
      merged: Boolean(existing),
    };

    if (existing) {
      this.commit({ ...this.state, incidents: [...this.state.incidents, incident] });
      return ok(`${tank.name} 的工单 ${existing.id} 未结，新异常已并入原工单`);
    }

    const order: WorkOrder = {
      id: this.nextId("order", "WO"),
      tankId: tank.id,
      status: "待接单",
      assignee: null,
      expectedRecoveryAt: null,
      recoveredAt: null,
      closedAt: null,
      createdAt: input.startedAt,
    };
    incident.workOrderId = order.id;
    this.commit({
      ...this.state,
      incidents: [...this.state.incidents, incident],
      workOrders: [...this.state.workOrders, order],
    });
    return ok(`已登记 ${tank.name} 的异常，生成工单 ${order.id}`);
  }

  /** 维护师接单：写明维护师与预计恢复时刻 */
  assignWorkOrder(orderId: string, assignee: string, expectedRecoveryAt: string): ActionResult {
    const order = this.state.workOrders.find((o) => o.id === orderId);
    if (!order) return fail("工单不存在");
    if (order.status !== "待接单") return fail(`工单 ${order.id} 当前为「${order.status}」，不能接单`);
    if (!assignee.trim()) return fail("请填写维护师");
    if (!expectedRecoveryAt) return fail("请填写预计恢复时刻");

    this.commit({
      ...this.state,
      workOrders: this.state.workOrders.map((o) =>
        o.id === orderId
          ? { ...o, status: "处理中" as const, assignee: assignee.trim(), expectedRecoveryAt }
          : o
      ),
    });
    return ok(`工单 ${orderId} 已由 ${assignee.trim()} 接单，预计 ${expectedRecoveryAt.replace("T", " ")} 恢复`);
  }

  /** 转移鱼只：只占用同水质且有空位的暂养缸；空位不足则整体拒绝，不让捞鱼 */
  transferFish(orderId: string, fishCount: number, movedAt: string): ActionResult {
    const order = this.state.workOrders.find((o) => o.id === orderId);
    if (!order) return fail("工单不存在");
    if (order.status !== "待接单" && order.status !== "处理中")
      return fail(`工单 ${order.id} 已恢复或结案，不能再转移鱼只`);
    const tank = this.state.tanks.find((t) => t.id === order.tankId);
    if (!tank) return fail("鱼缸不存在");
    if (!Number.isInteger(fishCount) || fishCount <= 0) return fail("请填写正确的转移数量");
    if (fishCount > tank.fishCount)
      return fail(`${tank.name} 缸内仅剩 ${tank.fishCount} 条，无法转移 ${fishCount} 条`);

    const plan = planTransfer(tank.waterType, fishCount, this.state.holdingTanks, this.state.transfers);
    if (!plan) {
      const left = availableSlots(tank.waterType, this.state.holdingTanks, this.state.transfers);
      return fail(`空位不足：${tank.waterType}暂养缸仅剩 ${left} 个空位，装不下 ${fishCount} 条，已阻止捞鱼`);
    }

    const newTransfers: Transfer[] = plan.map((a) => ({
      id: this.nextId("transfer", "TR"),
      workOrderId: order.id,
      fromTankId: tank.id,
      toHoldingTankId: a.holdingTankId,
      fishCount: a.fishCount,
      movedAt,
      returnedAt: null,
    }));

    this.commit({
      ...this.state,
      transfers: [...this.state.transfers, ...newTransfers],
      tanks: this.state.tanks.map((t) =>
        t.id === tank.id ? { ...t, fishCount: t.fishCount - fishCount } : t
      ),
    });

    const detail = newTransfers
      .map((tr) => {
        const h = this.state.holdingTanks.find((x) => x.id === tr.toHoldingTankId);
        return `${tr.fishCount}条→${h ? h.name : tr.toHoldingTankId}`;
      })
      .join("，");
    return ok(`已转移 ${fishCount} 条（${detail}）`);
  }

  /** 标记恢复：工单进入待回缸 */
  markRecovered(orderId: string, recoveredAt: string): ActionResult {
    const order = this.state.workOrders.find((o) => o.id === orderId);
    if (!order) return fail("工单不存在");
    if (order.status !== "待接单" && order.status !== "处理中")
      return fail(`工单 ${order.id} 当前为「${order.status}」，不能标记恢复`);

    this.commit({
      ...this.state,
      workOrders: this.state.workOrders.map((o) =>
        o.id === orderId ? { ...o, status: "待回缸" as const, recoveredAt } : o
      ),
    });
    const pending = transfersOfOrder(this.state, orderId).filter(isActiveTransfer).length;
    return pending > 0
      ? ok(`工单 ${orderId} 已恢复，请按转移记录逐条确认 ${pending} 笔回缸`)
      : ok(`工单 ${orderId} 已恢复，无暂养鱼只，可结案`);
  }

  /** 逐条确认回缸；该工单的暂养鱼只全部归位后自动结案 */
  confirmReturn(transferId: string, returnedAt: string): ActionResult {
    const transfer = this.state.transfers.find((t) => t.id === transferId);
    if (!transfer) return fail("转移记录不存在");
    if (transfer.returnedAt !== null) return fail(`转移记录 ${transferId} 已确认过回缸`);
    const order = this.state.workOrders.find((o) => o.id === transfer.workOrderId);
    if (!order) return fail("工单不存在");
    if (order.status !== "待回缸") return fail(`工单 ${order.id} 尚未恢复，不能确认回缸`);

    const transfers = this.state.transfers.map((t) =>
      t.id === transferId ? { ...t, returnedAt } : t
    );
    const tanks = this.state.tanks.map((t) =>
      t.id === transfer.fromTankId ? { ...t, fishCount: t.fishCount + transfer.fishCount } : t
    );
    const stillOut = transfers.filter((t) => t.workOrderId === order.id && t.returnedAt === null).length;
    const workOrders = this.state.workOrders.map((o) =>
      o.id === order.id && stillOut === 0 ? { ...o, status: "已结案" as const, closedAt: returnedAt } : o
    );
    this.commit({ ...this.state, transfers, tanks, workOrders });

    return stillOut === 0
      ? ok(`${transfer.fishCount} 条已回缸，工单 ${order.id} 鱼只全部归位，自动结案`)
      : ok(`${transfer.fishCount} 条已回缸，还剩 ${stillOut} 笔暂养待确认`);
  }

  /** 无暂养鱼只的工单恢复后直接结案 */
  closeWorkOrder(orderId: string, closedAt: string): ActionResult {
    const order = this.state.workOrders.find((o) => o.id === orderId);
    if (!order) return fail("工单不存在");
    if (order.status !== "待回缸") return fail(`工单 ${order.id} 当前为「${order.status}」，不能结案`);
    const pending = transfersOfOrder(this.state, orderId).filter(isActiveTransfer).length;
    if (pending > 0) return fail(`还有 ${pending} 笔暂养未回缸，不能结案`);

    this.commit({
      ...this.state,
      workOrders: this.state.workOrders.map((o) =>
        o.id === orderId ? { ...o, status: "已结案" as const, closedAt } : o
      ),
    });
    return ok(`工单 ${orderId} 已结案`);
  }

  /** 完成换水：工单未结的鱼缸一律拒绝 */
  completeWaterChange(tankId: string, percent: number, doneAt: string): ActionResult {
    const tank = this.state.tanks.find((t) => t.id === tankId);
    if (!tank) return fail("鱼缸不存在");
    const open = openOrderForTank(this.state, tankId);
    if (open) return fail(`${tank.name} 的工单 ${open.id} 未结（${open.status}），不能完成换水`);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return fail("换水量需在 1–100% 之间");
    if (!doneAt) return fail("请填写换水时刻");

    const record: WaterChange = { id: this.nextId("waterChange", "WC"), tankId, percent, doneAt };
    this.commit({ ...this.state, waterChanges: [...this.state.waterChanges, record] });
    return ok(`${tank.name} 已完成 ${percent}% 换水`);
  }
}

export const emergencyStore = new EmergencyStore(seedState, seedSeq);

export function useEmergencyState(): EmergencyState {
  return useSyncExternalStore(emergencyStore.subscribe, emergencyStore.getState);
}
