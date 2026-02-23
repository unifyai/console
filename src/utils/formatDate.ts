/**
 * Formats a Date object into a human-readable string based on the specified format.
 *
 * @param date - The Date object to format.
 * @param format - The format string (default is 'DD MMM YYYY, HH:mm:ss').
 * @returns A formatted date string.
 */
export const formatDate = (date: Date, format = 'DD MMM YYYY, HH:mm:ss'): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  switch (format) {
    case 'DD MMM YYYY':
      return `${day} ${month} ${year}`;
    case 'DD MMM YYYY, HH:mm:ss':
      return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
};
