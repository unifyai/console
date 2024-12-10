/**
 * Truncates a number to two decimal places.
 * @param {number} num the number to be truncated
 * @returns {number} the truncated number
 */
export default function truncateToTwoDecimals(num: number) {
    return Math.floor(num * 100) / 100;
}
