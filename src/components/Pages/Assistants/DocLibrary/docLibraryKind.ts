/**
 * Shared kind discriminator for the DocLibrary pane, which renders both the
 * Guidance and Knowledge surfaces from one component. Kept in its own module
 * so the pane and its drawer can import it without a circular dependency.
 */
export type DocLibraryKind = 'guidance' | 'knowledge';
