// src/utils/workOrderSort.ts

export type WorkOrderSortable = {
  createdAt?: string | null;
  startDate?: string | null;
};

/** Açılış tarihine göre en yeni üstte. */
export function sortWorkOrdersNewestFirst<T extends WorkOrderSortable>(orders: T[]): T[] {
  return [...orders].sort((a, b) => parseWorkOrderOpenTime(b) - parseWorkOrderOpenTime(a));
}

function parseWorkOrderOpenTime(order: WorkOrderSortable): number {
  const raw = order.createdAt ?? order.startDate;
  if (!raw?.trim()) return 0;

  let normalized = raw.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(normalized) && !normalized.includes('T')) {
    normalized = normalized.replace(' ', 'T') + ':00Z';
  }

  const t = new Date(normalized).getTime();
  return Number.isNaN(t) ? 0 : t;
}
