/**
 * Picklist dropdown component for macro selection
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MacroPicklist.css';

interface MacroPicklistProps {
  options: string[];
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export const MacroPicklist: React.FC<MacroPicklistProps> = ({
  options,
  position,
  onSelect,
  onCancel
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[selectedIndex]) {
          onSelect(filteredOptions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
        
      case 'Tab':
        e.preventDefault();
        // Tab cycles through options
        if (e.shiftKey) {
          setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredOptions.length - 1);
        } else {
          setSelectedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
    }
  }, [filteredOptions, selectedIndex, onSelect, onCancel]);

  // Add keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Click outside to cancel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // Delay to avoid immediate cancellation
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  // Calculate position to keep dropdown in viewport
  const adjustedPosition = { ...position };
  const dropdownHeight = 250; // Approximate max height
  const dropdownWidth = 200;

  if (position.y + dropdownHeight > window.innerHeight) {
    adjustedPosition.y = position.y - dropdownHeight;
  }

  if (position.x + dropdownWidth > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - dropdownWidth - 10;
  }

  // Ensure selected item is visible
  useEffect(() => {
    const selectedElement = containerRef.current?.querySelector('.macro-picklist-item.selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={containerRef}
      className="macro-picklist-container"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`
      }}
    >
      {options.length > 5 && (
        <div className="macro-picklist-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Type to filter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      
      <div className="macro-picklist-options">
        {filteredOptions.length === 0 ? (
          <div className="macro-picklist-empty">No options match</div>
        ) : (
          filteredOptions.map((option, index) => (
            <div
              key={index}
              className={`macro-picklist-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(option)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {option}
            </div>
          ))
        )}
      </div>
      
      <div className="macro-picklist-footer">
        <span className="macro-picklist-hint">↑↓ Navigate • Enter Select • Esc Cancel</span>
      </div>
    </div>
  );
};