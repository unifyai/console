"use client";

import React, { useState } from "react";
import BaseDialog from "@/components/Common/Dialogs/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { RefreshCw } from "lucide-react";
import SubmitButton from "@/components/Common/Buttons/Submit";

/**
 * APIKeyRegeneratorModal component manages the UI for confirming and regenerating the API key.
 * @param {() => void} onRegenerate - A callback function to be called when the API key should be regenerated.
 * @param {string} [onPrem] - An optional string to be passed to the APIKeyRegeneratorModal component.
 * @returns {JSX.Element} The APIKeyRegeneratorModal component.
 */
const APIKeyRegeneratorModal = ({ onRegenerate, onPrem }: {
  onRegenerate: () => void;
  onPrem?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <BaseDialog
      button={<ActionButton icon={<RefreshCw />} tooltip="Regenerate" />}
      title="Regenerate API Key"
      open={open}
      setOpen={setOpen}
      body={onPrem
        ? <p>You can{"'"}t regenerate your API key in an on-prem setup. Visit our platform for assistance.</p>
        : <p>Regenerating the API key will disable your current key and create a new one. Proceed?</p>
      }
      footer={
        <SubmitButton
          text="Regenerate"
          onClick={() => {
            setOpen(false)
            onRegenerate()
          }
          }
        />
      }
    />
  );
};

export default APIKeyRegeneratorModal;
