// Small ID helper used for records that live *inside* a JSONB column
// (timesheet entries, employee rate overrides) rather than as their own
// database table/row. Those get a client-generated id since they're never
// queried independently — the parent row (timesheet, employee) is the unit
// of storage.
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
