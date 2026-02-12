import { useState, useEffect } from 'react';
import { Search, X, Clock } from 'lucide-react';

interface NaturalLanguageSearchProps {
  onSearch: (filters: SearchFilters) => void;
  placeholder?: string;
}

export interface SearchFilters {
  query: string;
  namespace?: string;
  status?: string[];
  healthScore?: { min?: number; max?: number };
  failureRisk?: string[];
  tags?: string[];
}

// Parse natural language query into structured filters
function parseQuery(query: string): SearchFilters {
  const filters: SearchFilters = { query };

  const lowerQuery = query.toLowerCase();

  // Extract namespace
  const namespaceMatch = lowerQuery.match(/(?:in|namespace)\s+([a-z0-9-]+)/);
  if (namespaceMatch) {
    filters.namespace = namespaceMatch[1];
  }

  // Extract status
  const statusKeywords = ['running', 'pending', 'failed', 'succeeded', 'crashing', 'terminating'];
  const foundStatuses = statusKeywords.filter(status => lowerQuery.includes(status));
  if (foundStatuses.length > 0) {
    filters.status = foundStatuses;
  }

  // Extract health score
  if (lowerQuery.includes('healthy')) {
    filters.healthScore = { min: 80 };
  } else if (lowerQuery.includes('unhealthy') || lowerQuery.includes('degraded')) {
    filters.healthScore = { max: 60 };
  }

  // Extract failure risk
  const riskKeywords = ['critical', 'high risk', 'medium risk', 'low risk'];
  const foundRisks: string[] = [];
  if (lowerQuery.includes('critical')) foundRisks.push('critical');
  if (lowerQuery.includes('high risk') || lowerQuery.includes('high-risk')) foundRisks.push('high');
  if (lowerQuery.includes('medium risk') || lowerQuery.includes('medium-risk')) foundRisks.push('medium');
  if (lowerQuery.includes('low risk') || lowerQuery.includes('low-risk')) foundRisks.push('low');

  if (foundRisks.length > 0) {
    filters.failureRisk = foundRisks;
  }

  return filters;
}

export function NaturalLanguageSearch({
  onSearch,
  placeholder = 'Search: "failing pods in production" or "high cpu usage in default"'
}: NaturalLanguageSearchProps) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('search-history');
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  // Save to history
  const addToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const newHistory = [
      searchQuery,
      ...history.filter(h => h !== searchQuery)
    ].slice(0, 5); // Keep only 5 recent

    setHistory(newHistory);
    localStorage.setItem('search-history', JSON.stringify(newHistory));
  };

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onSearch({ query: '' });
      return;
    }

    const filters = parseQuery(searchQuery);
    onSearch(filters);
    addToHistory(searchQuery);
    setShowHistory(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    } else if (e.key === 'Escape') {
      setQuery('');
      setShowHistory(false);
      onSearch({ query: '' });
    }
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    handleSearch(historyQuery);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('search-history');
  };

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          onFocus={() => setShowHistory(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              onSearch({ query: '' });
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search History Dropdown */}
      {showHistory && history.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500">Recent Searches</span>
            <button
              onClick={clearHistory}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
          {history.map((item, index) => (
            <button
              key={index}
              onClick={() => handleHistoryClick(item)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 group"
            >
              <Clock className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
              <span className="text-gray-700 group-hover:text-gray-900">{item}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Examples */}
      {!query && !showHistory && (
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Examples:</span>
          {[
            'failing pods in production',
            'high cpu usage',
            'unhealthy deployments',
            'critical risk pods'
          ].map((example) => (
            <button
              key={example}
              onClick={() => {
                setQuery(example);
                handleSearch(example);
              }}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
