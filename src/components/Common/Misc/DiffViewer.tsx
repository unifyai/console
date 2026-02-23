import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useTheme } from 'next-themes';
import { diffColors } from '@/lib/design-tokens';

const modes = {
  characters: DiffMethod.CHARS,
  words: DiffMethod.WORDS,
  wordsWithSpace: DiffMethod.WORDS_WITH_SPACE,
  lines: DiffMethod.LINES,
  trimmedLines: DiffMethod.TRIMMED_LINES,
  sentences: DiffMethod.SENTENCES,
  css: DiffMethod.CSS,
};

const styles = {
  variables: diffColors,
};

const DiffViewer = ({
  oldValue,
  newValue,
  showDiffOnly = false,
  hideMarkers = true,
  hideLineNumbers = true,
  splitView = true,
  mode = 'characters',
}: {
  oldValue: string;
  newValue: string;
  hideLineNumbers?: boolean;
  splitView?: boolean;
  hideMarkers?: boolean;
  showDiffOnly?: boolean;
  mode?: 'characters' | 'words' | 'wordsWithSpace' | 'lines' | 'trimmedLines' | 'sentences' | 'css';
}) => {
  const render = (str: string) => (
    <p className="whitespace-pre-wrap break-words text-foreground">{str}</p>
  );
  return (
    <div className="text-caption w-full overflow-auto bg-background p-4 font-mono">
      <ReactDiffViewer
        oldValue={oldValue}
        newValue={newValue}
        styles={styles}
        splitView={splitView}
        hideLineNumbers={hideLineNumbers}
        hideMarkers={hideMarkers}
        showDiffOnly={showDiffOnly}
        compareMethod={modes[mode]}
        renderContent={render}
        useDarkTheme={useTheme().theme === 'dark'}
      />
    </div>
  );
};

export default DiffViewer;
