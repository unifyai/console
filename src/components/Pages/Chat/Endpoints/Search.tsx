'use client';

import { Search } from 'lucide-react';
import Chip from '@/components/Common/Misc/Chip';
import { Input } from '@/components/Common/Input/Content';
import { KeyboardEvent, useState, Dispatch, SetStateAction } from 'react';
import ActionButton from '@/components/Common/Buttons/Action';

const SearchFilter = ({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
}) => {
  // Main content
  const [displayedQuery, setDisplayedQuery] = useState<string>('');
  const [queryChips, setQueryChips] = useState<string[]>([]);
  const onSearch = (value: string) => {
    const newQueries = [...queryChips, value.trim()];
    if (value.slice(-1) === ' ') {
      setDisplayedQuery('');
      setQueryChips(newQueries);
    } else {
      setDisplayedQuery(value);
    }
    setSearchQuery(newQueries.join(' '));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ','].includes(event.key) && displayedQuery != '') {
      event.preventDefault();
      onSearch(displayedQuery + ' ');
    }
    if (event.key === 'Backspace' && displayedQuery === '' && queryChips.length >= 1) {
      const lastChip = queryChips.at(-1);
      handleChipClose(lastChip!);
    }
  };
  const placeholder = queryChips.length === 0 ? 'Search...' : '';

  // Start content
  const handleChipClose = (query: string) => {
    const filteredChips = queryChips.filter((q) => q != query);
    setQueryChips(filteredChips);
    const newQuery = searchQuery
      .split(' ')
      .filter((q) => q != query)
      .join(' ');
    setSearchQuery(newQuery);
  };
  const StartContent = (
    <div className="flex flex-row flex-wrap gap-1">
      <Search className="text-default-300" />
      {queryChips.map((query, index) => (
        <Chip
          key={index}
          variant="outline"
          text={query}
          button={
            <ActionButton
              icon={<p className="mb-1 text-gray-500 hover:text-foreground">x</p>}
              tooltip={'Remove search term'}
              onClick={() => handleChipClose(query)}
              className="h-4 w-4"
            />
          }
        />
      ))}
    </div>
  );

  // End content
  const handleClear = () => {
    setSearchQuery('');
    setQueryChips([]);
    setDisplayedQuery('');
  };
  const EndContent = searchQuery && (
    <Chip
      button={
        <ActionButton
          icon={<p className="mb-1 text-gray-500 hover:text-foreground">x</p>}
          tooltip={'Clear search'}
          onClick={handleClear}
          className="h-4 w-4"
        />
      }
    />
  );

  return (
    <div className="w-full">
      <Input
        placeholder={placeholder}
        value={displayedQuery}
        StartContent={StartContent}
        EndContent={EndContent}
        onInput={(event) => onSearch(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        className="w-full"
      />
    </div>
  );
};

export default SearchFilter;
