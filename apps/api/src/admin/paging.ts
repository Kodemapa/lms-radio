export function pageArgs(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}
