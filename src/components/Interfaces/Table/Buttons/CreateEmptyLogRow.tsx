"use client";

import React, { useState } from "react";
import { FilePlus, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { LogFieldsResponseProps, LogItemProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";

interface CreateEmptyLogRowProps {
  projectId: string;
  globalContext: string | null | undefined;
  fields: LogFieldsResponseProps;
  interactive: boolean;
  createLogsAction: (
    project: string,
    context: string | null,
    params: { [param: string]: string }[],
    entries: { [entry: string | number]: string }[]
  ) => Promise<ResponseProps>;
  onSuccess: () => void;
  onError: (errorMessage: string) => void;
}

const CreateEmptyLogRow: React.FC<CreateEmptyLogRowProps> = ({
  projectId,
  globalContext,
  fields,
  interactive,
  createLogsAction,
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const handleCreateEmptyLog = async () => {
    if (!interactive || loading) return;

    setLoading(true);

    const paramsForAPI:  LogItemProps = {};
    const entriesForAPI: LogItemProps = {};

    Object.entries(fields).forEach(([fieldName, fieldMeta]) => {
      if (fieldMeta.field_type === "param") {
        paramsForAPI[fieldName] = null;
      } else if (fieldMeta.field_type === "entry") {
        entriesForAPI[fieldName] = null;
      }
      // Derived entries are not included
    });

    try {
      const response = await createLogsAction(
        projectId,
        globalContext ?? null,
        [paramsForAPI],
        [entriesForAPI]
      );

      if (response && "info" in response) {
        onSuccess();
      } else {
        const errorMessage = (response as ResponseProps)?.detail || "Failed to create log. Please try again.";
        onError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
      }
    } catch (error) {
      console.error("Error creating empty log:", error);
      onError("An unexpected error occurred while creating the log.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionButton
      icon={loading ? <LoaderCircle className="animate-spin" /> : <FilePlus />}
      tooltip="Add new empty log"
      text="Add Log"
      onClick={handleCreateEmptyLog}
      disabled={!interactive || loading || !projectId}
      variant="outline"
    />
  );
};

export default CreateEmptyLogRow;