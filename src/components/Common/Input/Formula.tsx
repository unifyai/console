"use client";

import { useState, useEffect, KeyboardEvent, useRef, KeyboardEventHandler } from 'react';
import { Input } from "@/components/UI/input";
import { listToHexColors } from "@/utils/misc/color";
import { TbMathFunction } from "react-icons/tb";

interface AutocompleteOption {
  name: string,
  type: string,
  children: string[]
}

interface FormulaInputProps {
  options: AutocompleteOption[],
  value: string,
  setValue: (value: string) => void,
  onEnter?: KeyboardEventHandler
}

const FormulaInput = ({options, value, setValue, onEnter}: FormulaInputProps) => {

  /* Generate colors for each option type */
  const optionTypes = Array.from(new Set(options.map(option => option.type)))
  const colorsRange = listToHexColors(optionTypes)
  const colors = optionTypes.map((type, i) => ({type, color: colorsRange[i]}))

  /* State trackers */
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [filteredOptions, setFilteredOptions] = useState<AutocompleteOption[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null); // Add this line
  const containerRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  /* Input event handlers */

  const handleInputChange = (inputValue: string) => {

    setValue(inputValue);
    const lastWord = inputValue.trim().split(' ').pop() || '';
    
    if (!lastWord) {
      setFilteredOptions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = options.filter(option =>
      option.name.toLowerCase().startsWith(lastWord.toLowerCase())
    );

    setFilteredOptions(filtered);
    setShowSuggestions(filtered.length > 0);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    
    e.stopPropagation()

    const suggestionCount = filteredOptions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (showSuggestions) {
          setHighlightedIndex(prev => Math.min(prev + 1, suggestionCount - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (showSuggestions) {
          setHighlightedIndex(prev => Math.max(prev - 1, -1));
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          // Handle normal selection
          selectSuggestion(filteredOptions[highlightedIndex].name);
        } else {
          // Show all options if at start of input or previous character is a whitespace
          const cursorPosition = containerRef.current?.selectionStart ?? 0;
          if (cursorPosition === 0 || value[cursorPosition - 1] === " ") {
            setFilteredOptions(options);
            setShowSuggestions(true);
          }
          else if (value[cursorPosition - 1] === ".") {
            // Show children options if the word before the last dot is a parent option
            const lastWord = value.split(" ").at(-1)!.split(".").at(-2)!
            const isParent = options.some(opt => opt.name === lastWord && opt.children.length)
            if (isParent) {
              const option = options.find(opt => opt.name === lastWord && opt.children.length)!
              const childrenOptions = options.filter(opt => option.children.includes(opt.name));
              setFilteredOptions(childrenOptions);
              setShowSuggestions(true);
            }
          }
        }
        break
      case 'Enter':
        if (highlightedIndex >= 0) selectSuggestion(filteredOptions[highlightedIndex].name)
        if (!showSuggestions && onEnter) onEnter(e)
        break;
    }
  };

  const selectSuggestion = (option: string) => {
    const cursorPosition = containerRef.current?.selectionStart ?? 0;
    const originalValue = value;
    let newValue = originalValue;
  
    // Find the selected option and determine if it has children
    const selectedOption = options.find(opt => opt.name === option);
    const suffix = selectedOption?.children?.length ? '.' : ' ';
  
    // Build new value with appropriate suffix
    if (cursorPosition === 0 || originalValue[cursorPosition - 1] === " " || originalValue[cursorPosition - 1] === ".") {
      newValue = originalValue.slice(0, cursorPosition) + option + suffix + originalValue.slice(cursorPosition);
    } else {
      const textBeforeCursor = originalValue.slice(0, cursorPosition);
      const textAfterCursor = originalValue.slice(cursorPosition);
      const lastWordStart = textBeforeCursor.lastIndexOf(" ") + 1;
      newValue = textBeforeCursor.slice(0, lastWordStart) + option + suffix + textAfterCursor;
    }
  
    setValue(newValue);
    
    // If option has children, show them as next suggestions
    if (selectedOption?.children?.length) {
      const nextOptions = options.filter(opt => selectedOption.children.includes(opt.name));
      setFilteredOptions(nextOptions);
      setShowSuggestions(true);
      setHighlightedIndex(-1);
    } else {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  
    // Move cursor to end of inserted text
    setTimeout(() => {
      const newCursorPosition = cursorPosition + option.length + suffix.length + 1;
      containerRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  /** UI Event handlers to: 
   * Dynamically adjust the height of the component based on the height of the suggestions dropdown
   * Enable dynamic vertical scrolling of the suggestions component
   * Listen to clicks outside the suggestions dropdown to close it
  */

  // Adjust height of wrapper with suggestions
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current && wrapperRef.current) {
      const suggestionsHeight = suggestionsRef.current.offsetHeight;
      wrapperRef.current.style.height = `${40 + suggestionsHeight + 10}px`;
    } else if (wrapperRef.current) {
      wrapperRef.current.style.height = 'fit-content';
    }
  }, [showSuggestions, filteredOptions]);

  // Scroll suggestions list up / down
  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.children;
      if (items && items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'auto',
        });
      }
    }
  }, [highlightedIndex]);

  // Close suggestions when clicking outside of the dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current && 
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* Styles */
  const sharedStyle = `
    flex 
    absolute left-8 right-0
    h-9 w-[90%]
    rounded-none border border-input 
    px-3 py-1 inset-0
    text-base md:text-sm
    shadow-sm 
    transition-colors 
    caret-gray-800
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
    font-sans leading-none tracking-normal
  `;
  const containerStyle = "z-10 rounded-none rounded-tr-lg rounded-br-lg bg-transparent text-transparent"
  const overlayStyle   = "z-20 rounded-none rounded-tr-lg rounded-br-lg overflow-x-auto whitespace-pre-wrap pointer-events-none"

  /* Invisible formula input container */
  const container = 
  <input
    ref={containerRef}
    type="text"
    value={value}
    onChange={(e) => handleInputChange(e.target.value)}
    onKeyDown={handleKeyDown}
    onClick={(e) => e.stopPropagation()}
    onScroll={(e) => {
      if (overlayRef.current) {
        overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    }}
    className={`${sharedStyle} ${containerStyle}`}
  />

  /* Rendered formula input overlay that shows the text input with color styling using a highligher function
     which splits the input into tokens and conditionally styles each token with a corresponding text color
  */
  const getHighlightedContent = (text: string) => {

    // Split into tokens (words, dots, and whitespace)
    const tokens = text.split(/(\s+|\.)/g);
    const elements: JSX.Element[] = [];
    let previousOption: AutocompleteOption | null = null;
  
    tokens.forEach((token, index) => {

      // Skip empty tokens caused by split
      if (token === '') return;
  
      // Handle whitespace (retain original formatting)
      if (token.match(/^\s+$/)) {
        elements.push(<span key={index}>{token}</span>);
        previousOption = null;
        return;
      }
  
      // Style dot if it follows a parent option with children
      if (token === '.') {
        if (previousOption?.children?.length) {
          elements.push(<span key={index} className="text-orange-400">.</span>);
        } else {
          elements.push(<span key={index}>.</span>);
        }
        previousOption = null;
        return;
      }
  
      // Check if token matches an option
      const option = options.find((opt) => opt.name.toLowerCase() === token.toLowerCase());
      if (option) {
        const color = colors.find((c) => c.type === option.type)!.color;
        elements.push(<span key={index} style={{ color }}>{token}</span>);
        previousOption = option; // Track for next token
      } else {
        elements.push(<span key={index}>{token}</span>);
        previousOption = null;
      }
    });
  
    return elements;
  };
  const overlay = 
    <div ref={overlayRef} style={{scrollbarWidth: "none"}} className={`${sharedStyle} ${overlayStyle} p-0 leading-none box-border inline-flex items-center`}>
      {value === '' ? "Press Tab for suggestions" : getHighlightedContent(value)}
    </div>

  /* Autocomplete suggestions dropdown.*/
  const suggestions = 
    <div 
      ref={suggestionsRef}
      style={{"scrollbar-width": "none"} as React.CSSProperties}
      className="
        absolute z-20 left-0 mt-[40px] 
        w-full h-fit max-h-[150px] overflow-y-auto 
        border rounded-none rounded-tr-lg rounded-br-lg 
        bg-background shadow-lg
      "
    >
      {filteredOptions.map((option, index) => (
        <div 
          key={index} 
          onClick={() => selectSuggestion(option.name)} 
          className={`
            flex flex-row justify-between gap-2
            p-2 cursor-pointer 
            hover:text-black hover:bg-gray-200
            ${index === highlightedIndex ? 'bg-primary text-white' : ''}
          `}
        >
          {option.name}
          <span
            style={{"--text-color": colors.find(color => color.type === option.type)!.color} as React.CSSProperties} 
            className={`text-[--text-color] italic`}
          >
            {option.type}
          </span>
        </div>
      ))}
    </div>

  /* Button that just shows an fx symbol */
  const icon = <TbMathFunction className="absolute rounded-none rounded-tl-lg rounded-bl-lg border p-2 h-9 w-8 left-0 top-0"/>
  
  return (
    <div ref={wrapperRef} className="formula-input-container relative min-h-9 pl-8">
      {icon}
      {container}
      {overlay}
      {showSuggestions && suggestions}
    </div>
  );
};

export default FormulaInput;