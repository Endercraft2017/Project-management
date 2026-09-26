/**
 * Message Search Component
 * Search messages within a conversation (includes thread replies)
 */

import { useState } from 'react';
import { Search, X, MessageSquare } from 'lucide-react';
import { get } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface SearchResult {
  id: string;
  content: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    picture?: string;
  };
  createdAt: string;
  isThreadReply: boolean;
  parentMessage?: {
    id: string;
    content: string;
    senderName: string;
  };
}

interface MessageSearchProps {
  conversationId: string;
  onResultClick: (messageId: string, isThreadReply: boolean, parentMessageId?: string) => void;
}

export default function MessageSearch({ conversationId, onResultClick }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await get<{ results: SearchResult[]; total: number }>(
        `/api/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`
      );
      setResults(response.results);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="flex items-center gap-2 border-b border-border bg-background p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search messages..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search Results */}
      {showResults && (
        <div className="max-h-96 overflow-y-auto border-b border-border bg-muted/20">
          {results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="mx-auto mb-2 h-12 w-12 opacity-20" />
              <p>No messages found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() =>
                    onResultClick(
                      result.id,
                      result.isThreadReply,
                      result.parentMessage?.id
                    )
                  }
                  className="w-full p-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-2">
                    {result.sender.picture ? (
                      <img
                        src={result.sender.picture}
                        alt={result.sender.name}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {result.sender.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {result.sender.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(result.createdAt)}
                        </span>
                        {result.isThreadReply && (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <MessageSquare className="h-3 w-3" />
                            Thread
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {highlightMatch(result.content, query)}
                      </p>
                      {result.parentMessage && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          In reply to: {result.parentMessage.senderName} -{' '}
                          {result.parentMessage.content.substring(0, 50)}
                          {result.parentMessage.content.length > 50 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="p-2 text-center text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
        </div>
      )}
    </div>
  );
}
