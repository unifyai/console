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