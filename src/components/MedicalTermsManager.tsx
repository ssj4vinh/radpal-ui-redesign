import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Save, X, Search, Upload, Download } from 'lucide-react';

interface MedicalTerm {
  term: string;
  weight: number;
  category: string;
}

interface MedicalTermsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MedicalTermsManager: React.FC<MedicalTermsManagerProps> = ({ isOpen, onClose }) => {
  const [terms, setTerms] = useState<MedicalTerm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newTerm, setNewTerm] = useState('');
  const [newWeight, setNewWeight] = useState(2);
  const [newCategory, setNewCategory] = useState('custom');
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  console.log('🏥 MedicalTermsManager render, isOpen:', isOpen);

  const categories = [
    'all',
    'anatomy',
    'pathology',
    'mri_terms',
    'directions',
    'abbreviations',
    'spine',
    'custom'
  ];

  useEffect(() => {
    if (isOpen) {
      loadTerms();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const loadTerms = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.fetchMedicalTerms();
      if (result.success && result.keywords) {
        const termsList: MedicalTerm[] = [];
        for (const [category, terms] of Object.entries(result.keywords)) {
          if (typeof terms === 'object' && !Array.isArray(terms)) {
            for (const [term, weight] of Object.entries(terms)) {
              if (term !== '_comment' && typeof weight === 'number') {
                termsList.push({ term, weight: weight as number, category });
              }
            }
          }
        }
        // Sort terms alphabetically by category and then by term
        termsList.sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.term.toLowerCase().localeCompare(b.term.toLowerCase());
        });
        setTerms(termsList);
      }
    } catch (error) {
      console.error('Failed to load medical terms:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTerms = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.saveMedicalTerms(terms);
      if (result.success) {
        setHasChanges(false);
        // Reload terms to ensure we have the latest from database
        await loadTerms();
        // Show success feedback
        console.log('✅ Medical terms saved successfully');
      } else {
        console.error('Failed to save medical terms:', result.error);
        alert('Failed to save medical terms: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to save medical terms:', error);
      alert('Failed to save medical terms: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addTerm = async () => {
    if (newTerm.trim()) {
      const termExists = terms.some(t => 
        t.term.toLowerCase() === newTerm.toLowerCase() && 
        t.category === newCategory
      );
      
      if (!termExists) {
        // Create new term
        const newTermObj = { 
          term: newTerm.trim(), 
          weight: newWeight, 
          category: newCategory 
        };
        
        // Insert in alphabetical order within the same category
        const newTermsList = [...terms, newTermObj].sort((a, b) => {
          // First sort by category
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          // Then sort alphabetically by term within the same category
          return a.term.toLowerCase().localeCompare(b.term.toLowerCase());
        });
        
        setTerms(newTermsList);
        setNewTerm('');
        setNewWeight(2);
        setHasChanges(true);
        
        // Auto-save the new term
        try {
          setLoading(true);
          const result = await window.electronAPI.saveMedicalTerms(newTermsList);
          if (result.success) {
            setHasChanges(false);
            console.log('✅ New term added and saved');
          } else {
            console.error('Failed to save new term:', result.error);
          }
        } catch (error) {
          console.error('Failed to save new term:', error);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const updateTermWeight = (index: number, delta: number) => {
    const updatedTerms = [...terms];
    const newWeight = Math.max(-5, Math.min(5, updatedTerms[index].weight + delta));
    updatedTerms[index].weight = newWeight;
    setTerms(updatedTerms);
    setHasChanges(true);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Auto-save after 1 second of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const result = await window.electronAPI.saveMedicalTerms(updatedTerms);
        if (result.success) {
          setHasChanges(false);
          console.log('✅ Weight updated and saved');
        } else {
          console.error('Failed to save weight update:', result.error);
        }
      } catch (error) {
        console.error('Failed to save weight update:', error);
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  const removeTerm = async (index: number) => {
    const updatedTerms = terms.filter((_, i) => i !== index);
    setTerms(updatedTerms);
    setHasChanges(true);
    
    // Auto-save after removing term
    try {
      setLoading(true);
      const result = await window.electronAPI.saveMedicalTerms(updatedTerms);
      if (result.success) {
        setHasChanges(false);
        console.log('✅ Term removed and saved');
      } else {
        console.error('Failed to save after removing term:', result.error);
      }
    } catch (error) {
      console.error('Failed to save after removing term:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTerms = terms.filter(term => {
    const matchesSearch = term.term.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const exportTerms = () => {
    const dataStr = JSON.stringify({ keywords: terms }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'medical-terms-backup.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importTerms = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (imported.keywords && Array.isArray(imported.keywords)) {
            setTerms(imported.keywords);
            setHasChanges(true);
          }
        } catch (error) {
          console.error('Failed to import terms:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) {
    console.log('🏥 MedicalTermsManager not rendering modal (isOpen=false)');
    return null;
  }

  console.log('🏥 MedicalTermsManager rendering modal UI');
  
  // Use inline styles for better control
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      pointerEvents: 'auto',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '900px',
        height: '85vh',
        maxHeight: '700px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingBottom: '16px',
          borderBottom: '1px solid #374151'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>Medical Terms Dictionary</h2>
          <button
            onClick={onClose}
            style={{ color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', padding: '4px' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <div style={{ 
          fontSize: '14px', 
          color: '#9ca3af', 
          marginTop: '12px',
          marginBottom: '16px'
        }}>
          Manage custom medical terms with weight boosting for improved dictation accuracy.
          Weights range from -5 (suppress) to 5 (strongly boost).
        </div>

        {/* Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '16px'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#9ca3af' 
            }} size={16} />
            <input
              type="text"
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#374151',
                color: 'white',
                paddingLeft: '40px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                borderRadius: '6px',
                border: '1px solid #4b5563',
                outline: 'none'
              }}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-700 text-white px-3 py-2 rounded"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
          <button
            onClick={exportTerms}
            className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            title="Export terms"
          >
            <Download size={16} />
          </button>
          <label className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 cursor-pointer">
            <Upload size={16} />
            <input
              type="file"
              accept=".json"
              onChange={importTerms}
              className="hidden"
            />
          </label>
        </div>

        {/* Add new term */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add new term..."
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTerm()}
            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-gray-700 text-white px-3 py-2 rounded"
          >
            {categories.filter(c => c !== 'all').map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="-5"
            max="5"
            value={newWeight}
            onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
            className="w-20 bg-gray-700 text-white px-3 py-2 rounded"
          />
          <button
            onClick={addTerm}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Add
          </button>
        </div>

        {/* Terms list */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          marginBottom: '16px',
          minHeight: 0,
          backgroundColor: '#111827',
          borderRadius: '8px',
          padding: '12px',
          border: '1px solid #374151'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTerms.map((term, index) => (
              <div key={`${term.category}-${term.term}-${index}`} 
                   style={{
                     display: 'flex',
                     alignItems: 'center',
                     gap: '8px',
                     backgroundColor: '#374151',
                     padding: '8px 12px',
                     borderRadius: '6px'
                   }}>
                <span style={{ flex: 1, color: 'white' }}>{term.term}</span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{term.category}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => updateTermWeight(index, -1)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: term.weight <= -5 ? '#4b5563' : '#6b7280',
                      color: 'white',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: term.weight <= -5 ? 'not-allowed' : 'pointer',
                      opacity: term.weight <= -5 ? 0.5 : 1
                    }}
                    disabled={term.weight <= -5}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{
                    width: '32px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    color: term.weight > 0 ? '#10b981' : term.weight < 0 ? '#ef4444' : '#9ca3af',
                    fontWeight: 'bold'
                  }}>
                    {term.weight > 0 ? '+' : ''}{term.weight}
                  </span>
                  <button
                    onClick={() => updateTermWeight(index, 1)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: term.weight >= 5 ? '#4b5563' : '#6b7280',
                      color: 'white',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: term.weight >= 5 ? 'not-allowed' : 'pointer',
                      opacity: term.weight >= 5 ? 0.5 : 1
                    }}
                    disabled={term.weight >= 5}
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => removeTerm(index)}
                    style={{
                      marginLeft: '8px',
                      padding: '4px 8px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid #374151'
        }}>
          <div style={{ fontSize: '14px', color: '#9ca3af' }}>
            {filteredTerms.length} terms shown
            {loading && <span style={{ color: '#60a5fa', marginLeft: '8px' }}>• Saving...</span>}
            {!loading && hasChanges && <span style={{ color: '#fbbf24', marginLeft: '8px' }}>• Unsaved changes</span>}
            {!loading && !hasChanges && <span style={{ color: '#10b981', marginLeft: '8px' }}>• All changes saved</span>}
          </div>
          <button
            onClick={saveTerms}
            disabled={!hasChanges || loading}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: hasChanges && !loading ? '#2563eb' : '#374151',
              color: hasChanges && !loading ? 'white' : '#9ca3af',
              border: 'none',
              cursor: hasChanges && !loading ? 'pointer' : 'not-allowed',
              opacity: hasChanges && !loading ? 1 : 0.6
            }}
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicalTermsManager;