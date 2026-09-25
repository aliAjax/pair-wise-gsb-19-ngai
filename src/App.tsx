import { useState } from "react";
import "./styles.css";
import { DispatchPage } from "./emergency/DispatchPage";
import { WaterChangePage } from "./emergency/WaterChangePage";
import { resetState } from "./emergency/store";

const tabs = [
  { key: "dispatch", label: "应急调度台" },
  { key: "water", label: "换水页" },
] as const;

type PageKey = (typeof tabs)[number]["key"];

function App() {
  const [page, setPage] = useState<PageKey>("dispatch");

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-05 · port 5105</p>
          <h1>水族店应急调度台</h1>
          <p className="subtitle">
            停电、停水、过滤故障统一登记开工单；转移鱼只只匹配水质相同且尚有空位的暂养缸，
            位置不够禁止捞鱼；维护师接单写明预计恢复时刻，恢复后按转移记录逐条确认回缸；
            工单未结的鱼缸在换水页不能完成换水。
          </p>
          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={page === t.key ? "tab active" : "tab"}
                onClick={() => setPage(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>记录 / 占用判定 / 页面 分层整理，无新增依赖</span>
          <button onClick={resetState}>重置演示数据</button>
        </div>
      </section>

      {page === "dispatch" ? <DispatchPage /> : <WaterChangePage />}
    </main>
  );
}

export default App;
