# Generated E2E Test Inventory

| Spec                                                  | Test                                                                                         | @critical | Default P |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------- | --------- |
| `src/tests/account/api-key.e2e.ts`                    | Security tab masks the API key until revealed                                                | no        | P1        |
| `src/tests/account/api-key.e2e.ts`                    | regenerating API key produces a new key in the database                                      | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | phone number defaults to +1 and constructs the full E.164 number                             | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | selecting a country changes the dial code in the constructed number                          | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | verifying a number eagerly persists it with no Save button                                   | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | Discord ID auto-saves to the database on blur                                                | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | removing a saved number clears it from the database eagerly                                  | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | clicking Verify again while the code section is open does not collapse it                    | no        | P1        |
| `src/tests/account/contact-info.e2e.ts`               | a saved E.164 number is split back into country + national parts                             | no        | P1        |
| `src/tests/account/org-management.e2e.ts`             | members tab shows all members from DB                                                        | no        | P1        |
| `src/tests/account/org-management.e2e.ts`             | inviting a member via UI creates an invite record in DB                                      | no        | P1        |
| `src/tests/account/org-management.e2e.ts`             | cancelling an invite via UI removes it from DB                                               | no        | P1        |
| `src/tests/account/org-management.e2e.ts`             | updating org name via settings tab persists to DB                                            | no        | P1        |
| `src/tests/account/org-management.e2e.ts`             | removing a member via UI decreases member count in DB                                        | no        | P1        |
| `src/tests/account/profile.e2e.ts`                    | profile page displays the user name matching DB                                              | no        | P1        |
| `src/tests/account/profile.e2e.ts`                    | editing profile name auto-saves to the database on blur                                      | no        | P1        |
| `src/tests/account/profile.e2e.ts`                    | there is no explicit Save button on the profile tab                                          | no        | P1        |
| `src/tests/account/profile.e2e.ts`                    | auto-saved profile name persists after page reload                                           | no        | P1        |
| `src/tests/account/profile.e2e.ts`                    | editing last name auto-saves to the database on blur                                         | no        | P1        |
| `src/tests/account/profile.e2e.ts`                    | removing the profile photo unsets the database image                                         | no        | P1        |
| `src/tests/account/reset-account.e2e.ts`              | Unify member resets their account back to fresh-signup state                                 | yes       | P1        |
| `src/tests/account/roles.e2e.ts`                      | creating a custom role via UI persists it in the database                                    | no        | P1        |
| `src/tests/account/roles.e2e.ts`                      | managing permissions on a custom role via UI persists changes                                | no        | P1        |
| `src/tests/account/roles.e2e.ts`                      | deleting a custom role via UI removes it from the database                                   | no        | P1        |
| `src/tests/account/spending-limits.e2e.ts`            | usage page shows spending limit card with edit control                                       | no        | P1        |
| `src/tests/account/spending-limits.e2e.ts`            | setting a personal spending limit via Usage UI persists to DB                                | no        | P1        |
| `src/tests/account/spending-limits.e2e.ts`            | updating spending limit via Usage UI changes the value in DB                                 | no        | P1        |
| `src/tests/account/spending-limits.e2e.ts`            | removing spending limit via Unlimited toggle clears it from DB                               | no        | P1        |
| `src/tests/account/support-ticket.e2e.ts`             | opens dialog with expected fields                                                            | no        | P1        |
| `src/tests/account/support-ticket.e2e.ts`             | submits ticket and shows success toast (local mode)                                          | yes       | P1        |
| `src/tests/account/teams.e2e.ts`                      | team lifecycle via UI creates, adds a member, removes a member, and deletes                  | yes       | P1        |
| `src/tests/account/teams.e2e.ts`                      | org-wide sharing toggle manages the Org team lifecycle                                       | no        | P1        |
| `src/tests/account/teams.e2e.ts`                      | creating an organization from Organizations page supports shared mode                        | no        | P1        |
| `src/tests/account/workspace-context.e2e.ts`          | personal and org workspaces expose distinct API keys                                         | no        | P1        |
| `src/tests/account/workspace-context.e2e.ts`          | switching to personal workspace sets a cookie that persists across navigation                | no        | P1        |
| `src/tests/account/workspace-context.e2e.ts`          | switching to org workspace returns org billing balance                                       | yes       | P1        |
| `src/tests/account/workspace-context.e2e.ts`          | locked org users still see org assistants with a personal workspace cookie                   | no        | P1        |
| `src/tests/admin/billing-plans.e2e.ts`                | admin landing lists the managed-billing tools                                                | no        | P1        |
| `src/tests/admin/billing-plans.e2e.ts`                | billing plans page creates a BESPOKE template and lists it                                   | no        | P1        |
| `src/tests/admin/billing-plans.e2e.ts`                | billing plans table scrolls horizontally at a constrained viewport                           | no        | P1        |
| `src/tests/admin/billing-plans.e2e.ts`                | organizations page sets the new template on the target org                                   | no        | P1        |
| `src/tests/assistants/brain.e2e.ts`                   | rail Brain sections switch the active view                                                   | no        | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Contacts: empty state when the assistant has no contacts                                     | no        | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Contacts: displays seeded contact cards                                                      | yes       | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Contacts: search filters the directory and clears                                            | no        | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Contacts: clicking a card opens the detail drawer                                            | no        | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Transcripts: displays seeded messages in the threads view                                    | yes       | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Transcripts: selecting a thread shows its messages in the reader                             | no        | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Transcripts: search filters the thread list                                                  | no        | P2        |
| `src/tests/assistants/brain.e2e.ts`                   | Knowledge / Functions / Guidance render dedicated empty states                               | no        | P2        |
| `src/tests/assistants/call-working-pose.e2e.ts`       | an in-flight act turns the droid to the laptop and it stays there after the act ends         | yes       | P2        |
| `src/tests/assistants/call-working-pose.e2e.ts`       | a comms event turns the droid to the laptop and it stays there (no cooloff revert)           | no        | P2        |
| `src/tests/assistants/call-working-pose.e2e.ts`       | the droid drifts to the laptop after a spell of silence with no events                       | no        | P2        |
| `src/tests/assistants/call.e2e.ts`                    | clicking audio call button opens the communication dialog                                    | yes       | P2        |
| `src/tests/assistants/call.e2e.ts`                    | hanging up closes the dialog and returns to the chat view                                    | yes       | P2        |
| `src/tests/assistants/call.e2e.ts`                    | call button is disabled when credits are exhausted and re-enables after funding              | no        | P2        |
| `src/tests/assistants/call.e2e.ts`                    | hanging up and re-calling the same assistant works                                           | no        | P2        |
| `src/tests/assistants/call.e2e.ts`                    | call persists as a floating window across page navigation and redocks on return              | no        | P2        |
| `src/tests/assistants/call.e2e.ts`                    | historical call pill renders in shared roots only for own or null authoring                  | no        | P2        |
| `src/tests/assistants/call.e2e.ts`                    | clicking a call pill opens transcript dialog with utterances                                 | no        | P2        |
| `src/tests/assistants/call.e2e.ts`                    | call pills interleave correctly with text messages by timestamp                              | no        | P2        |
| `src/tests/assistants/chat-attachments.e2e.ts`        | selecting valid files shows pending attachment chips and opens attach dropdown               | no        | P2        |
| `src/tests/assistants/chat-attachments.e2e.ts`        | blocked file types (.exe and .bat) are rejected with toast errors                            | no        | P2        |
| `src/tests/assistants/chat-attachments.e2e.ts`        | removing pending attachments via remove button and remove all works                          | no        | P2        |
| `src/tests/assistants/chat-attachments.e2e.ts`        | duplicate file is not added twice                                                            | no        | P2        |
| `src/tests/assistants/chat-attachments.e2e.ts`        | attach button is disabled when spending is blocked                                           | no        | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | searching returns matching messages                                                          | yes       | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | shared-root search hides foreign-authored rows while keeping null-authored rows              | yes       | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | medium filter narrows results to chat or call                                                | no        | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | sender filter narrows to assistant or user messages                                          | no        | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | go-to-message navigates to historical view and jump-to-present returns                       | yes       | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | navigate to message, scroll to bottom auto-returns to present, then re-navigate works        | no        | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | historical view includes call pills when calls fall within message range                     | no        | P2        |
| `src/tests/assistants/chat-search.e2e.ts`             | historical shared-root call pills hide foreign-authored exchanges                            | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | switching to another assistant and back keeps each chat working independently                | yes       | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | unread badge increments, clears on open, and stays cleared after reload                      | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | messages arriving while a chat is open do not leak an unread badge for that assistant        | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | messages received while the user is on a different page surface as unread on return          | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | typing indicator from a recent send only shows in the chat where the message was sent        | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | unread badges fire correctly when there are many assistants in the workspace                 | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | a user message sent in one tab appears in a second tab viewing the same chat                 | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | messages eventually arrive when the assistant topic comes online after page load             | no        | P2        |
| `src/tests/assistants/chat-stream.e2e.ts`             | messages received during an active call appear in the call dialog chat panel                 | yes       | P2        |
| `src/tests/assistants/chat.e2e.ts`                    | sending a message shows it as a user message in the chat                                     | yes       | P2        |
| `src/tests/assistants/chat.e2e.ts`                    | historical transcript messages load when navigating to an assistant                          | yes       | P2        |
| `src/tests/assistants/chat.e2e.ts`                    | chat input is disabled when credits are exhausted and re-enables after funding               | yes       | P2        |
| `src/tests/assistants/chat.e2e.ts`                    | shared-root chat history merges root-local identities and paginates                          | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | adding and deleting a phone contact persists to the database                                 | yes       | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | phone and WhatsApp create buttons stay disabled without profile numbers                      | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | email tab shows BYOD-only provisioning when no email exists                                  | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | T-W1N email tab shows shared T-W1N address as managed routing                                | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | T-W1N workspace modal shows BYOD providers despite shared routing email                      | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | T-W1N phone tab shows shared T-W1N number as managed routing                                 | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | selecting a BYOD provider shows feature checkboxes and Connect button                        | no        | P2        |
| `src/tests/assistants/contacts.e2e.ts`                | selecting Microsoft BYOD provider shows Teams as a required feature                          | no        | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | picker shows on first visit with no skip or resume affordance                                | yes       | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | checklist allows independent sections to start out of order                                  | no        | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | picking chat lands in the full platform with the checklist in Assistant info                 | yes       | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | workspace demos trigger a unify_message summary and complete from the outbound               | no        | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | a connected Microsoft workspace surfaces the Teams-only demo                                 | no        | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | starting a call connects and docks the call in the platform                                  | yes       | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | mobile onboarding keeps the docked T-W1N call visible instead of auto-opening Assistant info | no        | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | resolving the picker persists intro_watched and reload defaults to T-W1N + Assistant info    | yes       | P2        |
| `src/tests/assistants/coordinator-onboarding.e2e.ts`  | working mode offers a reactivate affordance that re-enters onboarding                        | no        | P2        |
| `src/tests/assistants/coordinator-sidebar.e2e.ts`     | owner sees the Coordinator pinned with workspace chrome and no contract teardown             | yes       | P2        |
| `src/tests/assistants/coordinator-sidebar.e2e.ts`     | organization admin and member cannot access another user coordinator in org workspace        | yes       | P2        |
| `src/tests/assistants/coordinator-sidebar.e2e.ts`     | personal workspace shows the personal Coordinator surface                                    | yes       | P2        |
| `src/tests/assistants/dashboards.e2e.ts`              | shows empty state when assistant has no dashboards or tiles                                  | no        | P2        |
| `src/tests/assistants/dashboards.e2e.ts`              | renders searchable combobox selector when dashboards exist                                   | no        | P2        |
| `src/tests/assistants/dashboards.e2e.ts`              | renders dashboard summary card with metadata, actions, and footer counts                     | no        | P2        |
| `src/tests/assistants/dashboards.e2e.ts`              | selector shows standalone tile when selected                                                 | no        | P2        |
| `src/tests/assistants/data-bridge.e2e.ts`             | tile view page loads and injects bridge with all four methods                                | no        | P2        |
| `src/tests/assistants/data-bridge.e2e.ts`             | UnifyData filter, reduce, join, and joinReduce route through TileViewer                      | yes       | P2        |
| `src/tests/assistants/data-bridge.e2e.ts`             | bridge rejects when proxy returns an error response                                          | no        | P2        |
| `src/tests/assistants/data-bridge.e2e.ts`             | auto-exec tile injects bridge and executes on_data with resolved bindings                    | no        | P2        |
| `src/tests/assistants/data-bridge.e2e.ts`             | static tile renders without auto-exec bindings                                               | no        | P2        |
| `src/tests/assistants/data-bridge.e2e.ts`             | auto-exec tile handles binding failure gracefully                                            | no        | P2        |
| `src/tests/assistants/delete.e2e.ts`                  | deleting an assistant removes it from the list and the database                              | yes       | P2        |
| `src/tests/assistants/delete.e2e.ts`                  | cancelling the delete confirmation keeps the assistant                                       | yes       | P2        |
| `src/tests/assistants/desktop-filesys.e2e.ts`         | toggling filesystem access drives consent flag and per-link SFTP key                         | yes       | P2        |
| `src/tests/assistants/desktop-link.e2e.ts`            | links one machine to a second assistant (N×M), keeping the first link                        | no        | P2        |
| `src/tests/assistants/desktop-link.e2e.ts`            | shows the currently-linked machine and unlinks only that assistant                           | no        | P2        |
| `src/tests/assistants/desktop-link.e2e.ts`            | renames a registered desktop from the linker row                                             | no        | P2        |
| `src/tests/assistants/desktop-link.e2e.ts`            | saves the macOS user password as a per-assistant secret                                      | no        | P2        |
| `src/tests/assistants/desktop-link.e2e.ts`            | deletes a registered desktop and clears its links                                            | no        | P2        |
| `src/tests/assistants/edit.e2e.ts`                    | updating the first name and surname via the edit dialog persists to DB                       | no        | P2        |
| `src/tests/assistants/edit.e2e.ts`                    | updating the about field via the edit dialog persists to DB                                  | no        | P2        |
| `src/tests/assistants/edit.e2e.ts`                    | changing T-W1N voice via the edit dialog persists to DB                                      | yes       | P2        |
| `src/tests/assistants/edit.e2e.ts`                    | setting a job title via the edit dialog persists job_title to DB                             | no        | P2        |
| `src/tests/assistants/edit.e2e.ts`                    | closing the edit dialog without saving leaves DB unchanged                                   | no        | P2        |
| `src/tests/assistants/embed.e2e.ts`                   | user messages with dashboard, tile, table, and plot URLs render embed cards                  | yes       | P2        |
| `src/tests/assistants/embed.e2e.ts`                   | assistant markdown links render embed cards                                                  | no        | P2        |
| `src/tests/assistants/embed.e2e.ts`                   | non-embeddable URLs and plain text do not render embed cards                                 | no        | P2        |
| `src/tests/assistants/embed.e2e.ts`                   | expand button reveals embedded iframe and collapse hides it                                  | yes       | P2        |
| `src/tests/assistants/hire.e2e.ts`                    | hiring persists name, about and voice to DB and leaves age/nationality null                  | no        | P2        |
| `src/tests/assistants/hire.e2e.ts`                    | Randomize replaces the profile fields with a fresh unity profile                             | no        | P2        |
| `src/tests/assistants/hire.e2e.ts`                    | hiring with a job title persists job_title to DB and shows it in the hover card              | no        | P2        |
| `src/tests/assistants/hire.e2e.ts`                    | cancelling mid-hire does not create an assistant                                             | no        | P2        |
| `src/tests/assistants/list.e2e.ts`                    | the Onboard button opens the hire dialog                                                     | yes       | P2        |
| `src/tests/assistants/list.e2e.ts`                    | seeded assistants appear in the list with correct names                                      | no        | P2        |
| `src/tests/assistants/list.e2e.ts`                    | clicking an assistant in the list selects it and shows the Chat tab                          | yes       | P2        |
| `src/tests/assistants/list.e2e.ts`                    | deep link ?profile=agentId opens the correct assistant                                       | no        | P2        |
| `src/tests/assistants/list.e2e.ts`                    | assistant list item info toggle exposes profile and contact sections                         | no        | P2        |
| `src/tests/assistants/list.e2e.ts`                    | assistant list item unfold control opens the info panel                                      | no        | P2        |
| `src/tests/assistants/list.e2e.ts`                    | list updates after hiring a new assistant without page reload                                | yes       | P2        |
| `src/tests/assistants/live-actions.e2e.ts`            | historical events seeded in Orchestra appear on initial load                                 | yes       | P2        |
| `src/tests/assistants/live-actions.e2e.ts`            | live events pushed via local endpoint appear in real time                                    | yes       | P2        |
| `src/tests/assistants/live-actions.e2e.ts`            | search filters action nodes and shows match count                                            | no        | P2        |
| `src/tests/assistants/onboarding.e2e.ts`              | post-hire roadmap renders Onboarding + Contact tabs, groups accordion, and progress          | no        | P2        |
| `src/tests/assistants/onboarding.e2e.ts`              | roadmap                                                                                      | no        | P2        |
| `src/tests/assistants/onboarding.e2e.ts`              | integrations launcher seeds chat draft but does not auto-resolve the group                   | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | owner can see the                                                                            | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | owner can open the edit dialog via info panel                                                | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | owner can access the edit dialog and see the delete button                                   | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | member cannot see the                                                                        | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | member can open edit dialog on owner                                                         | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | member can view the secrets tab but cannot add secrets on owner assistant                    | no        | P2        |
| `src/tests/assistants/permissions.e2e.ts`             | member CAN see and edit their own assistant in the org                                       | no        | P2        |
| `src/tests/assistants/provider-integrations.e2e.ts`   | mock connected-apps page shows dynamic apps, permissions, tools, and connect flow            | yes       | P2        |
| `src/tests/assistants/shell.e2e.ts`                   | the rail renders with the brand and unity switcher                                           | no        | P2        |
| `src/tests/assistants/shell.e2e.ts`                   | the unity switcher opens and selecting a unity drives the section host                       | yes       | P2        |
| `src/tests/assistants/shell.e2e.ts`                   | Workspace and Brain section nav switches the active view                                     | no        | P2        |
| `src/tests/assistants/shell.e2e.ts`                   | mobile viewport exposes rail navigation via the menu toggle                                  | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | Tasks pane shows empty state when assistant has no tasks                                     | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | displays seeded tasks with status badges and descriptions                                    | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | expanded card shows run history with state and source                                        | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | Working indicator appears in header when a run is in progress                                | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | refresh picks up newly seeded tasks                                                          | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | clicking a run row opens the run-detail drawer                                               | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | recurring task card surfaces its derived cadence                                             | no        | P2        |
| `src/tests/assistants/tasks.e2e.ts`                   | searching tasks filters results server-side                                                  | no        | P2        |
| `src/tests/assistants/voice.e2e.ts`                   | hiring with a selected voice assigns that voice_id in the database                           | no        | P2        |
| `src/tests/assistants/voice.e2e.ts`                   | hiring with a different voice assigns the correct voice_id                                   | no        | P2        |
| `src/tests/assistants/workspace-file-access.e2e.ts`   | the file-access picker renders for a Drive-connected assistant                               | no        | P2        |
| `src/tests/assistants/workspace-file-access.e2e.ts`   | toggling the new-files default and saving persists the policy                                | no        | P2        |
| `src/tests/assistants/workspace-file-access.e2e.ts`   | deselect all stores a deny-by-default policy                                                 | no        | P2        |
| `src/tests/assistants/workspace-provider-card.e2e.ts` | workspace card shows the connected Microsoft provider, not the Google mailbox                | yes       | P2        |
| `src/tests/auth/account-deletion.e2e.ts`              | deletes account and redirects to login                                                       | no        | P0        |
| `src/tests/auth/account-deletion.e2e.ts`              | can cancel account deletion without effect                                                   | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | completes full forgot → code → reset → re-login flow                                         | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | shows error for wrong reset code                                                             | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | shows error for mismatched passwords                                                         | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | rejects weak new password                                                                    | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | navigates back to login from forgot password form                                            | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | navigates back to login from code view                                                       | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | navigates back to login from new-password view                                               | no        | P0        |
| `src/tests/auth/forgot-password.e2e.ts`               | resends code and disables resend button temporarily                                          | no        | P0        |
| `src/tests/auth/invite.e2e.ts`                        | accepts invite and redirects to assistants                                                   | no        | P0        |
| `src/tests/auth/invite.e2e.ts`                        | shows error when invite token is missing                                                     | no        | P0        |
| `src/tests/auth/invite.e2e.ts`                        | redirects unauthenticated user to login with invite context                                  | no        | P0        |
| `src/tests/auth/invite.e2e.ts`                        | shows invite banner on login page when invite token is present                               | no        | P0        |
| `src/tests/auth/invite.e2e.ts`                        | legacy /invite redirects to /login/invite                                                    | no        | P0        |
| `src/tests/auth/login.e2e.ts`                         | completes login with valid credentials and redirects                                         | yes       | P0        |
| `src/tests/auth/login.e2e.ts`                         | shows error for invalid password                                                             | yes       | P0        |
| `src/tests/auth/login.e2e.ts`                         | shows error when email is not registered                                                     | yes       | P0        |
| `src/tests/auth/login.e2e.ts`                         | shows provider conflict when email is registered with OAuth only                             | yes       | P0        |
| `src/tests/auth/mfa-login.e2e.ts`                     | completes TOTP verification and redirects after login                                        | yes       | P0        |
| `src/tests/auth/mfa-login.e2e.ts`                     | shows error for invalid TOTP code                                                            | yes       | P0        |
| `src/tests/auth/mfa-login.e2e.ts`                     | completes recovery code verification after login                                             | no        | P0        |
| `src/tests/auth/mfa-profile.e2e.ts`                   | completes full MFA setup: QR → confirm → recovery codes → done                               | no        | P0        |
| `src/tests/auth/mfa-profile.e2e.ts`                   | shows error for wrong confirmation code during setup                                         | no        | P0        |
| `src/tests/auth/mfa-profile.e2e.ts`                   | disables 2FA with a valid TOTP code                                                          | no        | P0        |
| `src/tests/auth/mfa-profile.e2e.ts`                   | displays recovery codes after setup with copy and download buttons                           | no        | P0        |
| `src/tests/auth/mfa-profile.e2e.ts`                   | regenerates recovery codes from profile security settings                                    | no        | P0        |
| `src/tests/auth/password-management.e2e.ts`           | changes password successfully and can re-login with new password                             | no        | P0        |
| `src/tests/auth/password-management.e2e.ts`           | shows error for wrong current password                                                       | no        | P0        |
| `src/tests/auth/password-management.e2e.ts`           | shows error for mismatched new passwords                                                     | no        | P0        |
| `src/tests/auth/password-management.e2e.ts`           | shows error for weak new password                                                            | no        | P0        |
| `src/tests/auth/password-management.e2e.ts`           | shows error when new password equals current password                                        | no        | P0        |
| `src/tests/auth/session.e2e.ts`                       | clears session and shows login form when signout=true with active session                    | yes       | P0        |
| `src/tests/auth/signup.e2e.ts`                        | completes full registration → verify → onboarding flow                                       | yes       | P0        |
| `src/tests/auth/signup.e2e.ts`                        | shows error for invalid verification code                                                    | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | rejects weak password client-side                                                            | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | shows error when registering with existing email                                             | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | shows provider conflict when registering with OAuth-only email                               | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | disables resend button with cooldown after clicking resend                                   | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | navigates back from verification to register form                                            | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | selects personal workspace and redirects to assistants                                       | yes       | P0        |
| `src/tests/auth/signup.e2e.ts`                        | creates organization workspace with personal Coordinator pinned and redirects to assistants  | no        | P0        |
| `src/tests/auth/signup.e2e.ts`                        | creates shared organization workspace with managed Org team                                  | no        | P0        |
| `src/tests/billing/access-control.e2e.ts`             | billing page redirects unauthenticated users to login                                        | no        | P0        |
| `src/tests/billing/access-control.e2e.ts`             | usage page redirects unauthenticated users to login                                          | no        | P0        |
| `src/tests/billing/access-control.e2e.ts`             | billing page shows all main sections                                                         | no        | P0        |
| `src/tests/billing/access-control.e2e.ts`             | usage page loads for authenticated users                                                     | no        | P0        |
| `src/tests/billing/auto-increment.e2e.ts`             | subscribed account toggle stays in sync with the API                                         | yes       | P0        |
| `src/tests/billing/balance.e2e.ts`                    | billing page balance matches DB and refreshes after credits change                           | yes       | P0        |
| `src/tests/billing/banners.e2e.ts`                    | out-of-credits banner appears at zero or negative balance and hides when funded              | yes       | P0        |
| `src/tests/billing/banners.e2e.ts`                    | does not show out-of-credits banner for zero-balance metered account                         | yes       | P0        |
| `src/tests/billing/banners.e2e.ts`                    | shows account status banner for suspended account                                            | no        | P0        |
| `src/tests/billing/billable-action-guard.e2e.ts`      | blocks the onboard CTA when user has no credits                                              | yes       | P0        |
| `src/tests/billing/billable-action-guard.e2e.ts`      | buttons are enabled when user has credits                                                    | yes       | P0        |
| `src/tests/billing/billable-action-guard.e2e.ts`      | METERED account with $0 wallet keeps billable actions enabled                                | yes       | P0        |
| `src/tests/billing/billing-api.e2e.ts`                | balance UI matches the balance API for authenticated user                                    | yes       | P0        |
| `src/tests/billing/billing-events.e2e.ts`             | SSE stream endpoint returns event-stream for authenticated users                             | no        | P0        |
| `src/tests/billing/billing-events.e2e.ts`             | push endpoint delivers events to the SSE stream in local dev                                 | no        | P0        |
| `src/tests/billing/billing-events.e2e.ts`             | SSE stream is unauthorized for unauthenticated requests                                      | no        | P0        |
| `src/tests/billing/billing-events.e2e.ts`             | push endpoint requires billing_account_id in local dev                                       | no        | P0        |
| `src/tests/billing/credit-grants.e2e.ts`              | ?token= on assistants auto-claims credits and shows success toast                            | yes       | P0        |
| `src/tests/billing/credit-grants.e2e.ts`              | claims a credit grant link and credits are applied                                           | yes       | P0        |
| `src/tests/billing/credit-grants.e2e.ts`              | second claim by same user returns already-claimed message                                    | yes       | P0        |
| `src/tests/billing/credit-grants.e2e.ts`              | link with max_claims=1 rejects second user                                                   | yes       | P0        |
| `src/tests/billing/manual-topup.e2e.ts`               | tops up credits with no charge and persists to the DB                                        | no        | P0        |
| `src/tests/billing/manual-topup.e2e.ts`               | shows out-of-credits banner at zero, clears after top-up                                     | no        | P0        |
| `src/tests/billing/metered-billing.e2e.ts`            | shows the METERED plan card and hides self-serve credits UI                                  | yes       | P0        |
| `src/tests/billing/metered-billing.e2e.ts`            | renders the invoices table with rows ordered newest-first                                    | yes       | P0        |
| `src/tests/billing/metered-billing.e2e.ts`            | switching back to default restores the CREDITS UI                                            | no        | P0        |
| `src/tests/billing/profile.e2e.ts`                    | opens and closes the profile dialog via cancel                                               | no        | P0        |
| `src/tests/billing/profile.e2e.ts`                    | save button is disabled when name is empty                                                   | no        | P0        |
| `src/tests/billing/profile.e2e.ts`                    | saves billing name and closes dialog                                                         | no        | P0        |
| `src/tests/billing/profile.e2e.ts`                    | persists saved name across page reloads                                                      | no        | P0        |
| `src/tests/billing/referrals.e2e.ts`                  | returns a referral link and code for the caller                                              | no        | P0        |
| `src/tests/billing/referrals.e2e.ts`                  | attributes a referred friend to the referrer code                                            | no        | P0        |
| `src/tests/billing/referrals.e2e.ts`                  | a referee is attributed at most once                                                         | no        | P0        |
| `src/tests/billing/referrals.e2e.ts`                  | blocks self-referral                                                                         | no        | P0        |
| `src/tests/billing/referrals.e2e.ts`                  | referrer dashboard reflects a rewarded referral                                              | no        | P0        |
| `src/tests/billing/subscribe.e2e.ts`                  | subscribed account shows current tier and allowance meter                                    | yes       | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | Subscribe CTA is gated by a prerequisites checklist (billing profile, then card)             | no        | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | monthly subscription renders tier, renewal & ×400 allowance                                  | yes       | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | changing tier keeps a confirm dialog (immediate, prorated)                                   | yes       | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | subscription invoices open in a side-sheet (credits variant)                                 | no        | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | top tier disables the toggle with an explanatory note                                        | no        | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | cancel keeps access until period end (confirm copy)                                          | yes       | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | PAST_DUE shows a soft banner that clears on recovery                                         | yes       | P0        |
| `src/tests/billing/subscription-billing.e2e.ts`       | a scheduled end-of-period cancellation surfaces                                              | no        | P0        |
| `src/tests/billing/usage.e2e.ts`                      | ledger displays seeded transactions with correct category descriptions                       | yes       | P0        |
| `src/tests/billing/usage.e2e.ts`                      | redirects to login when not authenticated                                                    | yes       | P0        |
| `src/tests/impersonation/view-as.e2e.ts`              | Unify member can view as another user and return                                             | no        | P1        |
| `src/tests/shell/push-gate.e2e.ts`                    | the assistants rail renders with brand and unity switcher                                    | no        | P3        |
| `src/tests/shell/route-shell-smoke.e2e.ts`            | /favourites renders inside the rail shell with its section header                            | no        | P3        |
| `src/tests/shell/route-shell-smoke.e2e.ts`            | /interfaces renders inside the rail shell for a Unify member                                 | no        | P3        |
