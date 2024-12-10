import BaseButton from "./Base";

/**
 * SecondaryButton is a secondary action button with a green background and white
 * text. It is used for actions that are not the primary action of a page, such
 * as cancel, delete, or edit.
 *
 * @example
 * <SecondaryButton onClick={() => console.log('Clicked')} label="Cancel" />
 *
 * @param {() => void} onClick - The function to call when the button is clicked.
 * @param {string} label - The text to display on the button.
 * @param {string} [className] - Additional CSS classes to add to the button.
 */
const SecondaryButton = ({ onClick, label, className, disabled=false }: {
  onClick: () => void;
  label: string;
  className?: string;  
  disabled?: boolean;
}) => {
  return (
    <BaseButton
      type="button"
      onClick={onClick}
      variant="outline"
      className={`px-7 py-3 w-fit ${className}`}
      text={label}
      disabled={disabled}
    />
  );
};

export default SecondaryButton;