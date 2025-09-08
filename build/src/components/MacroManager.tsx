/**
 * Macro Manager UI for CRUD operations on macros
 */

import React, { useState, useEffect, useCallback } from 'react';
import { macroStore } from '../stores/macroStore';
import type { Macro, MacroType, MacroScope } from '../types/macro';
import './MacroManager.css';

interface MacroManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MacroManager: React.FC<MacroManagerProps> = ({ isOpen, onClose }) => {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMacro, setEditingMacro] = useState<Partial<Macro> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for editing/creating
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as MacroType,
    valueText: '',
    options: [] as string[],
    scope: 'global' as MacroScope
  });

  // Load macros on mount
  useEffect(() => {
    if (isOpen) {
      loadMacros();
    }
  }, [isOpen]);

  const loadMacros = async () => {
    setLoading(true);
    try {
      const loadedMacros = await macroStore.listMacros();
      setMacros(loadedMacros);
    } catch (err) {
      setError('Failed to load macros');
      console.error('Error loading macros:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingMacro(null);
    setFormData({
      name: '',
      type: 'text',
      valueText: '',
      options: [],
      scope: 'global'
    });
  };

  const handleEdit = (macro: Macro) => {
    setEditingMacro(macro);
    setIsCreating(false);
    setFormData({
      name: macro.name,
      type: macro.type,
      valueText: macro.valueText || '',
      options: macro.options || [],
      scope: macro.scope || 'global'
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Macro name is required');
      return;
    }

    if (formData.type === 'text' && !formData.valueText.trim()) {
      setError('Text value is required for text macros');
      return;
    }

    if (formData.type === 'picklist' && formData.options.length === 0) {
      setError('At least one option is required for picklist macros');
      return;
    }

    setLoading(true);
    try {
      const macroData: Partial<Macro> = {
        name: formData.name.trim(),
        type: formData.type,
        scope: formData.scope
      };

      if (formData.type === 'text') {
        macroData.valueText = formData.valueText;
      } else {
        macroData.options = formData.options.filter(opt => opt.trim());
      }

      if (editingMacro?.id) {
        await macroStore.updateMacro(editingMacro.id, macroData);
      } else {
        await macroStore.saveMacro(macroData as Omit<Macro, 'id' | 'createdAt' | 'updatedAt'>);
      }

      await loadMacros();
      setEditingMacro(null);
      setIsCreating(false);
      setError(null);
    } catch (err) {
      setError('Failed to save macro');
      console.error('Error saving macro:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this macro?')) {
      return;
    }

    setLoading(true);
    try {
      await macroStore.deleteMacro(id);
      await loadMacros();
    } catch (err) {
      setError('Failed to delete macro');
      console.error('Error deleting macro:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingMacro(null);
    setIsCreating(false);
    setFormData({
      name: '',
      type: 'text',
      valueText: '',
      options: [],
      scope: 'global'
    });
  };

  const handleOptionsChange = (value: string) => {
    // Parse options from comma or newline separated string
    const options = value
      .split(/[,\n]/)
      .map(opt => opt.trim())
      .filter(opt => opt);
    setFormData(prev => ({ ...prev, options }));
  };

  const handleExport = async () => {
    try {
      const json = await macroStore.exportMacros();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `radpal-macros-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export macros');
      console.error('Error exporting macros:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await macroStore.importMacros(text);
      await loadMacros();
      setError(null);
    } catch (err) {
      setError('Failed to import macros - invalid format');
      console.error('Error importing macros:', err);
    }
  };

  // Filter macros based on search
  const filteredMacros = macros.filter(macro =>
    macro.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (macro.valueText && macro.valueText.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (macro.options && macro.options.some(opt => opt.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (!isOpen) return null;

  return (
    <div className="macro-manager-overlay">
      <div className="macro-manager-modal">
        <div className="macro-manager-header">
          <h2>Macro Manager</h2>
          <button className="macro-manager-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="macro-manager-error">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="macro-manager-toolbar">
          <input
            type="text"
            className="macro-manager-search"
            placeholder="Search macros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="macro-manager-btn primary" onClick={handleCreate}>
            + New Macro
          </button>
          <button className="macro-manager-btn" onClick={handleExport}>
            Export
          </button>
          <label className="macro-manager-btn">
            Import
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
        </div>

        {(isCreating || editingMacro) ? (
          <div className="macro-manager-form">
            <h3>{isCreating ? 'Create New Macro' : 'Edit Macro'}</h3>
            
            <div className="macro-form-group">
              <label>Name (spoken after trigger word)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., knee, severity, normal"
              />
            </div>

            <div className="macro-form-group">
              <label>Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  type: e.target.value as MacroType 
                }))}
              >
                <option value="text">Text</option>
                <option value="picklist">Picklist</option>
              </select>
            </div>

            <div className="macro-form-group">
              <label>Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  scope: e.target.value as MacroScope 
                }))}
              >
                <option value="global">Global (All editors)</option>
                <option value="findings">Findings only</option>
                <option value="impression">Impression only</option>
              </select>
            </div>

            {formData.type === 'text' ? (
              <div className="macro-form-group">
                <label>Text Value</label>
                <textarea
                  value={formData.valueText}
                  onChange={(e) => setFormData(prev => ({ ...prev, valueText: e.target.value }))}
                  placeholder="The text to insert when this macro is triggered"
                  rows={4}
                />
              </div>
            ) : (
              <div className="macro-form-group">
                <label>Options (comma or newline separated)</label>
                <textarea
                  value={formData.options.join('\n')}
                  onChange={(e) => handleOptionsChange(e.target.value)}
                  placeholder="mild&#10;moderate&#10;severe"
                  rows={4}
                />
                {formData.options.length > 0 && (
                  <div className="macro-options-preview">
                    Preview: {formData.options.map((opt, i) => (
                      <span key={i} className="macro-option-chip">{opt}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="macro-form-actions">
              <button 
                className="macro-manager-btn primary" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button 
                className="macro-manager-btn" 
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="macro-manager-list">
            {loading ? (
              <div className="macro-manager-loading">Loading macros...</div>
            ) : filteredMacros.length === 0 ? (
              <div className="macro-manager-empty">
                {searchTerm ? 'No macros match your search' : 'No macros yet. Click "New Macro" to create one.'}
              </div>
            ) : (
              <table className="macro-manager-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Value/Options</th>
                    <th>Scope</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMacros.map(macro => (
                    <tr key={macro.id}>
                      <td className="macro-name">{macro.name}</td>
                      <td className="macro-type">
                        <span className={`type-badge ${macro.type}`}>
                          {macro.type}
                        </span>
                      </td>
                      <td className="macro-value">
                        {macro.type === 'text' 
                          ? (macro.valueText || '').substring(0, 50) + ((macro.valueText || '').length > 50 ? '...' : '')
                          : macro.options?.join(', ')
                        }
                      </td>
                      <td className="macro-scope">
                        <span className={`scope-badge ${macro.scope || 'global'}`}>
                          {macro.scope || 'global'}
                        </span>
                      </td>
                      <td className="macro-actions">
                        <button
                          className="macro-action-btn edit"
                          onClick={() => handleEdit(macro)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="macro-action-btn delete"
                          onClick={() => handleDelete(macro.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};