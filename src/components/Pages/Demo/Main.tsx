'use client';

/**
 * Demo Assistants Main Component
 *
 * Split-panel layout with:
 * - Left panel: List of demo labels (selectable)
 * - Right panel: Detail view with assistant info, spending, and contacts table
 * - Header: Instructions button and Create button
 */

import * as React from 'react';
import { useState } from 'react';

import { DemoActions, DemoAssistant, DemoAssistantCreatePayload, DemoContact } from '@/types/demo';
import { useDemoAssistants } from '@/hooks/Assistants/useDemoAssistants';
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/dialog';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Checkbox } from '@/components/UI/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import {
  Plus,
  User,
  Coins,
  Hash,
  Loader2,
  Phone,
  Trash2,
  RefreshCw,
  Mail,
  UserCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import DemoInstructionsDialog from './InstructionsDialog';
import { cn } from '@/lib/utils';
import { getCountryFlag } from '@/utils/assistants/country-utils';

interface DemoAssistantsMainProps {
  demoActions: DemoActions;
  userEmail: string;
}

export default function DemoAssistantsMain({ demoActions, userEmail }: DemoAssistantsMainProps) {
  const {
    demoAssistants,
    sourceAssistants,
    availablePhoneCountries,
    isLoading,
    isCreating,
    selectedDemo,
    contacts,
    spending,
    meta,
    isLoadingDetails,
    isDeleting,
    isRefreshingContacts,
    createDemoAssistant,
    selectDemo,
    clearSelection,
    deleteDemoAssistant,
    refreshContacts,
    getDemoLabel,
  } = useDemoAssistants(demoActions);

  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [demoerPhone, setDemoerPhone] = useState('');
  const [spendingCap, setSpendingCap] = useState<number>(10);
  const [phoneCountry, setPhoneCountry] = useState<string>('US');
  const [provisionEmail, setProvisionEmail] = useState(false);

  // Optional prospect fields
  const [prospectFirstName, setProspectFirstName] = useState('');
  const [prospectSurname, setProspectSurname] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');

  const handleCreate = async () => {
    if (!selectedSourceId || !label || !firstName || !surname || !demoerPhone) {
      return;
    }

    const payload: DemoAssistantCreatePayload = {
      sourceAssistantId: parseInt(selectedSourceId, 10),
      label,
      firstName,
      surname,
      demoerPhone,
      monthlySpendingCap: spendingCap,
      phoneCountry,
      provisionEmail,
      // Only include prospect fields if they have values
      ...(prospectFirstName && { prospectFirstName }),
      ...(prospectSurname && { prospectSurname }),
      ...(prospectEmail && { prospectEmail }),
      ...(prospectPhone && { prospectPhone }),
    };

    const result = await createDemoAssistant(payload);

    if (result) {
      setDialogOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedSourceId('');
    setLabel('');
    setFirstName('');
    setSurname('');
    setDemoerPhone('');
    setSpendingCap(10);
    setPhoneCountry('US');
    setProvisionEmail(false);
    setProspectFirstName('');
    setProspectSurname('');
    setProspectEmail('');
    setProspectPhone('');
  };

  // Validate phone number format (E.164: + followed by 7-15 digits)
  const phoneError = React.useMemo(() => {
    if (!demoerPhone.trim()) {
      return null; // Don't show error for empty field
    }

    const phone = demoerPhone.trim();

    // E.164 format: starts with +, followed by 7-15 digits
    const e164Pattern = /^\+[1-9]\d{6,14}$/;

    if (!phone.startsWith('+')) {
      return 'Phone number must start with + (e.g., +14155559999)';
    }

    if (!e164Pattern.test(phone)) {
      return 'Invalid phone format. Use E.164 format (e.g., +14155559999)';
    }

    return null;
  }, [demoerPhone]);

  // Validate prospect phone if provided
  const prospectPhoneError = React.useMemo(() => {
    if (!prospectPhone.trim()) {
      return null; // Optional field - no error when empty
    }

    const phone = prospectPhone.trim();
    const e164Pattern = /^\+[1-9]\d{6,14}$/;

    if (!phone.startsWith('+')) {
      return 'Phone number must start with + (e.g., +14155559999)';
    }

    if (!e164Pattern.test(phone)) {
      return 'Invalid phone format. Use E.164 format';
    }

    return null;
  }, [prospectPhone]);

  const isFormValid =
    selectedSourceId &&
    label &&
    firstName &&
    surname &&
    demoerPhone &&
    !phoneError &&
    !prospectPhoneError;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display tracking-tight">Demo Assistants</h1>
            <p className="text-body-muted mt-1">
              Create and manage demo assistants for product demonstrations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DemoInstructionsDialog />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[640px]">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Create Demo Assistant</DialogTitle>
                  <DialogDescription>
                    Clone a source assistant to create a demo for a prospect.
                  </DialogDescription>
                </DialogHeader>

                {/* Scrollable body */}
                <div className="-mx-6 flex-1 overflow-y-auto px-6">
                  <div className="grid gap-6 py-4">
                    {/* Section: Demo Info */}
                    <section>
                      <h3 className="text-title mb-4 border-b pb-2">Demo Info</h3>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="source">Source Assistant</Label>
                          <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an assistant to clone" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceAssistants.map((assistant) => (
                                <SelectItem key={assistant.agentId} value={assistant.agentId}>
                                  {assistant.firstName} {assistant.surname}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="label">Demo Label</Label>
                          <Input
                            id="label"
                            placeholder="e.g., Richard Branson demo"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="firstName">Assistant First Name</Label>
                            <Input
                              id="firstName"
                              placeholder="Demo assistant first name"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="surname">Assistant Surname</Label>
                            <Input
                              id="surname"
                              placeholder="Demo assistant surname"
                              value={surname}
                              onChange={(e) => setSurname(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="spendingCap">Monthly Spending Cap ($)</Label>
                          <Input
                            id="spendingCap"
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={spendingCap}
                            onChange={(e) =>
                              setSpendingCap(
                                Math.max(1, Math.min(100, parseFloat(e.target.value) || 10))
                              )
                            }
                          />
                          <p className="text-body-muted text-sm">
                            Maximum monthly spend (default: $10, max: $100).
                          </p>
                        </div>
                      </div>
                    </section>

                    {/* Section: Contact Details */}
                    <section>
                      <h3 className="text-title mb-4 border-b pb-2">Contact Details</h3>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="demoerPhone">Your Phone Number</Label>
                          <Input
                            id="demoerPhone"
                            placeholder="+14155559999"
                            value={demoerPhone}
                            onChange={(e) => setDemoerPhone(e.target.value)}
                            className={phoneError ? 'border-destructive' : ''}
                          />
                          {phoneError ? (
                            <p className="text-error text-sm">{phoneError}</p>
                          ) : (
                            <p className="text-body-muted text-sm">
                              E.164 format required (e.g., +14155559999).
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="phoneCountry">Phone Number Country</Label>
                          <Select value={phoneCountry} onValueChange={setPhoneCountry}>
                            <SelectTrigger id="phoneCountry">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePhoneCountries.length === 0 ? (
                                <SelectItem value="US">
                                  <span className="mr-2">{getCountryFlag('US')}</span> United States
                                </SelectItem>
                              ) : (
                                availablePhoneCountries.map((country) => (
                                  <SelectItem key={country.code} value={country.code}>
                                    <span className="mr-2">{getCountryFlag(country.code)}</span>{' '}
                                    {country.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-body-muted text-sm">
                            Country where the assistant&apos;s phone number will be provisioned.
                          </p>
                        </div>
                        {/* Platform email provisioning is hidden — demos no
                          longer get an `@unify.ai` mailbox. The
                          `provisionEmail` state below stays `false`. */}
                      </div>
                    </section>

                    {/* Section: Demo Prospect */}
                    <section>
                      <h3 className="text-title mb-1 border-b pb-2">
                        Demo Prospect{' '}
                        <span className="text-body-muted font-normal">(optional)</span>
                      </h3>
                      <p className="text-body-muted mb-4 text-sm">
                        Pre-fill the boss contact with prospect information.
                      </p>
                      <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="prospectFirstName">First Name</Label>
                            <Input
                              id="prospectFirstName"
                              placeholder="Jane"
                              value={prospectFirstName}
                              onChange={(e) => setProspectFirstName(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="prospectSurname">Surname</Label>
                            <Input
                              id="prospectSurname"
                              placeholder="Doe"
                              value={prospectSurname}
                              onChange={(e) => setProspectSurname(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="prospectEmail">Email</Label>
                          <Input
                            id="prospectEmail"
                            type="email"
                            placeholder="jane.doe@example.com"
                            value={prospectEmail}
                            onChange={(e) => setProspectEmail(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="prospectPhone">Phone</Label>
                          <Input
                            id="prospectPhone"
                            placeholder="+14155559999"
                            value={prospectPhone}
                            onChange={(e) => setProspectPhone(e.target.value)}
                            className={prospectPhoneError ? 'border-destructive' : ''}
                          />
                          {prospectPhoneError && (
                            <p className="text-error text-sm">{prospectPhoneError}</p>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <DialogFooter className="flex-shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating || !isFormValid}>
                    {isCreating ? 'Creating...' : 'Create Demo'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content - Split Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Demo Labels */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : demoAssistants.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-body-muted text-sm">No demo assistants yet</p>
            </div>
          ) : (
            <div className="p-2">
              {demoAssistants.map((demo) => (
                <button
                  key={demo.agentId}
                  onClick={() => selectDemo(demo)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    selectedDemo?.agentId === demo.agentId
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {getDemoLabel(demo)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Detail View */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedDemo ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <User className="text-muted-foreground/50 mb-4 h-12 w-12" />
              <h3 className="text-h2">Select a demo</h3>
              <p className="text-body-muted mt-1 max-w-sm">
                Click on a demo label on the left to view its details.
              </p>
            </div>
          ) : (
            <div className="h-full space-y-6">
              {/* Assistant Info Header */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-h2">Assistant Info</h2>
                </div>
                <div className="flex items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {selectedDemo.firstName} {selectedDemo.surname}
                      </span>
                    </div>
                    <div className="text-body-muted flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span className="text-code mt-0.5">ID {selectedDemo.agentId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      {isLoadingDetails ? (
                        <span className="text-body-muted mt-0.5">Loading...</span>
                      ) : spending ? (
                        <span className="text-body-muted mt-0.5">
                          {spending.cumulativeSpend.toFixed(2)} /{' '}
                          {spending.limit?.toFixed(2) ?? '∞'} credits this month
                        </span>
                      ) : (
                        <span className="text-body-muted mt-0.5">
                          0.00 /{' '}
                          {selectedDemo.monthlySpendingCap != null
                            ? selectedDemo.monthlySpendingCap.toFixed(2)
                            : '∞'}{' '}
                          credits this month
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Contact Info */}
              <section>
                <h2 className="text-h2 mb-4">Contact Info</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-caption text-muted-foreground">Assistant Phone</p>
                      <p className="text-code font-medium">{selectedDemo.phone || '—'}</p>
                    </div>
                  </div>
                  {selectedDemo.email && (
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-caption text-muted-foreground">Assistant Email</p>
                        <p className="text-code font-medium">{selectedDemo.email}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Phone className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-caption text-muted-foreground">Demoer Phone</p>
                      <p className="text-code font-medium">{selectedDemo.userPhone || '—'}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Prospect Details (if provided) */}
              {meta &&
                (meta.prospectFirstName ||
                  meta.prospectSurname ||
                  meta.prospectEmail ||
                  meta.prospectPhone) && (
                  <section>
                    <h2 className="text-h2 mb-4">Prospect Details</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {(meta.prospectFirstName || meta.prospectSurname) && (
                        <div className="flex items-center gap-3 rounded-md border p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                            <UserCircle className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-caption text-muted-foreground">Name</p>
                            <p className="font-medium">
                              {[meta.prospectFirstName, meta.prospectSurname]
                                .filter(Boolean)
                                .join(' ')}
                            </p>
                          </div>
                        </div>
                      )}
                      {meta.prospectEmail && (
                        <div className="flex items-center gap-3 rounded-md border p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                            <Mail className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-caption text-muted-foreground">Email</p>
                            <p className="text-code font-medium">{meta.prospectEmail}</p>
                          </div>
                        </div>
                      )}
                      {meta.prospectPhone && (
                        <div className="flex items-center gap-3 rounded-md border p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                            <Phone className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-caption text-muted-foreground">Phone</p>
                            <p className="text-code font-medium">{meta.prospectPhone}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

              {/* Current Contacts */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-h2">Current Contacts</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshContacts}
                    disabled={isRefreshingContacts || isLoadingDetails}
                    className="gap-2"
                  >
                    <RefreshCw className={cn('h-4 w-4', isRefreshingContacts && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>
                {isLoadingDetails ? (
                  <div className="flex h-32 items-center justify-center rounded-md border">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed">
                    <p className="text-body-muted">No contacts yet</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="w-20">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact) => (
                          <TableRow key={contact.logId}>
                            <TableCell className="text-code">{contact.contactId}</TableCell>
                            <TableCell>
                              {contact.firstName || contact.surname ? (
                                `${contact.firstName || ''} ${contact.surname || ''}`.trim()
                              ) : (
                                <span className="italic text-muted-foreground">Unknown</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {contact.phoneNumber ? (
                                <span className="text-code">{contact.phoneNumber}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {contact.emailAddress ? (
                                <span className="text-code">{contact.emailAddress}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <ContactTypeLabel />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              {/* Delete Section */}
              <section className="border-t pt-4">
                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete Assistant
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Demo Assistant</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete{' '}
                          <span className="font-medium">
                            {selectedDemo.firstName} {selectedDemo.surname}
                          </span>
                          ? This action cannot be undone and will remove all associated
                          infrastructure (phone number, etc.).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDemoAssistant(selectedDemo.agentId)}
                          className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactTypeLabel() {
  return (
    <span className="text-caption inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
      Contact
    </span>
  );
}
