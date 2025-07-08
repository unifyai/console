import { PasswordInput } from "@/components/Common/Input/Password";
import APIKeyRegeneratorModal from "./APIKeyRegeneratorModal";
import { CopyButton } from "@/components/Common/Buttons/Copy";

/**
 * APIKeyViewer component provides a UI to display the API key with options to view, copy, and regenerate it.
 * @param {{apiKey: string, onRegenerate: () => void, onPrem?: string}} props
 * @prop {string} apiKey - The API key to be displayed.
 * @prop {() => void} onRegenerate - A callback function to be called when the API key is to be regenerated.
 * @prop {string} [onPrem] - An optional string to be passed to the APIKeyRegeneratorModal component.
 * @returns {JSX.Element} The APIKeyViewer component.
 */
const APIKeyViewer = ({ apiKey, onRegenerate, onPrem }: {
  apiKey: string;
  onRegenerate: () => void;
  onPrem?: string;
}) => {
  return (
    <div className="APIKeyViewer flex gap-2">
      <PasswordInput readOnly value={apiKey}/>
      <CopyButton content={apiKey} copyMessage="Copied!" tooltipContent="Copy Key"/>
      <APIKeyRegeneratorModal
        onRegenerate={onRegenerate}
        onPrem={onPrem}
      />
    </div>
  );
};

export default APIKeyViewer;