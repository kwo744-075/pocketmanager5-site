const PERIOD_WEEK_PATTERN = [5, 4, 4] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;

const formatDate = (date: Date) => {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const getYearAnchor = (year: number) => {
  const dec31 = new Date(year - 1, 11, 31);
  const anchor = new Date(dec31);
  while (anchor.getDay() !== 0) {
    anchor.setDate(anchor.getDate() - 1);
  }
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
};

export type RetailCalendarInfo = {
  quarter: number;
  period: number;
  weekOfPeriod: number;
  weeksInPeriod: number;
  periodStart: Date;
  periodEnd: Date;
  formattedDate: string;
};

export const getRetailCalendarInfo = (rawDate: Date = new Date()): RetailCalendarInfo => {
  const date = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());

  let fiscalYear = date.getFullYear();
  let yearStart = getYearAnchor(fiscalYear);
  if (date < yearStart) {
    fiscalYear -= 1;
    yearStart = getYearAnchor(fiscalYear);
  }

  const nextYearStart = getYearAnchor(fiscalYear + 1);
  const weeksInYear = Math.round((nextYearStart.getTime() - yearStart.getTime()) / MS_PER_WEEK);
  const hasLeapWeek = weeksInYear > 52;

  let resolvedInfo: RetailCalendarInfo | null = null;
  const cursor = new Date(yearStart);

  for (let index = 0; index < 12; index += 1) {
    let weeksInPeriod = PERIOD_WEEK_PATTERN[index % PERIOD_WEEK_PATTERN.length];
    if (index === 11 && hasLeapWeek) {
      weeksInPeriod += 1;
    }

    const periodStart = new Date(cursor);
    const periodEnd = new Date(cursor);
    periodEnd.setDate(periodEnd.getDate() + weeksInPeriod * 7 - 1);

    if (date >= periodStart && date <= periodEnd) {
      const elapsed = date.getTime() - periodStart.getTime();
      const weekOfPeriod = Math.min(weeksInPeriod, Math.max(Math.floor(elapsed / MS_PER_WEEK) + 1, 1));
      resolvedInfo = {
        quarter: Math.floor(index / 3) + 1,
        period: index + 1,
        weekOfPeriod,
        weeksInPeriod,
        periodStart,
        periodEnd,
        formattedDate: formatDate(date),
      };
      break;
    }

    cursor.setDate(cursor.getDate() + weeksInPeriod * 7);
  }

  if (!resolvedInfo) {
    const fallbackWeeks = PERIOD_WEEK_PATTERN[PERIOD_WEEK_PATTERN.length - 1];
    const periodStart = new Date(cursor);
    const periodEnd = new Date(cursor);
    periodEnd.setDate(periodEnd.getDate() + fallbackWeeks * 7 - 1);
    resolvedInfo = {
      quarter: 4,
      period: 12,
      weekOfPeriod: fallbackWeeks,
      weeksInPeriod: fallbackWeeks,
      periodStart,
      periodEnd,
      formattedDate: formatDate(date),
    };
  }

  return resolvedInfo;
};

export const buildRetailTimestampLabel = (targetDate: Date = new Date()): string => {
  const { quarter, period, weekOfPeriod, formattedDate } = getRetailCalendarInfo(new Date(targetDate));
  return `Q${quarter}-P${period}-W${weekOfPeriod} ${formattedDate}`;
};
