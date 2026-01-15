import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export function toDateKey(date: Date, tz: string): string {
  return dayjs(date).tz(tz).format('YYYY-MM-DD');
}

export function parseDateKey(dateStr: string, tz: string): Date {
  return dayjs.tz(dateStr, 'YYYY-MM-DD', tz).toDate();
}
