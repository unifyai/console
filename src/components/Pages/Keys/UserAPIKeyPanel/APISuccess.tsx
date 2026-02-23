'use client';

/**
 * APISuccess component displays a success message when something goes well while managing the API key.
 *
 * @param {{ message: string }} props
 * @prop {string} message - The success message to display.
 * @returns {JSX.Element} The APISuccess component.
 */
const APISuccess = ({ message }: { message: string }) => (
  <div className="APIError text-green-500">
    <p>{message}</p>
  </div>
);

export default APISuccess;
