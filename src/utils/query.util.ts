export interface QueryParamsResult {
  keys: unknown[];
  values: unknown[];
  columns: string;
  placeholders: string;
  setClause: string;
  whereClause: string;
}

export const queryParamsBuilder = (data: object): QueryParamsResult => {
  const keys = Object.keys(data);
  const values = Object.values(data);

  const columns = keys.join(', ');
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

  const setClause = keys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');

  const whereClause = keys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(' AND ');

  return {
    keys,
    columns,
    placeholders,
    values,
    setClause,
    whereClause,
  };
};