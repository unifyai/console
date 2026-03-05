'use client';

import { motion } from 'framer-motion';
import BaseButton from './Base';
import { ReactNode } from 'react';

/**
 * A styled primary button with a loading state and an optional success message.
 *
 * @example
 * <PrimaryButton onClick={() => console.log("Button clicked!")}>Click me!</PrimaryButton>
 *
 * @param {() => void} onClick - The function to call when the button is clicked.
 * @param {string} label - The label on the button.
 * @param {boolean} [isLoading=false] - Whether the button should show a loading animation.
 * @param {boolean} [disabled=false] - Whether the button is disabled.
 * @param {string} [successMessage] - An optional success message to show after the button is clicked.
 * @param {boolean} [showSuccess=false] - Whether to show the success message after the button is clicked.
 * @param {string} [className=""] - Additional CSS classes to add to the button.
 * @param {string} [type=""] - Optional button type.
 */
const PrimaryButton = ({
  onClick,
  label,
  icon = null,
  isLoading = false,
  disabled = false,
  successMessage,
  showSuccess = false,
  className = '',
  type = 'button',
}: {
  onClick?: () => void;
  label: string;
  icon?: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  successMessage?: string;
  showSuccess?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset' | undefined;
}) => {
  return (
    <>
      <BaseButton
        className={`w-fit px-3 py-1 ${className}`}
        disabled={disabled || isLoading}
        type={type}
        text={isLoading ? 'Saving...' : label}
        icon={icon}
        onClick={onClick}
      />
      {showSuccess && successMessage && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed bottom-4 left-4 z-50 rounded-lg bg-accent p-4 text-foreground"
        >
          {successMessage}
        </motion.div>
      )}
    </>
  );
};

export default PrimaryButton;
