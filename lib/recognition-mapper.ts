export type CanonicalMapping = Record<string, string>;

/** Very small helper for normalizing a mapped row into a canonical shape. */
export function normalizeRow(row: Record<string, any>, mapping: CanonicalMapping) {
  const out: Record<string, any> = {};
  if (mapping.name) out.name = row[mapping.name];
  if (mapping.shop) out.shop = row[mapping.shop];
  if (mapping.metric) out.metric = Number(row[mapping.metric]) || 0;
  return out;
}
