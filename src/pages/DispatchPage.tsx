// 页面层 · 应急调度台：异常登记、暂养缸空位、工单调度

import { useState } from "react";
import { fmtTime, nowLocalInput } from "../emergency/format";
import { availableSlots, occupiedSlots, remainingSlots } from "../emergency/occupancy";
import {
  emergencyStore,
  incidentsOfOrder,
  openOrderForTank,
  transfersOfOrder,
  useEmergencyState,
  type ActionResult,
} from "../emergency/store";
import type { EmergencyState, IncidentReason, WorkOrder, WorkOrderStatus } from "../emergency/types";

const REASONS: IncidentReason[] = ["停电", "停水", "过滤故障"];

const STATUS_ORDER: WorkOrderStatus[] = ["待接单", "处理中", "待回缸", "已结案"];

const STATUS_CLASS: Record<WorkOrderStatus, string> = {
  待接单: "badge-todo",
  处理中: "badge-doing",
  待回缸: "badge-returning",
  已结案: "badge-done",
};

function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return <p className={`notice ${result.ok ? "ok" : "err"}`}>{result.message}</p>;
}

/** 异常登记表单 */
function IncidentForm({
  state,
  onResult,
}: {
  state: EmergencyState;
  onResult: (r: ActionResult) => void;
}) {
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const [reason, setReason] = useState<IncidentReason>("停电");
  const [startedAt, setStartedAt] = useState(nowLocalInput());

  return (
    <div className="form-grid three">
      <label>
        <span>鱼缸</span>
        <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
          {state.tanks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}（{t.waterType}·{t.fishCount}条{openOrderForTank(state, t.id) ? "·工单未结将并入" : ""}）
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>异常原因</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as IncidentReason)}>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>开始时刻</span>
        <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
      </label>
      <div className="form-actions">
        <button
          className="primary-action"
          onClick={() => onResult(emergencyStore.reportIncident({ tankId, reason, startedAt }))}
        >
          登记异常
        </button>
        <span className="hint">同一鱼缸已有未结工单时，新异常自动并入原工单</span>
      </div>
    </div>
  );
}

/** 暂养缸空位看板 */
function OccupancyBoard({ state }: { state: EmergencyState }) {
  return (
    <div className="occ-grid">
      {state.holdingTanks.map((h) => {
        const used = occupiedSlots(h.id, state.transfers);
        const left = remainingSlots(h, state.transfers);
        const pct = h.capacity === 0 ? 0 : Math.round((used / h.capacity) * 100);
        return (
          <article key={h.id} className="occ-card">
            <header>
              <strong>{h.name}</strong>
              <span className="chip">{h.waterType}</span>
            </header>
            <div className="occ-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <p>
              占用 {used} / 容量 {h.capacity} · 空位 {left}
            </p>
          </article>
        );
      })}
    </div>
  );
}

/** 单个工单卡片：接单、转移、恢复、逐条回缸 */
function WorkOrderCard({
  order,
  state,
  onResult,
}: {
  order: WorkOrder;
  state: EmergencyState;
  onResult: (r: ActionResult) => void;
}) {
  const tank = state.tanks.find((t) => t.id === order.tankId);
  const incidents = incidentsOfOrder(state, order.id);
  const transfers = transfersOfOrder(state, order.id);
  const [assignee, setAssignee] = useState("");
  const [expected, setExpected] = useState(nowLocalInput());
  const [count, setCount] = useState(tank?.fishCount ?? 1);

  if (!tank) return null;

  const canTransfer = order.status === "待接单" || order.status === "处理中";
  const slotsLeft = availableSlots(tank.waterType, state.holdingTanks, state.transfers);
  const pendingReturns = transfers.filter((t) => t.returnedAt === null);

  return (
    <article className="order-card">
      <header className="order-head">
        <div>
          <strong>{order.id}</strong> · {tank.name}（{tank.waterType}）
          <span className="hint"> 缸内现存 {tank.fishCount} 条</span>
        </div>
        <span className={`badge ${STATUS_CLASS[order.status]}`}>{order.status}</span>
      </header>

      <ul className="line-list">
        {incidents.map((i) => (
          <li key={i.id}>
            {i.id} · {i.reason} · 开始 {fmtTime(i.startedAt)}
            {i.merged && <em className="tag">并入</em>}
          </li>
        ))}
      </ul>

      {order.assignee && (
        <p className="meta">
          维护师 {order.assignee} · 预计恢复 {fmtTime(order.expectedRecoveryAt)}
        </p>
      )}
      {order.recoveredAt && <p className="meta">实际恢复 {fmtTime(order.recoveredAt)}</p>}
      {order.closedAt && <p className="meta">结案 {fmtTime(order.closedAt)}</p>}

      {transfers.length > 0 && (
        <ul className="line-list">
          {transfers.map((tr) => {
            const h = state.holdingTanks.find((x) => x.id === tr.toHoldingTankId);
            return (
              <li key={tr.id}>
                {tr.id} · {tr.fishCount}条 → {h?.name ?? tr.toHoldingTankId} · 移出 {fmtTime(tr.movedAt)} ·{" "}
                {tr.returnedAt ? `已回缸 ${fmtTime(tr.returnedAt)}` : "暂养中"}
                {order.status === "待回缸" && tr.returnedAt === null && (
                  <button
                    className="mini"
                    onClick={() => onResult(emergencyStore.confirmReturn(tr.id, nowLocalInput()))}
                  >
                    确认回缸
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="action-row">
        {order.status === "待接单" && (
          <>
            <input
              placeholder="维护师"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
            <input
              type="datetime-local"
              title="预计恢复时刻"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
            <button onClick={() => onResult(emergencyStore.assignWorkOrder(order.id, assignee, expected))}>
              接单
            </button>
          </>
        )}
        {canTransfer && (
          <>
            <input
              type="number"
              min={1}
              max={tank.fishCount}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <button onClick={() => onResult(emergencyStore.transferFish(order.id, count, nowLocalInput()))}>
              转移到同水质暂养缸
            </button>
            <span className="hint">
              {tank.waterType}空位 {slotsLeft}，不足将阻止捞鱼
            </span>
          </>
        )}
        {(order.status === "待接单" || order.status === "处理中") && (
          <button onClick={() => onResult(emergencyStore.markRecovered(order.id, nowLocalInput()))}>
            标记恢复
          </button>
        )}
        {order.status === "待回缸" && transfers.length === 0 && (
          <button onClick={() => onResult(emergencyStore.closeWorkOrder(order.id, nowLocalInput()))}>
            无暂养鱼只，直接结案
          </button>
        )}
        {order.status === "待回缸" && pendingReturns.length > 0 && (
          <span className="hint">待逐条确认回缸：{pendingReturns.length} 笔</span>
        )}
      </div>
    </article>
  );
}

export default function DispatchPage() {
  const state = useEmergencyState();
  const [notice, setNotice] = useState<ActionResult | null>(null);

  const sorted = [...state.workOrders].sort((a, b) => {
    const d = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
  });
  const openCount = state.workOrders.filter((o) => o.status !== "已结案").length;

  return (
    <>
      <Notice result={notice} />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>异常登记</p>
            <h2>停电 / 停水 / 过滤故障</h2>
          </div>
        </div>
        <IncidentForm state={state} onResult={setNotice} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>暂养缸空位</p>
            <h2>仅同水质可转入</h2>
          </div>
        </div>
        <OccupancyBoard state={state} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>工单调度</p>
            <h2>未结工单 {openCount} 起</h2>
          </div>
        </div>
        {sorted.length === 0 ? (
          <p className="hint">暂无工单</p>
        ) : (
          <div className="order-list">
            {sorted.map((o) => (
              <WorkOrderCard key={o.id} order={o} state={state} onResult={setNotice} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
