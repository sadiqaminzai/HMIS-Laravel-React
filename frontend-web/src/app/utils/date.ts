export function formatDate(
  date: Date | string | undefined | null,
  timezone: string = 'Asia/Kabul',
  calendarOrOptions: 'gregorian' | 'shamsi' | Intl.DateTimeFormatOptions = 'gregorian',
  maybeOptions?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Check for invalid date
  if (isNaN(d.getTime())) return '-';

  let calendarType: 'gregorian' | 'shamsi' = 'gregorian';
  let options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };

  // Handle overloaded arguments
  if (typeof calendarOrOptions === 'object' && calendarOrOptions !== null) {
    options = calendarOrOptions;
  } else if (typeof calendarOrOptions === 'string') {
    calendarType = calendarOrOptions as 'gregorian' | 'shamsi';
    if (maybeOptions) options = maybeOptions;
  }

  try {
    const finalOptions: Intl.DateTimeFormatOptions = {
      ...options,
      timeZone: timezone,
      calendar: calendarType === 'shamsi' ? 'persian' : 'gregory'
    };

    return new Intl.DateTimeFormat('en-US', finalOptions).format(d);
  } catch (error) {
    // Fallback if timezone is invalid
    console.warn(`Error formatting date (tz: ${timezone}): ${error}`);
    try {
      const fallbackOptions: Intl.DateTimeFormatOptions = {
        ...options,
        timeZone: 'UTC',
        calendar: calendarType === 'shamsi' ? 'persian' : 'gregory'
      };
      return new Intl.DateTimeFormat('en-US', fallbackOptions).format(d);
    } catch (e) {
      return d.toLocaleString();
    }
  }
}

export function formatOnlyDate(
  date: Date | string | undefined | null,
  timezone: string = 'Asia/Kabul',
  calendarType: 'gregorian' | 'shamsi' = 'gregorian'
): string {
  return formatDate(date, timezone, calendarType, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatOnlyTime(
  date: Date | string | undefined | null,
  timezone: string = 'Asia/Kabul',
  calendarType: 'gregorian' | 'shamsi' = 'gregorian'
): string {
  // Time formatting doesn't change with calendar, but we keep consistency
  return formatDate(date, timezone, calendarType, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function getISODateInTimeZone(timezone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn(`Error getting ISO date (tz: ${timezone}): ${error}`);
    return date.toISOString().split('T')[0];
  }
}

export function getTimeInTimeZone(timezone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);

    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hour}:${minute}`;
  } catch (error) {
    console.warn(`Error getting time (tz: ${timezone}): ${error}`);
    const fallback = date.toTimeString().slice(0, 5);
    return fallback;
  }
}

export function getWeekdayFromDateString(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month, day));
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(utcDate);
}

export function parseDateOnly(value: Date | string | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(Date.UTC(year, month, day));
  }
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return undefined;
  return d;
}
