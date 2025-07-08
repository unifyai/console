"use client";

import React, { useState } from "react";
import APIKeyTabs from "./APIKeyTabs";
import APIKeyViewer from "./APIKeyViewer";
import APILoader from "./APILoader";
import APIError from "./APIError";
import APISuccess from "./APISuccess";

/**
 * APIKeyPanel component is the main container that orchestrates the interaction
 * and state management for API key viewing and management.
 *
 * @param {{initialApiKey: string, onPrem?: string}} props
 * @prop {string} [initialApiKey] - The initial API key to display.
 * @prop {string} [onPrem] - An optional string for on-prem setup.
 * @returns {JSX.Element} The APIKeyPanel component.
 */
const UnifyKey = ({
  initialApiKey,
  onPrem,
}: {
  initialApiKey?: string;
  onPrem?: string;
}) => {
  const [apiKey, setApiKey] = useState<string | undefined>(initialApiKey);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [currentState, setCurrentState] = useState<"loading" | "view" | "error" | "success">(
    initialApiKey ? "view" : "error"
  );

  const handleRegenerate = async () => {
    setCurrentState("loading");
    const response = await fetch ('api/profile/keys/regenerate');
    const newKey = await response.json();


    if (response.ok) {

      setSuccess("API key successfully regenerated.");
      setCurrentState("success");
      setApiKey(newKey.key);

      setTimeout(() => {
        setError(undefined);
        setCurrentState("view");
      }, 1000);
    } else {
      setError("Failed to regenerate the API key.");
      setCurrentState("error");
      console.error("Failed to regenerate the API key.");

      // Reset the state after 5 seconds
      setTimeout(() => {
        setError(undefined);
        setCurrentState("view");
      }, 5000);
    }
  };

  return (
      <APIKeyTabs currentState={currentState}>
        <APILoader key="loading" />
        <APIKeyViewer
          key="view"
          apiKey={apiKey || ""}
          onRegenerate={handleRegenerate}
          onPrem={onPrem}
        />
        <APIError key="error" message={error || "An unknown error occurred."} />
        <APISuccess key="success" message={success || "API key successfully regenerated."} />
      </APIKeyTabs>
  );
};

export default UnifyKey;
