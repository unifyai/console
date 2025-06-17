"use client";

import React, { useState } from "react";
import { FilePlus, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import BaseDialog from "@/components/Common/Dialogs/Base";
import { Input } from "@/components/UI/input";
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
  const [open, setOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const hasDefinedFields = Object.keys(fields).length > 0;

  const handleCreateEmptyLog = async () => {
    if (!interactive || loading) return;

    setLoading(true);

    const paramsForAPI:  LogItemProps = {};
    const entriesForAPI: LogItemProps = {};

    if (!hasDefinedFields) {
      if (!newFieldName.trim()) {
        setLoading(false);
        return;
      }
      entriesForAPI[newFieldName.trim()] = null;
    } else {
      Object.entries(fields).forEach(([fieldName, fieldMeta]) => {
        if (fieldMeta.field_type === "param") {
          paramsForAPI[fieldName] = null;
        } else if (fieldMeta.field_type === "entry") {
          entriesForAPI[fieldName] = null;
        }
      });
    }

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
      if (!hasDefinedFields) {
        setOpen(false);
        setNewFieldName("");
      }
    }
  };

  const actionBtn = (
    <ActionButton
      icon={loading ? <LoaderCircle className="animate-spin" /> : <FilePlus />}
      tooltip="Add new empty log"
      text="Add Log"
      disabled={!interactive || loading || !projectId}
      variant="outline"
    />
  );

  if (hasDefinedFields) {
    return React.cloneElement(actionBtn, { onClick: handleCreateEmptyLog });
  }

  // No columns – wrap button in a dialog
  const dialogBody = (
    <div className="space-y-4">
      <Input
        placeholder="Column name"
        value={newFieldName}
        onChange={(e) => setNewFieldName(e.target.value)}
        disabled={loading}
      />
    </div>
  );

  const dialogFooter = (
    <SubmitButton
      text="Add Log"
      disabled={loading || !newFieldName.trim()}
      loading={loading}
      onClick={handleCreateEmptyLog}
    />
  );

  return (
    <BaseDialog
      button={actionBtn}
      title="Add first column"
      description="Provide a name for the first column to create the empty log."
      body={dialogBody}
      footer={dialogFooter}
      open={open}
      setOpen={setOpen}
    />
  );
};

export default CreateEmptyLogRow;