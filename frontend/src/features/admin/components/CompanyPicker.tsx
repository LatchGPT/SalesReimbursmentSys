import { useMemo, useRef, useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Company } from '../../../types';
import { findExactMatch, findSimilarCompanies } from '../../../lib/companyMatch';

export interface CompanyPickerProps {
  id?: string;
  value: string;
  companies: Company[];
  onSelectExisting: (company: Company) => void;
  onChangeText: (name: string) => void;
  placeholder?: string;
}

export function CompanyPicker({ id, value, companies, onSelectExisting, onChangeText, placeholder }: CompanyPickerProps) {
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<number | null>(null);

  const exactMatch = useMemo(() => findExactMatch(value, companies), [value, companies]);
  const showExactSuggestion = exactMatch && exactMatch.name !== value;
  const similar = useMemo(
    () => (showExactSuggestion ? [] : findSimilarCompanies(value, companies)),
    [value, companies, showExactSuggestion]
  );
  const trimmed = value.trim();
  const showAddNew = focused && trimmed.length >= 2 && !exactMatch;
  const showDropdown = focused && trimmed.length >= 2 && (showExactSuggestion || similar.length > 0 || showAddNew);

  const select = (company: Company) => {
    if (blurTimeout.current) window.clearTimeout(blurTimeout.current);
    onSelectExisting(company);
    setFocused(false);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder || 'Type a company name...'}
        onChange={e => onChangeText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { blurTimeout.current = window.setTimeout(() => setFocused(false), 150); }}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full rounded-input border border-outline-variant bg-white shadow-lg overflow-hidden">
          {showExactSuggestion && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); select(exactMatch); }}
              className="w-full text-left px-4 py-2.5 hover:bg-primary/5 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">domain</span>
              <span className="text-body-sm">
                Use existing: <span className="font-semibold text-on-surface">{exactMatch.name}</span>
              </span>
            </button>
          )}
          {similar.length > 0 && (
            <div className={showExactSuggestion ? 'border-t border-outline-variant' : ''}>
              <p className="px-4 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-outline">Did you mean?</p>
              {similar.map(match => (
                <button
                  key={match.company.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(match.company); }}
                  className="w-full text-left px-4 py-2 hover:bg-primary/5 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px] text-outline">domain</span>
                  <span className="text-body-sm text-on-surface">{match.company.name}</span>
                </button>
              ))}
            </div>
          )}
          {showAddNew && (
            <div className={`px-4 py-2.5 text-xs text-outline ${showExactSuggestion || similar.length > 0 ? 'border-t border-outline-variant bg-surface-container-low' : ''}`}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">add_circle</span>
              No match found — <span className="font-semibold text-on-surface">"{trimmed}"</span> will be added as a new
              company when you save, marked "Pending review" for an admin to check.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
