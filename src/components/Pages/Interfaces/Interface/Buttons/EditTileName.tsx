'use client';

import { useState } from 'react';
import ActionButton from '../../../../Common/Buttons/Action';
import { Dialog, DialogContent } from '../../../../UI/dialog';
import { Input } from '../../../../UI/input';
import { useTab } from '@/contexts/hooks/tab';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { getAnyTileLoading } from '@/contexts/utils/sliceUtils';
import { useTabSync } from '@/contexts/hooks/tab/sync/useTabSync';
import { GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';
import { isImeComposing } from '@/utils/keyboard';

const EditTileName = ({
  tabIdOrName,
  interfaceId,
  tabActions,
  tileActions,
}: {
  tabIdOrName: string;
  interfaceId: string;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
}) => {
  const [newTileName, setNewTileName] = useState<string>();
  const [errorMsg, setErrorMsg] = useState<string>();

  const { ui: tabUIState, uiActions: tabUIActions } = useTab(tabIdOrName, interfaceId);
  const anyTileLoading = useStoreContext((state) => getAnyTileLoading(state));
  const readOnly = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(
    tabIdOrName,
    interfaceId,
    tabActions,
    tileActions
  );
  const syncedTabDataActions = syncedTabActions?.data ?? null;

  const resetAndClose = () => {
    tabUIActions?.setEditTile(undefined);
    setNewTileName(undefined);
  };

  // edit tile name
  const saveTileName = () => {
    if (!newTileName?.trim()) {
      setErrorMsg('Tile name cannot be empty');
      return;
    }

    if (newTileName && tabUIState?.editTile && syncedTabDataActions) {
      const currentNames = syncedTabDataActions.getTileNames();
      // Prevent renaming to the SAME name (case-insensitive)
      const duplicate = currentNames
        .filter((n) => n !== tabUIState?.editTile) // allow keeping the same name
        .some((n) => n.toLowerCase() === newTileName.trim().toLowerCase());

      if (duplicate) {
        setErrorMsg(`A tile called “${newTileName.trim()}” already exists`);
        return;
      }

      // Use the new renameTile method which handles both
      // updating the tile name and updating references
      // Get the tileId for the given tileName
      const tileId = syncedTabDataActions.getTileId(tabUIState?.editTile);
      if (tileId) {
        syncedTabDataActions.renameTile(tileId, newTileName);
      }
    }
    resetAndClose();
  };

  return (
    <Dialog
      open={true}
      onOpenChange={() => {
        tabUIActions?.setEditTile(undefined);
        setNewTileName(undefined);
      }}
    >
      <DialogContent className="w-72">
        <div className="mt-6 flex flex-col gap-2">
          {readOnly && (
            <div className="text-body text-muted-foreground">
              Please wait while tiles are loading...
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder={readOnly ? tabUIState?.editTile : 'Enter new tile name...'}
              value={newTileName || ''}
              onInput={(input) => {
                setNewTileName(input.currentTarget.value);
                if (errorMsg) setErrorMsg(undefined); // clear on typing
              }}
              onKeyDown={(e) => {
                if (isImeComposing(e)) return;
                if (e.key === 'Enter') {
                  saveTileName();
                }
              }}
              readOnly={readOnly}
              className="h-8 w-48"
            />
            <ActionButton
              className="remove cursor-pointer"
              onClick={() => saveTileName()}
              text="Save"
              tooltip="Save"
              variant="primary"
              disabled={readOnly}
            />
          </div>
          {errorMsg && <div className="text-body pl-1 text-destructive">{errorMsg}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditTileName;
