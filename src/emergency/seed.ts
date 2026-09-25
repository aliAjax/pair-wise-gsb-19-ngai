// 初始数据（记录层）：鱼缸、暂养缸，以及一起处理中的演示工单

import { toLocalInputValue } from "./format";
import type { EmergencyState } from "./types";

const now = Date.now();
/** 相对当前时刻偏移 offsetMinutes 分钟的 datetime-local 字符串 */
const at = (offsetMinutes: number) => toLocalInputValue(new Date(now + offsetMinutes * 60_000));

export const seedState: EmergencyState = {
  tanks: [
    { id: "T1", name: "草缸A", waterType: "淡水", fishCount: 24 },
    { id: "T2", name: "海缸B", waterType: "海水", fishCount: 4 }, // 原有12条，8条已暂养
    { id: "T3", name: "三湖缸C", waterType: "碱性硬水", fishCount: 30 },
    { id: "T4", name: "繁殖缸D", waterType: "淡水", fishCount: 16 },
  ],
  holdingTanks: [
    { id: "H1", name: "暂养缸·淡1", waterType: "淡水", capacity: 20 },
    { id: "H2", name: "暂养缸·淡2", waterType: "淡水", capacity: 12 },
    { id: "H3", name: "暂养缸·海1", waterType: "海水", capacity: 10 },
    { id: "H4", name: "暂养缸·碱1", waterType: "碱性硬水", capacity: 15 },
  ],
  incidents: [
    { id: "INC-001", tankId: "T2", reason: "过滤故障", startedAt: at(-40), workOrderId: "WO-001", merged: false },
  ],
  workOrders: [
    {
      id: "WO-001",
      tankId: "T2",
      status: "处理中",
      assignee: "阿诚",
      expectedRecoveryAt: at(80),
      recoveredAt: null,
      closedAt: null,
      createdAt: at(-40),
    },
  ],
  transfers: [
    { id: "TR-001", workOrderId: "WO-001", fromTankId: "T2", toHoldingTankId: "H3", fishCount: 8, movedAt: at(-30), returnedAt: null },
  ],
  waterChanges: [
    { id: "WC-001", tankId: "T1", percent: 30, doneAt: at(-26 * 60) },
  ],
};

/** 各类记录编号计数，与 seedState 中已占用的编号衔接 */
export const seedSeq = { incident: 1, order: 1, transfer: 1, waterChange: 1 };
