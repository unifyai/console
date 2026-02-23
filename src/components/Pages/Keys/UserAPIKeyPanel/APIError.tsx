'use client';

/**
 * APIError component displays an error message when something goes wrong while managing the API key.
 *
 * @param {{ message: string }} props
 * @prop {string} message - The error message to display.
 * @returns {JSX.Element} The APIError component.
 */
const APIError = ({ message }: { message: string }) => (
  <div className="APIError text-red-500">
    <p>{message}</p>
  </div>
);

export default APIError;
