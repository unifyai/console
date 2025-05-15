import { GranularInterfaceActions, GranularTabActions, InterfaceData, TabData } from "@/types/evals/grid";

/**
 * Determines if a redirect is needed based on current URL parameters and data state.
 * Creates default interfaces and tabs when needed in one operation.
 * 
 * @param params Current URL and data parameters
 * @returns The redirect URL if a redirect is needed, null otherwise
 */
export async function getRedirectUrl({
  project,
  interface_,
  tab,
  interfaces,
  currentInterface,
  tabs,
  interfaceActions,
  tabActions
}: {
  // URL parameters
  project: string | null;
  interface_: string | null;
  tab?: string;
  
  // Data state
  interfaces: InterfaceData[];
  currentInterface: InterfaceData | null;
  tabs?: TabData[];
  
  // Actions
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
}): Promise<string | null> {
  // Case 1: No project selected - no redirect needed (handled by UI)
  if (!project) {
    return null;
  }

  // Case 2: Project selected but no interface in URL, but interfaces exist
  if (!interface_ && currentInterface && currentInterface.name) {
    // If we have an existing interface without a tab specified, find an active tab or create one
    const needsTabRedirect = !tab && currentInterface.id;
    
    if (needsTabRedirect) {
      // Get or fetch tabs if not provided
      let activeTabs = tabs || [];
      if (!activeTabs || !Array.isArray(activeTabs) || activeTabs.length === 0) {
        if (currentInterface.id) {
          // Try to fetch tabs for this interface
          activeTabs = await tabActions.list(currentInterface.id, false) || [];
        }
      }
      
      // Try to find an active tab
      let activeTab = activeTabs.find(t => t.active) || null;
      
      // If no active tab, use the first tab if available
      if (!activeTab && activeTabs.length > 0) {
        activeTab = activeTabs[0];
      }
      
      // If we found a valid tab, include it in the redirect URL
      if (activeTab && activeTab.name) {
        return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(currentInterface.name)}&tab=${encodeURIComponent(activeTab.name)}`;
      }
      
      // If no tabs exist, create a default tab for this interface
      if (currentInterface.id && (!activeTabs || activeTabs.length === 0)) {
        const newTab = await tabActions.create(currentInterface.id, "tab1", {
          visible: true,
          active: true,
        });
        
        if (newTab && newTab.name) {
          // Also update the interface's active tab id
          await interfaceActions.update({
            interface_id: currentInterface.id,
            data: { active_tab_id: newTab.id }
          });
          
          return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(currentInterface.name)}&tab=${encodeURIComponent(newTab.name)}`;
        }
      }
    }
    
    // If we can't create or find a tab, just redirect to the interface
    return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(currentInterface.name)}`;
  }
  
  // Case 3: Project selected but no interfaces exist yet - create both default interface and tab in one go
  if (!interface_ && project && (!interfaces.length || !currentInterface)) {
    // Create a default interface
    const newInterface = await interfaceActions.create(project, "interface1");
    if (newInterface && newInterface.id) {
      // Immediately create a default tab for this interface
      const newTab = await tabActions.create(newInterface.id, "tab1", {
        visible: true,
        active: true,
      });
      
      if (newTab && newTab.id) {
        // Update the interface's active tab id
        await interfaceActions.update({
          interface_id: newInterface.id,
          data: { active_tab_id: newTab.id }
        });
        
        // Return a redirect URL with both interface and tab
        return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(newInterface.name)}&tab=${encodeURIComponent(newTab.name)}`;
      }
      
      // Fallback: If tab creation fails, just redirect to the interface
      return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(newInterface.name)}`;
    }
  }
  
  // At this point, we have a project and interface specified in the URL

  // Only handle tab creation if we have a valid interface ID but no tab in the URL
  if (!tab && currentInterface && currentInterface.id) {
    const interfaceId = currentInterface.id;
    const interfaceName = currentInterface.name;
    
    // Get tabs if not provided
    let activeTabs = tabs || [];
    if (!activeTabs || !Array.isArray(activeTabs) || activeTabs.length === 0) {
      // Try to fetch tabs for this interface
      activeTabs = await tabActions.list(interfaceId, false) || [];
    }
    
    // Try to find an active tab
    let activeTab = activeTabs.find(t => t.active) || null;
    
    // If no active tab, use the first tab if available
    if (!activeTab && activeTabs.length > 0) {
      activeTab = activeTabs[0];
    }
    
    // If we found a valid tab, redirect to include it in URL
    if (activeTab && activeTab.name) {
      return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(interfaceName)}&tab=${encodeURIComponent(activeTab.name)}`;
    }
    
    // If no tabs exist, create a default tab
    if (activeTabs.length === 0) {
      const newTab = await tabActions.create(interfaceId, "tab1", {
        visible: true,
        active: true,
      });
      
      if (newTab && newTab.name) {
        // Also update the interface's active tab id
        await interfaceActions.update({
          interface_id: interfaceId,
          data: { active_tab_id: newTab.id }
        });
        
        return `/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(interfaceName)}&tab=${encodeURIComponent(newTab.name)}`;
      }
    }
  }
  
  // No redirect needed
  return null;
} 