import moment from 'moment';

interface TimeFormat {
  value: number;
  unit: string;
}

export function formatTime(seconds: number): TimeFormat {
  if (seconds === 0) return { value: 0, unit: 's' };

  // Convert to microseconds for easier comparison
  const microseconds = seconds * 1_000_000;

  if (microseconds < 1000) {
    return { value: microseconds, unit: 'μs' };
  }

  if (microseconds < 1_000_000) {
    return { value: microseconds / 1000, unit: 'ms' };
  }

  if (seconds < 60) {
    return { value: seconds, unit: 's' };
  }

  if (seconds < 3600) {
    return { value: seconds / 60, unit: 'min' };
  }

  return { value: seconds / 3600, unit: 'h' };
}

export function durationToTimeDelta(durationInMilliseconds: number) {
  const seconds = Math.floor(durationInMilliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const displayDays = days;
  const displayHours = hours % 24;
  const displayMinutes = minutes % 60;
  const displaySeconds = seconds % 60;

  return `${displayDays} days, ${displayHours}:${displayMinutes}:${displaySeconds}`;
}

export function timeDeltaValueToDuration(value: string) {
  // Parse Python timedelta format: "X days, HH:MM:SS" or "X day, HH:MM:SS"
  // Also handles negative: "-X days, HH:MM:SS"
  const match = value.match(/^(-?\d+)\s+days?,?\s*(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (match) {
    const [, days, hours, minutes, seconds, microseconds] = match;
    const totalMs =
      parseInt(days, 10) * 86400000 + // days to ms
      parseInt(hours, 10) * 3600000 + // hours to ms
      parseInt(minutes, 10) * 60000 + // minutes to ms
      parseInt(seconds, 10) * 1000 + // seconds to ms
      (microseconds ? parseInt(microseconds.padEnd(3, '0').slice(0, 3), 10) : 0); // microseconds to ms
    return totalMs;
  }

  // Fallback: try moment.js parsing for other formats (ISO 8601, etc.)
  const duration = moment.duration(value);
  const milliseconds = duration.asMilliseconds();
  return milliseconds;
}

export function timeValueToTime(value: string) {
  const now = new Date();
  const [hours, minutes, seconds] = value.split(':');
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );
}

export function formatTimeTypeValue(value: number, dataType: string) {
  switch (dataType) {
    case 'timestamp':
      return new Date(value).toISOString().replace('Z', '').replace('T', ' ');
    case 'time':
      return new Date(value).toISOString().split('T')[1].split('.')[0];
    case 'date':
      return new Date(value).toISOString().split('T')[0];
    case 'timedelta':
      return durationToTimeDelta(value);
    default:
      return new Date(value).toISOString().replace('Z', '').replace('T', ' ');
  }
}
