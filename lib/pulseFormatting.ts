const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const formatDecimal = (value: number | null) => {
  if (value === null) {
    return "--";
  }
  return value.toFixed(1);
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${formatDecimal(value)}%`;
};

const formatContestValue = (metricKey: string, value: number | null) => {
  if (value === null) {
    return "--";
  }
  const normalizedKey = metricKey.toLowerCase();
  if (normalizedKey.includes("sales") || normalizedKey.includes("dollar")) {
    return currencyFormatter.format(value);
  }
  return numberFormatter.format(value);
};

const normalizeShopNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  const stripped = text.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
};

export { currencyFormatter, numberFormatter, formatDecimal, formatPercent, formatContestValue, normalizeShopNumber };
