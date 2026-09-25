// 时间工具：datetime-local 表单值与显示格式

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocalInput(): string {
  return toLocalInputValue(new Date());
}

/** "2026-09-25T14:30" -> "2026-09-25 14:30"，空值显示占位符 */
export function fmtTime(v: string | null): string {
  return v ? v.replace("T", " ") : "—";
}
