// 页面层 · 换水页：工单未结的鱼缸不能完成换水

import { useState } from "react";
import { fmtTime, nowLocalInput } from "../emergency/format";
import {
  emergencyStore,
  openOrderForTank,
  useEmergencyState,
  type ActionResult,
} from "../emergency/store";

export default function WaterChangePage() {
  const state = useEmergencyState();
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const [percent, setPercent] = useState(30);
  const [doneAt, setDoneAt] = useState(nowLocalInput());
  const [notice, setNotice] = useState<ActionResult | null>(null);

  const blocking = openOrderForTank(state, tankId);
  const records = [...state.waterChanges].sort((a, b) => b.doneAt.localeCompare(a.doneAt));

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>换水登记</p>
            <h2>完成换水</h2>
          </div>
        </div>
        {notice && <p className={`notice ${notice.ok ? "ok" : "err"}`}>{notice.message}</p>}
        <div className="form-grid three">
          <label>
            <span>鱼缸</span>
            <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
              {state.tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.waterType}·{t.fishCount}条）
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>换水量（%）</span>
            <input
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
          </label>
          <label>
            <span>换水时刻</span>
            <input type="datetime-local" value={doneAt} onChange={(e) => setDoneAt(e.target.value)} />
          </label>
          <div className="form-actions">
            <button
              className="primary-action"
              disabled={Boolean(blocking)}
              onClick={() => setNotice(emergencyStore.completeWaterChange(tankId, percent, doneAt))}
            >
              完成换水
            </button>
            {blocking && (
              <span className="hint danger">
                工单 {blocking.id} 未结（{blocking.status}），该缸暂停换水
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>换水状态</p>
            <h2>各鱼缸当前可否换水</h2>
          </div>
        </div>
        <ul className="line-list">
          {state.tanks.map((t) => {
            const open = openOrderForTank(state, t.id);
            return (
              <li key={t.id} className="tank-line">
                <span>
                  {t.name}（{t.waterType}·{t.fishCount}条）
                </span>
                {open ? (
                  <span className="badge badge-blocked">工单 {open.id} 未结 · 暂停换水</span>
                ) : (
                  <span className="badge badge-free">可换水</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>历史</p>
            <h2>换水记录</h2>
          </div>
        </div>
        {records.length === 0 ? (
          <p className="hint">暂无换水记录</p>
        ) : (
          <ul className="line-list">
            {records.map((r) => {
              const t = state.tanks.find((x) => x.id === r.tankId);
              return (
                <li key={r.id}>
                  {r.id} · {t?.name ?? r.tankId} · 换水 {r.percent}% · {fmtTime(r.doneAt)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
