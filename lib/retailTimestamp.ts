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

const getRetailCalendarInfo = (rawDate: Date) => {
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

  let period = 12;
  let quarter = 4;
  let weekOfPeriod = PERIOD_WEEK_PATTERN[2];
  let cursor = new Date(yearStart);

  for (let index = 0; index < 12; index += 1) {
    let weeksInPeriod = PERIOD_WEEK_PATTERN[index % PERIOD_WEEK_PATTERN.length];
    if (index === 11 && hasLeapWeek) {
      weeksInPeriod += 1;
    }

    const periodStart = new Date(cursor);
    const periodEnd = new Date(cursor);
    periodEnd.setDate(periodEnd.getDate() + weeksInPeriod * 7 - 1);

    if (date >= periodStart && date <= periodEnd) {
      period = index + 1;
      quarter = Math.floor(index / 3) + 1;
      const elapsed = date.getTime() - periodStart.getTime();
      weekOfPeriod = Math.floor(elapsed / MS_PER_WEEK) + 1;
      break;
    }

    cursor.setDate(cursor.getDate() + weeksInPeriod * 7);
  }

  return {
    quarter,
    period,
    week: Math.max(weekOfPeriod, 1),
    formattedDate: formatDate(date),
  };
};

export const buildRetailTimestampLabel = (targetDate: Date = new Date()): string => {
  const { quarter, period, week, formattedDate } = getRetailCalendarInfo(new Date(targetDate));
  return `Q${quarter}-P${period}-W${week} ${formattedDate}`;
};
