import { useState } from "react";
import { completeWaterChange, useEmergencyState, type EmergencyState } from "./store";
import { openOrderForTank } from "./occupancy";
import { fmtTime } from "./time";
import type { Tank } from "./types";

function TankCard({ tank, state }: { tank: Tank; state: EmergencyState }) {
  const openOrder = openOrderForTank(state.workOrders, tank.id);
  const [percent, setPercent] = useState(30);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const last = [...state.waterChanges].reverse().find((w) => w.tankId === tank.id);

  function submit() {
    const err = completeWaterChange(tank.id, percent, note.trim());
    setMessage(err ? { text: err, ok: false } : { text: `已完成 ${percent}% 换水`, ok: true });
    if (!err) setNote("");
  }

  return (
    <article className={openOrder ? "tank-card blocked" : "tank-card"}>
      <div className="holding-head">
        <h3>{tank.name}</h3>
        <span className="tag">{tank.waterType}</span>
      </div>
      <p className="hint">
        {last ? `上次换水 ${fmtTime(last.doneAt)} · ${last.percent}%` : "暂无换水记录"}
      </p>

      {openOrder ? (
        <>
          <p className="alert alert-danger">
            工单 {openOrder.id} 未结（{openOrder.status}：
            {openOrder.incidents.map((i) => i.reason).join("、")}），该鱼缸暂停换水
          </p>
          <button disabled>完成换水</button>
        </>
      ) : (
        <>
          <div className="form-row">
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
              <span>备注</span>
              <input
                placeholder="如：例行换水"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <button className="primary-action" onClick={submit}>
            完成换水
          </button>
        </>
      )}

      {message && (
        <p className={message.ok ? "alert alert-ok" : "alert alert-danger"}>{message.text}</p>
      )}
    </article>
  );
}

export function WaterChangePage() {
  const state = useEmergencyState();
  const records = [...state.waterChanges].reverse();

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>换水页</p>
            <h2>按缸换水</h2>
          </div>
        </div>
        <div className="tank-grid">
          {state.tanks.map((tank) => (
            <TankCard key={tank.id} tank={tank} state={state} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>记录</p>
            <h2>换水记录（{records.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {records.map((r) => {
            const tank = state.tanks.find((t) => t.id === r.tankId);
            return (
              <article key={r.id} className="record-card">
                <div className="record-index">{r.id.replace("WC-", "")}</div>
                <div>
                  <h3>{tank?.name ?? r.tankId}</h3>
                  <p>
                    {fmtTime(r.doneAt)} · 换水 {r.percent}%{r.note && ` · ${r.note}`}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
