export interface WeekDay {
  dateKey: string;
}

export interface StaffRow {
  id: string;
  staff_name: string;
}

export interface ShiftLike {
  start_time?: string;
  end_time?: string;
  break_minutes?: number | null;
  label?: string | null;
}

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const EXPORT_HEADER = {
  Employee: 'Employee',
  Sunday: 'Sunday',
  Monday: 'Monday',
  Tuesday: 'Tuesday',
  Wednesday: 'Wednesday',
  Thursday: 'Thursday',
  Friday: 'Friday',
  Saturday: 'Saturday',
  'Total Hours': 'Total Hours',
} as const;

export function calculateHours(timeIn: string, timeOut: string, breakMinutes: number | null | undefined): number {
  if (!timeIn || !timeOut) return 0;

  const [inHour, inMin] = timeIn.split(':').map(Number);
  const [outHour, outMin] = timeOut.split(':').map(Number);

  const inMinutes = inHour * 60 + inMin;
  const outMinutes = outHour * 60 + outMin;

  let diff = outMinutes - inMinutes;
  if (diff < 0) diff += 24 * 60;

  const totalMinutes = diff - (breakMinutes ?? 0);
  return Math.max(0, totalMinutes / 60);
}

interface BuildExportRowsArgs {
  weekStart: Date;
  weekDays: WeekDay[];
  staff: StaffRow[];
  weeklyHours: Record<string, number>;
  getShiftForDay: (employeeId: string, dateKey: string) => ShiftLike | undefined;
}

export function buildExportRows({ weekStart, weekDays, staff, weeklyHours, getShiftForDay }: BuildExportRowsArgs) {
  const rows: Record<string, string>[] = [EXPORT_HEADER as Record<string, string>];

  staff.forEach((emp) => {
    const row: Record<string, string> = {
      Employee: emp.staff_name,
      Sunday: '',
      Monday: '',
      Tuesday: '',
      Wednesday: '',
      Thursday: '',
      Friday: '',
      Saturday: '',
      'Total Hours': (weeklyHours[emp.id] || 0).toFixed(1),
    };

    weekDays.forEach((day, index) => {
      const shift = getShiftForDay(emp.id, day.dateKey);
      const dayName = DAY_LABELS[index];

      if (!shift) return;

      if (shift.start_time && shift.end_time) {
        const hours = calculateHours(shift.start_time, shift.end_time, shift.break_minutes);
        row[dayName] = `${shift.start_time} - ${shift.end_time} (${hours.toFixed(1)}h)`;
      } else if (shift.label) {
        row[dayName] = shift.label;
      } else {
        row[dayName] = 'Scheduled';
      }
    });

    rows.push(row);
  });

  const filename = `Schedule_${weekStart.toISOString().slice(0,10)}.xlsx`;

  return { rows, filename };
}
