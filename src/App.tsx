import { useState } from "react";
import DispatchPage from "./pages/DispatchPage";
import WaterChangePage from "./pages/WaterChangePage";
import "./styles.css";

type PageKey = "dispatch" | "water";

const PAGES: { key: PageKey; label: string }[] = [
  { key: "dispatch", label: "应急调度台" },
  { key: "water", label: "换水页" },
];

function App() {
  const [page, setPage] = useState<PageKey>("dispatch");

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-05 · port 5105 · 水族养护</p>
          <h1>水族店应急调度台</h1>
          <p className="subtitle">
            停电、停水、过滤故障不再靠口头招呼：登记异常生成工单，同水质暂养缸有位才转移，
            维护师接单写明预计恢复时刻，恢复后按转移记录逐条确认回缸；工单未结的鱼缸在换水页无法完成换水。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>记录 / 占用判定 / 页面 分层整理 · 无新增依赖</span>
        </div>
      </section>

      <nav className="page-tabs">
        {PAGES.map((p) => (
          <button
            key={p.key}
            className={page === p.key ? "active" : ""}
            onClick={() => setPage(p.key)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {page === "dispatch" ? <DispatchPage /> : <WaterChangePage />}
    </main>
  );
}

export default App;
