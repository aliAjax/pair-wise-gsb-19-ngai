import { useState } from "react";
import {
  acceptOrder,
  confirmReturn,
  markRecovered,
  netFish,
  registerIncident,
  useEmergencyState,
  type EmergencyState,
} from "./store";
import {
  candidateHoldingTanks,
  canNet,
  freeSlots,
  occupiedSlots,
  unreturnedTransfers,
} from "./occupancy";
import { fmtTime, toInputValue } from "./time";
import type { IncidentReason, Tank, WorkOrder } from "./types";

const REASONS: IncidentReason[] = ["停电", "停水", "过滤故障"];

const STATUS_BADGE: Record<WorkOrder["status"], string> = {
  待接单: "badge badge-pending",
  维修中: "badge badge-working",
  待回缸: "badge badge-return",
  已结案: "badge badge-closed",
};

function IncidentForm({ tanks }: { tanks: Tank[] }) {
  const [tankId, setTankId] = useState(tanks[0]?.id ?? "");
  const [reason, setReason] = useState<IncidentReason>("停电");
  const [startedAt, setStartedAt] = useState(() => toInputValue(new Date()));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ text: string; merged: boolean } | null>(null);

  function submit() {
    if (!tankId || !startedAt) {
      setMessage({ text: "请选择鱼缸并填写开始时刻", merged: false });
      return;
    }
    const result = registerIncident({
      tankId,
      reason,
      startedAt: new Date(startedAt).toISOString(),
      note,
    });
    setMessage({
      text: result.merged
        ? `该鱼缸已有未结工单，新异常已并入 ${result.orderId}`
        : `已开新工单 ${result.orderId}，等待维护师接单`,
      merged: result.merged,
    });
    setNote("");
  }

  return (
    <>
      <h2>异常登记</h2>
      <div className="stack-form">
        <label>
          <span>鱼缸</span>
          <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.waterType}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>原因</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as IncidentReason)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span>开始时刻</span>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </label>
        <label>
          <span>备注</span>
          <input
            placeholder="如：主泵异响、片区停水"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="primary-action" onClick={submit}>
          登记异常
        </button>
        {message && (
          <p className={message.merged ? "alert alert-warn" : "alert alert-ok"}>{message.text}</p>
        )}
      </div>
    </>
  );
}

function HoldingBoard({ state }: { state: EmergencyState }) {
  return (
    <div className="holding-grid">
      {state.holdingTanks.map((h) => {
        const used = occupiedSlots(h.id, state.transfers);
        const free = freeSlots(h, state.transfers);
        return (
          <div className="holding-card" key={h.id}>
            <div className="holding-head">
              <strong>{h.name}</strong>
              <span className="tag">{h.waterType}</span>
            </div>
            <div className="meter">
              <i
                className={free === 0 ? "full" : ""}
                style={{ width: `${Math.min(100, (used / h.capacity) * 100)}%` }}
              />
            </div>
            <p className="hint">
              已占 {used} / 共 {h.capacity} 位 · 剩余 {free} 位
            </p>
          </div>
        );
      })}
    </div>
  );
}

function AcceptForm({ orderId }: { orderId: string }) {
  const [technician, setTechnician] = useState("");
  const [eta, setEta] = useState(() => toInputValue(new Date(Date.now() + 4 * 3600_000)));
  const [error, setError] = useState("");

  function submit() {
    const err = acceptOrder(orderId, technician.trim(), eta ? new Date(eta).toISOString() : "");
    setError(err ?? "");
  }

  return (
    <div className="stack-form">
      <p className="subhead">维护师接单</p>
      <div className="form-row">
        <label>
          <span>维护师</span>
          <input
            placeholder="姓名"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          />
        </label>
        <label>
          <span>预计恢复时刻</span>
          <input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
        </label>
        <button className="primary-action" onClick={submit}>
          接单
        </button>
      </div>
      {error && <p className="alert alert-danger">{error}</p>}
    </div>
  );
}

function TransferForm({ order, tank, state }: { order: WorkOrder; tank: Tank; state: EmergencyState }) {
  const candidates = candidateHoldingTanks(tank.waterType, state.holdingTanks, state.transfers);
  const [fish, setFish] = useState("");
  const [count, setCount] = useState(1);
  const [holdingId, setHoldingId] = useState("");
  const [error, setError] = useState("");

  const selected = candidates.find((c) => c.holdingTank.id === holdingId) ?? candidates[0];
  const enough = selected ? canNet(selected.holdingTank, state.transfers, count) : false;

  function submit() {
    if (!selected) return;
    const err = netFish(order.id, selected.holdingTank.id, fish.trim(), count);
    setError(err ?? "");
    if (!err) {
      setFish("");
      setCount(1);
    }
  }

  return (
    <div className="stack-form">
      <p className="subhead">鱼只转移（仅匹配{tank.waterType}暂养缸）</p>
      {candidates.length === 0 ? (
        <p className="alert alert-danger">没有水质相同且尚有空位的暂养缸，位置不够，禁止捞鱼</p>
      ) : (
        <>
          <div className="form-row">
            <label>
              <span>鱼只 / 批次</span>
              <input
                placeholder="如：红绿灯鱼"
                value={fish}
                onChange={(e) => setFish(e.target.value)}
              />
            </label>
            <label>
              <span>数量</span>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label>
              <span>暂养缸</span>
              <select
                value={selected?.holdingTank.id ?? ""}
                onChange={(e) => setHoldingId(e.target.value)}
              >
                {candidates.map((c) => (
                  <option key={c.holdingTank.id} value={c.holdingTank.id}>
                    {c.holdingTank.name}（剩 {c.free} 位）
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-action" disabled={!enough} onClick={submit}>
              捞鱼转移
            </button>
          </div>
          {selected && !enough && (
            <p className="alert alert-warn">
              「{selected.holdingTank.name}」仅剩 {selected.free} 位，位置不够，禁止捞鱼
            </p>
          )}
        </>
      )}
      {error && <p className="alert alert-danger">{error}</p>}
    </div>
  );
}

function TransferTable({ order, state }: { order: WorkOrder; state: EmergencyState }) {
  const rows = state.transfers.filter((t) => t.orderId === order.id);
  if (rows.length === 0) return <p className="hint">本工单尚未转移鱼只。</p>;
  return (
    <table className="transfer-table">
      <thead>
        <tr>
          <th>鱼只</th>
          <th>数量</th>
          <th>暂养缸</th>
          <th>捞出时刻</th>
          <th>回缸确认</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const holding = state.holdingTanks.find((h) => h.id === t.holdingTankId);
          return (
            <tr key={t.id}>
              <td>{t.fish}</td>
              <td>{t.count}</td>
              <td>{holding?.name ?? t.holdingTankId}</td>
              <td>{fmtTime(t.movedAt)}</td>
              <td>
                {t.returnedAt ? (
                  <span className="hint">已回缸 {fmtTime(t.returnedAt)}</span>
                ) : order.status === "待回缸" ? (
                  <button onClick={() => confirmReturn(t.id)}>确认回缸</button>
                ) : (
                  <span className="hint">待回缸</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OrderCard({ order, state }: { order: WorkOrder; state: EmergencyState }) {
  const tank = state.tanks.find((t) => t.id === order.tankId);
  if (!tank) return null;
  const pendingCount = unreturnedTransfers(order.id, state.transfers).length;
  const transferable = order.status === "待接单" || order.status === "维修中";

  return (
    <article className="order-card">
      <div className="order-head">
        <div>
          <h3>
            {order.id} · {tank.name}
          </h3>
          <span className="order-meta">
            {tank.waterType}缸 · 异常 {order.incidents.length} 起
          </span>
        </div>
        <span className={STATUS_BADGE[order.status]}>{order.status}</span>
      </div>

      <ul className="incident-list">
        {order.incidents.map((inc, i) => (
          <li key={inc.id}>
            <span className="tag">{inc.reason}</span>
            <span>{fmtTime(inc.startedAt)}</span>
            {inc.note && <span className="hint">{inc.note}</span>}
            {i > 0 && <span className="tag tag-merge">并入</span>}
          </li>
        ))}
      </ul>

      {order.status === "待接单" && <AcceptForm orderId={order.id} />}

      {order.status !== "待接单" && (
        <p className="hint">
          维护师 {order.technician} · 预计 {fmtTime(order.eta)} 恢复
          {order.recoveredAt && ` · 已于 ${fmtTime(order.recoveredAt)} 恢复`}
          {order.closedAt && ` · 已于 ${fmtTime(order.closedAt)} 结案`}
        </p>
      )}

      {order.status === "维修中" && (
        <div>
          <button className="primary-action" onClick={() => markRecovered(order.id)}>
            标记已恢复
          </button>
        </div>
      )}

      {order.status === "待回缸" && (
        <p className="alert alert-warn">
          已恢复供电/供水/过滤，请按当时转移的鱼只逐条确认回缸（剩 {pendingCount} 条）
        </p>
      )}

      {transferable && (
        <>
          <hr className="divider" />
          <TransferForm order={order} tank={tank} state={state} />
        </>
      )}

      <TransferTable order={order} state={state} />
    </article>
  );
}

export function DispatchPage() {
  const state = useEmergencyState();
  return (
    <>
      <section className="workspace">
        <aside className="panel narrow">
          <IncidentForm tanks={state.tanks} />
        </aside>
        <section className="panel">
          <div className="section-heading">
            <div>
              <p>占用判定</p>
              <h2>暂养缸占用</h2>
            </div>
          </div>
          <HoldingBoard state={state} />
        </section>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>应急调度</p>
            <h2>工单列表（{state.workOrders.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {state.workOrders.map((o) => (
            <OrderCard key={o.id} order={o} state={state} />
          ))}
        </div>
      </section>
    </>
  );
}
