import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useTheme } from "next-themes";

const modes = {
    "characters" : DiffMethod.CHARS,
    "words" : DiffMethod.WORDS,
    "wordsWithSpace" : DiffMethod.WORDS_WITH_SPACE,
    "lines" : DiffMethod.LINES,
    "trimmedLines" : DiffMethod.TRIMMED_LINES,
    "sentences" : DiffMethod.SENTENCES,
    "css" : DiffMethod.CSS,
}

const styles = {
    variables: {
        light: {
            diffViewerBackground: 'transparent',
            diffViewerColor: 'transparent',
            addedBackground: '#e6ffed',  // Light green background
            addedColor: '#24292e',       // Dark text for light mode
            removedBackground: '#ffeef0', // Light red background
            removedColor: '#24292e',      // Dark text for light mode
            wordAddedBackground: '#acf2bd', // Light green for word diff
            wordRemovedBackground: '#fdb8c0', // Light red for word diff
            
            // Gutter styles for light mode
            gutterBackground: 'transparent', // Match the container background
            gutterBackgroundDark: 'transparent', // Match the container background
            emptyLineBackground: 'transparent', // For consistency
            addedGutterBackground: '#cdffd8', // Light green for gutter
            removedGutterBackground: '#ffdce0', // Light red for gutter
            gutterColor: '#24292e',  // Dark text for light mode
            addedGutterColor: '#24292e', // Dark text for light mode
            removedGutterColor: '#24292e' // Dark text for light mode
        },
        dark: {
            diffViewerBackground: 'transparent',
            diffViewerColor: 'transparent',
            addedBackground: '#166534',  // Darker green background (similar to bg-green-800)
            addedColor: '#f5f5f5',       // Light text for dark mode
            removedBackground: '#991b1b', // Darker red background (similar to bg-red-800)
            removedColor: '#f5f5f5',      // Light text for dark mode
            wordAddedBackground: '#15803d', // Darker green for word diff
            wordRemovedBackground: '#b91c1c',  // Darker red for word diff
            
            // Gutter styles for dark mode
            gutterBackground: 'transparent', // Match the container background
            gutterBackgroundDark: 'transparent', // Match the container background
            emptyLineBackground: 'transparent', // For consistency
            addedGutterBackground: '#166534', // Same dark green as content
            removedGutterBackground: '#991b1b', // Same dark red as content
            gutterColor: '#f5f5f5',  // Light text for dark mode
            addedGutterColor: '#f5f5f5', // Light text for dark mode
            removedGutterColor: '#f5f5f5' // Light text for dark mode
        },
    }
};

const DiffViewer = ({oldValue, newValue, showDiffOnly = false, hideMarkers = true, hideLineNumbers = true, splitView = true, mode = "characters"}: {
    oldValue: string, 
    newValue:string,
    hideLineNumbers?: boolean,
    splitView?: boolean,
    hideMarkers?: boolean,
    showDiffOnly?: boolean,
    mode?: "characters" | "words" | "wordsWithSpace" | "lines" | "trimmedLines" | "sentences" | "css"
}) => {

    const render = (str: string) => <p className='text-foreground whitespace-pre-wrap break-words'>{str}</p>
    return (
        <div className="bg-background p-4 font-mono text-sm w-full overflow-auto">
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
                useDarkTheme={useTheme().theme === "dark"}
            />
        </div>
    )
}

export default DiffViewer;