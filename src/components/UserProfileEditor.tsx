import React, { useState, useEffect } from 'react';
import { useUserProfile, UserProfile } from '../hooks/useUserProfile';

interface UserProfileEditorProps {
  userId: string;
  onClose: () => void;
  onSave?: () => void;
}

export const UserProfileEditor: React.FC<UserProfileEditorProps> = ({ userId, onClose, onSave }) => {
  const { profile, loading, error, updateProfile } = useUserProfile(userId);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    first_name: '',
    last_name: '',
    email: ''
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || ''
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const success = await updateProfile({
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        email: formData.email || null
      });

      if (success) {
        setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => {
          onSave?.();
          onClose();
        }, 1500);
      } else {
        setSaveMessage({ type: 'error', text: 'Failed to update profile' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Empty is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isFormValid = validateEmail(formData.email || '');

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          backgroundColor: '#1e1e1e',
          padding: 32,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          color: '#fff',
          fontSize: 16
        }}>
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        width: '90%',
        maxWidth: 500,
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 4,
              padding: 12,
              marginBottom: 20,
              color: '#ef4444'
            }}>
              {error}
            </div>
          )}

          {/* Tier Display */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              color: '#888',
              fontSize: 14,
              marginBottom: 8
            }}>
              Subscription Tier
            </label>
            <div style={{
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 4,
              padding: 12,
              color: '#fff',
              fontSize: 16
            }}>
              Tier {profile?.tier || 1}
              {profile?.tier === 4 && ' (Tester Edition)'}
              {profile?.tier === 5 && ' (Developer Edition)'}
            </div>
          </div>

          {/* First Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              color: '#888',
              fontSize: 14,
              marginBottom: 8
            }}>
              First Name
            </label>
            <input
              type="text"
              value={formData.first_name || ''}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              placeholder="Enter your first name"
              style={{
                width: '100%',
                padding: 12,
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                fontSize: 16
              }}
            />
          </div>

          {/* Last Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              color: '#888',
              fontSize: 14,
              marginBottom: 8
            }}>
              Last Name
            </label>
            <input
              type="text"
              value={formData.last_name || ''}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              placeholder="Enter your last name"
              style={{
                width: '100%',
                padding: 12,
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                fontSize: 16
              }}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              color: '#888',
              fontSize: 14,
              marginBottom: 8
            }}>
              Email
            </label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter your email"
              style={{
                width: '100%',
                padding: 12,
                backgroundColor: '#2a2a2a',
                border: `1px solid ${!validateEmail(formData.email || '') ? '#ef4444' : '#444'}`,
                borderRadius: 4,
                color: '#fff',
                fontSize: 16
              }}
            />
            {!validateEmail(formData.email || '') && (
              <div style={{
                color: '#ef4444',
                fontSize: 14,
                marginTop: 8
              }}>
                Please enter a valid email address
              </div>
            )}
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div style={{
              backgroundColor: saveMessage.type === 'success' 
                ? 'rgba(34, 197, 94, 0.1)' 
                : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${saveMessage.type === 'success' 
                ? 'rgba(34, 197, 94, 0.3)' 
                : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: 4,
              padding: 12,
              marginBottom: 20,
              color: saveMessage.type === 'success' ? '#22c55e' : '#ef4444'
            }}>
              {saveMessage.text}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 16,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isFormValid}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 16,
                cursor: saving || !isFormValid ? 'not-allowed' : 'pointer',
                opacity: saving || !isFormValid ? 0.5 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};