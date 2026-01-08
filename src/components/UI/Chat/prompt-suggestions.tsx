interface PromptSuggestionsProps {
  label?: string;
  append: (message: { role: 'user'; content: string }) => void;
  suggestions: string[];
}

export function PromptSuggestions({ label, append, suggestions }: PromptSuggestionsProps) {
  return (
    <div className="space-y-6">
      {label && <h2 className="text-h2 text-center">{label}</h2>}
      <div className="text-body flex gap-6">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => append({ role: 'user', content: suggestion })}
            className="h-max flex-1 rounded-xl border bg-background p-4 hover:bg-muted"
          >
            <p>{suggestion}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
