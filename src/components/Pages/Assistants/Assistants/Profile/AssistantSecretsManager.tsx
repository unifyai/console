import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Textarea } from '@/components/UI/textarea';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Skeleton } from '@/components/UI/skeleton';
import { Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import { Secret, SecretActions } from '@/types/assistants/secret';
import { cn } from '@/lib/utils';
import { FormProvider } from 'react-hook-form';

interface AssistantSecretsManagerProps {
    isOpen: boolean;
    onClose: () => void;
    assistantContext: string | null;
    secretActions: SecretActions;
    /** Whether the current user can create/edit/delete secrets */
    canWrite?: boolean;
}

const SecretsListSkeleton = () => (
    <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full bg-muted" />
        ))}
    </div>
);

export function AssistantSecretsManager({
    isOpen,
    onClose,
    assistantContext,
    secretActions,
    canWrite = true,
}: AssistantSecretsManagerProps) {
    const {
        secrets,
        selectedSecret,
        isLoading,
        isSubmitting,
        formMethods,
        handleSelectSecret,
        handleNewSecret,
        handleDeleteSecret,
        onSubmit,
    } = useAssistantSecrets(assistantContext, secretActions);

    // This state is crucial to differentiate the initial empty state from the "creating a new secret" state.
    const [isCreating, setIsCreating] = React.useState(false);
    const [isValueVisible, setIsValueVisible] = React.useState(false);
    const { register, formState: { errors, isDirty } } = formMethods;

    // When selecting a new secret, reset visibility and exit "creating" mode.
    const handleSelect = (secret: Secret) => {
        handleSelectSecret(secret);
        setIsValueVisible(false);
        setIsCreating(false);
    };

    // When starting a new secret, enter "creating" mode.
    const handleStartCreate = () => {
        handleNewSecret();
        setIsValueVisible(false);
        setIsCreating(true);
    };

    // When canceling creation, exit "creating" mode.
    const handleCancel = () => {
        setIsCreating(false);
        // If secrets exist, select the first one. Otherwise, the component will revert to the empty state.
        if (secrets.length > 0) {
            handleSelectSecret(secrets[0]);
        }
    };

    // After a successful creation, the secrets list is refetched.
    // This effect detects that change and exits "creating" mode automatically.
    React.useEffect(() => {
        if (isCreating && secrets.length > 0 && selectedSecret) {
            setIsCreating(false);
        }
    }, [secrets, selectedSecret, isCreating]);


    const isViewing = !!selectedSecret;
    // Determine which view to show.
    const showEmptyState = !isLoading && secrets.length === 0 && !isCreating;
    const showManager = !isLoading && !showEmptyState;

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h3 className="text-lg font-medium">No secret found</h3>
            {canWrite && (
                <Button variant="outline" className="mt-4" onClick={handleStartCreate}>
                    Add a secret
                </Button>
            )}
        </div>
    );

    const renderManager = () => (
        <div className="flex h-full">
            {/* Left Panel: Secrets List */}
            <div className="w-1/3 border-r h-full flex flex-col">
                <ScrollArea className="flex-1 p-2">
                    {isLoading ? <SecretsListSkeleton /> : (
                        <div className="space-y-1">
                                            {secrets.map((secret) => (
                                                <div
                                                    key={secret.log_id}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded-md cursor-pointer",
                                                        selectedSecret?.log_id === secret.log_id
                                                            ? "bg-muted font-semibold"
                                                            : "hover:bg-muted/50"
                                                    )}
                                                    onClick={() => handleSelect(secret)}
                                                >
                                                    <span className="truncate text-sm">{secret.name}</span>
                                                    {canWrite && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteSecret(secret);
                                                            }}
                                                            disabled={isSubmitting}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                    )}
                </ScrollArea>
                {canWrite && (
                    <div className="p-2 border-t">
                        <Button variant="outline" className="w-full" onClick={handleStartCreate} disabled={isSubmitting}>
                            New
                        </Button>
                    </div>
                )}
            </div>

            {/* Right Panel: Form */}
            <div className="w-2/3 p-6 flex flex-col">
                <FormProvider {...formMethods}>
                    <form onSubmit={onSubmit} id="secret-form" className="flex-1 flex flex-col">
                        <div className="flex-1 space-y-4">
                            <div>
                                <Label htmlFor="name" className="mb-2 block">Name</Label>
                                <Input id="name" {...register("name", { required: "Name is required" })} disabled={isSubmitting || isViewing} />
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="value" className="mb-2 block">Value</Label>
                                <div className="relative">
                                    <Input
                                        id="value"
                                        type={isValueVisible ? 'text' : 'password'}
                                        {...register("value", { required: "Value is required" })}
                                        disabled={isSubmitting || isViewing}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                        onClick={() => setIsValueVisible(!isValueVisible)}
                                        disabled={!isViewing} // Only allow peeking at existing secrets
                                    >
                                        {isValueVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                {errors.value && <p className="text-sm text-destructive mt-1">{errors.value.message}</p>}
                            </div>
                            <div className="flex-1 flex flex-col">
                                <Label htmlFor="description" className="mb-2 block">Description</Label>
                                <Textarea
                                    id="description"
                                    {...register("description")}
                                    className="flex-1 resize-none"
                                    placeholder="Optional description..."
                                    disabled={isSubmitting || isViewing}
                                />
                            </div>
                        </div>

                        {!isViewing && (
                            <div className="flex justify-end items-center gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                                    Cancel
                                </Button>
                                <Button type="submit" form="secret-form" disabled={isSubmitting || !isDirty}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        )}
                    </form>
                </FormProvider>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Manage secrets</DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : showEmptyState ? (
                        renderEmptyState()
                    ) : (
                        renderManager()
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
