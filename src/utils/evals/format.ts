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

export function timeDeltaValueToDuration (value: string) {
    const duration = moment.duration(value);
    const milliseconds = duration.asMilliseconds();
    return milliseconds
}

export function timeValueToTime (value: string) {
    const now = new Date();
    const [hours, minutes, seconds] = value.split(":")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), parseInt(seconds));
}

export function formatTimeTypeValue(value: number, data_type: string) {
    switch (data_type) {
        case "timestamp":
            return new Date(value).toISOString().replace("Z", "").replace("T", " ")
        case "time":
            return new Date(value).toISOString().split("T")[1].split(".")[0]
        case "datetime":
            return new Date(value).toISOString().split("T")[0]
        case "timedelta":
            return durationToTimeDelta(value)
        default:
            return new Date(value).toISOString().replace("Z", "").replace("T", " ")
    }
}