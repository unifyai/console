/**
 * Returns a start date string in 'YYYY-MM-DD' format,
 * offset by the specified number of months from the current date.
 *
 * @param monthsAgo - Number of months to subtract from the current date.
 * @returns A formatted date string.
 */
export const getStartDate = (monthsAgo: number): string => {
  const date = new Date();
  date.setHours(0, 0, 0, 0); // Set to midnight
  date.setMonth(date.getMonth() - monthsAgo);
  return formatDateForPicker(date);
};

/**
 * Returns the current date string in 'YYYY-MM-DD' format.
 *
 * @returns A formatted date string.
 */
export const getEndDate = (): string => {
  const date = new Date();
  date.setHours(0, 0, 0, 0); // Set to midnight
  return formatDateForPicker(date);
};

/**
 * Formats a JavaScript Date object into 'YYYY-MM-DD HH:mm:ss' format.
 *
 * @param date - The Date object to format.
 * @returns A formatted date string.
 */
export const formatDateForPicker = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0'); // Months are zero-indexed
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  const time = `${hours}:${minutes}:${seconds}`;
  return `${year}-${month}-${day} ${time}`;
};