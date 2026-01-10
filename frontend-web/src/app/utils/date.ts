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
