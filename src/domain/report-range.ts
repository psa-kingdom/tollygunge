export function reportRange(params: URLSearchParams) {
  const parse = (key: string) => {
    const value = params.get(key);
    if (!value) return null;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value.startsWith("0000-") ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new Error("Choose valid report dates.");
    return value;
  };
  const from = parse("from"),
    to = parse("to");
  if (from && to && from > to)
    throw new Error("Start date must precede the end date.");
  return { from, to };
}
