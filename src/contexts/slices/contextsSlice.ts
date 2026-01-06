import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";

export type ContextScope = "interface" | "tab" | "tile";

export interface ContextSyncJobMeta {
	projectId?: string;
	interfaceId?: string;
	tabId?: string;
}

export interface ContextSyncJob extends ContextSyncJobMeta {
	jobId: string;
	scope: ContextScope;
	targetId: string; // interfaceId | tabId | tileId
	context: string; // empty string means unset
	attempts: number;
	enqueuedAt: number;
}

export interface ContextsState {
	projectContexts: Record<string, string[]>; // projectId -> context names
	interfaceContexts: Record<string, string | null>;
	tabContexts: Record<string, string | null>;
	tileContexts: Record<string, string | null>;
	contextSyncQueue: ContextSyncJob[];
	processingQueue?: boolean;
	projectDefaultContext: Record<string, string | null>;
}

export interface ContextsActions {
	setProjectContexts: (projectId: string, contexts: string[]) => void;
	setProjectDefaultContext: (projectId: string, context: string | null) => void;
	setContextOptimistic: (scope: ContextScope, targetId: string, context: string, meta?: ContextSyncJobMeta) => void;
	enqueueContextSync: (scope: ContextScope, targetId: string, context: string, meta?: ContextSyncJobMeta) => void;
	dequeueContextSync: () => ContextSyncJob | undefined;
	peekContextSync: () => ContextSyncJob | undefined;
	setProcessingQueue: (processing: boolean) => void;
	clearInvalidContexts: (projectId: string) => void;
	getEffectiveContext: (tileId?: string | null, tabId?: string | null, interfaceId?: string | null) => string | null;
	renameProjectContext: (projectId: string, from: string, to: string) => void;
	deleteProjectContext: (projectId: string, name: string) => void;
}

export type ContextsSlice = ContextsState & ContextsActions;

export const createContextsSlice: StateCreator<
	StoreSlice,
	[["zustand/immer", never]],
	[],
	ContextsSlice
> = (set, get) => ({
	projectContexts: {},
	interfaceContexts: {},
	tabContexts: {},
	tileContexts: {},
	contextSyncQueue: [],
	processingQueue: false,
	projectDefaultContext: {},

	setProjectContexts: (projectId, contexts) => set(state => {
		if (!state.projectContexts) state.projectContexts = {} as any;
		state.projectContexts[projectId] = Array.isArray(contexts) ? contexts : [];
	}),

	setProjectDefaultContext: (projectId, context) => set(state => {
		if (!state.projectDefaultContext) state.projectDefaultContext = {} as any;
		state.projectDefaultContext[projectId] = context ?? null;
	}),

	setContextOptimistic: (scope, targetId, context, meta) => set(state => {
		const ctx = context || "";
		if (scope === "interface") {
			state.interfaceContexts[targetId] = ctx === "" ? null : ctx;
			// No interface context field in interface slice; keep only in contexts map for now
		} else if (scope === "tab") {
			state.tabContexts[targetId] = ctx === "" ? null : ctx;
			// Also write-through to tab slice so UI updates immediately
			if (state.tabsById?.[targetId]) {
				state.tabsById[targetId].globalContext = ctx === "" ? undefined : ctx;
			}
		} else if (scope === "tile") {
			state.tileContexts[targetId] = ctx === "" ? null : ctx;
			// Write-through to tile slice
			if (state.tilesById?.[targetId]) {
				state.tilesById[targetId].context = ctx === "" ? undefined : ctx;
			}
		}
	}),

	enqueueContextSync: (scope, targetId, context, meta) => set(state => {
		// Replace any existing job for same scope+target with the latest payload
		const existingIdx = state.contextSyncQueue.findIndex(j => j.scope === scope && j.targetId === targetId);
		const job: ContextSyncJob = {
			jobId: `${scope}:${targetId}`,
			scope,
			targetId,
			context,
			attempts: 0,
			enqueuedAt: Date.now(),
			...meta,
		};
		if (existingIdx >= 0) state.contextSyncQueue[existingIdx] = job;
		else state.contextSyncQueue.push(job);
	}),

	dequeueContextSync: () => {
		const state = get();
		if (!state.contextSyncQueue.length) return undefined;
		const job = state.contextSyncQueue[0];
		set(s => { s.contextSyncQueue = s.contextSyncQueue.slice(1); });
		return job;
	},

	peekContextSync: () => get().contextSyncQueue[0],

	setProcessingQueue: (processing) => set(s => { s.processingQueue = processing; }),

	clearInvalidContexts: (projectId) => set(state => {
		const validSet = new Set((state.projectContexts[projectId] || []));
		// Unset interface contexts not in valid set
		Object.entries(state.interfaceContexts).forEach(([id, value]) => {
			if (value && !validSet.has(value)) state.interfaceContexts[id] = null;
		});
		Object.entries(state.tabContexts).forEach(([id, value]) => {
			if (value && !validSet.has(value)) {
				state.tabContexts[id] = null;
				if (state.tabsById?.[id]) {
					state.tabsById[id].globalContext = undefined;
				}
			}
		});
		Object.entries(state.tileContexts).forEach(([id, value]) => {
			if (value && !validSet.has(value)) {
				state.tileContexts[id] = null;
				if (state.tilesById?.[id]) {
					state.tilesById[id].context = undefined;
				}
			}
		});
	}),

	// Optimistically rename a context across the project
	renameProjectContext: (projectId, from, to) => set(state => {
		if (!from || from === to) return;
		// Update context list
		const list = state.projectContexts[projectId] || [];
		state.projectContexts[projectId] = Array.from(new Set(list.map(n => (n === from ? to : n))));
		// Update interfaces in the project
		const ifaceIds: string[] = (state.projectsById?.[projectId]?.interfaceIds || []) as string[];
		ifaceIds.forEach(ifaceId => {
			if (state.interfaceContexts[ifaceId] === from) state.interfaceContexts[ifaceId] = to;
			// Tabs for this interface
			const tabIds: string[] = (state.interfacesById?.[ifaceId]?.tabIds || []) as string[];
			tabIds.forEach(tabId => {
				if (state.tabContexts[tabId] === from) state.tabContexts[tabId] = to;
				if (state.tabsById?.[tabId]?.globalContext === from) {
					state.tabsById[tabId].globalContext = to;
				}
				// Tiles
				const tileIds: string[] = (state.tabsById?.[tabId]?.tileIds || []) as string[];
				tileIds.forEach(tileId => {
					if (state.tileContexts[tileId] === from) state.tileContexts[tileId] = to;
					if (state.tilesById?.[tileId]?.context === from) {
						state.tilesById[tileId].context = to;
					}
				});
			});
		});
	}),

	// Optimistically delete a context across the project
	deleteProjectContext: (projectId, name) => set(state => {
		if (!name) return;
		// Remove from context list
		state.projectContexts[projectId] = (state.projectContexts[projectId] || []).filter(n => n !== name);
		// Update interfaces in the project
		const ifaceIds: string[] = (state.projectsById?.[projectId]?.interfaceIds || []) as string[];
		ifaceIds.forEach(ifaceId => {
			if (state.interfaceContexts[ifaceId] === name) state.interfaceContexts[ifaceId] = null;
			const tabIds: string[] = (state.interfacesById?.[ifaceId]?.tabIds || []) as string[];
			tabIds.forEach(tabId => {
				if (state.tabContexts[tabId] === name) state.tabContexts[tabId] = null;
				if (state.tabsById?.[tabId]?.globalContext === name) {
					state.tabsById[tabId].globalContext = undefined;
				}
				const tileIds: string[] = (state.tabsById?.[tabId]?.tileIds || []) as string[];
				tileIds.forEach(tileId => {
					if (state.tileContexts[tileId] === name) state.tileContexts[tileId] = null;
					if (state.tilesById?.[tileId]?.context === name) {
						state.tilesById[tileId].context = undefined;
					}
				});
			});
		});
	}),

	getEffectiveContext: (tileId, tabId, interfaceId) => {
		const s = get();
		return (
			(tileId ? (s.tileContexts[tileId] ?? null) : null) ||
			(tabId ? (s.tabContexts[tabId] ?? null) : null) ||
			(interfaceId ? (s.interfaceContexts[interfaceId] ?? null) : null) ||
			null
		);
	},
}); 