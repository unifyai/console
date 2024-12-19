/* 
  Format number values depending on their type and scale.
  Uses scientific notation with two floating points for very large and very small floats.
  Uses regular notation with two floating points for other floats.
  Simply returns the string value of the number for ints.
*/
export const formatNumber = (number: number): string => {
  if (Number.isInteger(number))
    return number.toString()
  if (number > 1000 || number < 0.001)
    return number.toExponential(2)
  return number.toFixed(2)
};
  