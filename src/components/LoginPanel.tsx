import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import loginLogo from '../assets/login-logo.png'
// Removed direct supabase import - using IPC instead
import BlurCard from './BlurCard'

// Move InputWrapper outside to prevent recreation on every render
const InputWrapper = ({ children, style = {}, currentTheme }) => {
  if (currentTheme === 'light') {
    return (
      <div style={{
        background: '#f9f9f9',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        ...style
      }}>
        {children}
      </div>
    )
  }
  return <BlurCard style={style}>{children}</BlurCard>
}

export default function LoginPanel() {
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('radpal_theme') || 'dark')
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [signUpMode, setSignUpMode] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    try {
      // Try to restore saved credentials with error handling for quota database issues
      const remembered = localStorage.getItem('radpal_remember_login') === '1'
      const savedEmail = localStorage.getItem('radpal_email') || ''
      const savedPassword = localStorage.getItem('radpal_password') || ''

      if (remembered && savedEmail) {
        setRememberMe(true)
        setEmail(savedEmail)
        setPassword(savedPassword)
        console.log('✅ Restored saved login credentials for:', savedEmail)
      }
    } catch (err) {
      // If localStorage is corrupted due to quota database errors, silently fail
      console.warn('⚠️ Could not restore saved credentials (quota database issue):', err)
      // Try to clear and reset localStorage
      try {
        localStorage.removeItem('radpal_remember_login')
        localStorage.removeItem('radpal_email')
        localStorage.removeItem('radpal_password')
      } catch (clearErr) {
        console.error('Could not clear localStorage:', clearErr)
      }
    }

    if (emailRef.current) {
      emailRef.current.focus()
    }
  }, [])

  const waitForUserToExist = async (userId: string) => {
    let attempts = 0
    while (attempts < 10) {
      try {
        const result = await window.electronAPI?.checkUserExists(userId)
        if (result?.exists) return true
      } catch (err) {
        console.error('Error checking user existence:', err)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      attempts++
    }
    return false
  }

  const triggerTemplateCopy = async (userId: string) => {
    try {
      const confirmed = await waitForUserToExist(userId)
      if (!confirmed) {
        return
      }

      const response = await window.electronAPI?.triggerTemplateCopy(userId)
      if (!response?.success) {
        console.error('Template copy failed:', response?.error)
      }

    } catch (err) {
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setMessage(null)

    try {
      if (signUpMode) {
        // Validate sign-up fields
        if (!firstName.trim()) {
          setMessage('❌ Please enter your first name')
          return
        }
        
        if (!lastName.trim()) {
          setMessage('❌ Please enter your last name')
          return
        }
        
        if (password !== confirmPassword) {
          setMessage('❌ Passwords do not match')
          return
        }
        
        if (password.length < 6) {
          setMessage('❌ Password must be at least 6 characters')
          return
        }
        
        const result = await window.electronAPI?.checkInviteCode(inviteCode)
        
        if (!result?.data || result?.error) {
          setMessage('❌ Invalid or already used invite code')
          return
        }
      }

      const response = signUpMode
        ? await signUp(email, password)
        : await signIn(email, password)

      if (response.error) {
        setMessage(`❌ ${response.error.message}`)
        return
      }

      const userId = response.data?.user?.id

      if (signUpMode) {
        // Check if email confirmation is required
        if (response.confirmationRequired) {
          setMessage('✅ Success! Please check your email to confirm your account.')
          
          // Save user profile data for when they confirm
          if (userId && window.electronAPI?.invoke) {
            const profileResult = await window.electronAPI.invoke('update-user-profile', userId, {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              tier: 1 // Default tier for new users
            })
            
            if (!profileResult?.success) {
              console.error('Failed to save user profile:', profileResult?.error)
            }
            
            // Mark invite code as used even before email confirmation
            const updateResult = await window.electronAPI?.markInviteCodeUsed(
              inviteCode, 
              userId,
              email.trim(),
              firstName.trim(),
              lastName.trim()
            )
            if (!updateResult?.success) {
              console.error('Failed to mark invite code as used:', updateResult?.error)
            }
          }
          
          // Reset form
          setPassword('')
          setConfirmPassword('')
          setInviteCode('')
          return
        }
        
        // If no email confirmation required (immediate sign-in)
        if (userId) {
          // Save user profile with first and last name
          if (window.electronAPI?.invoke) {
            const profileResult = await window.electronAPI.invoke('update-user-profile', userId, {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              tier: 1 // Default tier for new users
            })
            
            if (!profileResult?.success) {
              console.error('Failed to save user profile:', profileResult?.error)
            } else {
              console.log('✅ User profile saved successfully')
            }
          }
          
          // Mark invite code as used with user profile information
          const updateResult = await window.electronAPI?.markInviteCodeUsed(
            inviteCode, 
            userId,
            email.trim(),
            firstName.trim(),
            lastName.trim()
          )
          if (!updateResult?.success) {
            console.error('Failed to mark invite code as used:', updateResult?.error)
          }
          await triggerTemplateCopy(userId)
        }
      }

      // Save credentials with error handling for quota database issues
      try {
        if (rememberMe) {
          localStorage.setItem('radpal_remember_login', '1')
          localStorage.setItem('radpal_email', email)
          localStorage.setItem('radpal_password', password)
          console.log('💾 Saved login credentials for:', email)
        } else {
          localStorage.removeItem('radpal_remember_login')
          localStorage.removeItem('radpal_email')
          localStorage.removeItem('radpal_password')
        }
      } catch (err) {
        console.warn('⚠️ Could not save credentials to localStorage:', err)
        // Continue with login even if we can't save credentials
      }

      setMessage(signUpMode
        ? '✅ Success! Check your email to confirm your account.'
        : '✅ Success! You are now signed in.')
    } catch (error) {
      setMessage(`❌ Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="radpal-login-wrapper"
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: currentTheme === 'light' ? '#ffffff' : 'inherit',
        WebkitAppRegion: 'drag',
        padding: signUpMode ? '20px 32px' : '60px 32px',
        textAlign: 'center',
        fontFamily: 'SF Pro, system-ui, sans-serif',
        fontWeight: 400,
        position: 'relative',
        overflow: 'auto'
      }}
    >
      {/* Window controls */}
      {/* Minimize button */}
      <button
        className="minimize-button"
        onClick={() => {
          // Use gentle close to minimize to tray
          if (window.electronAPI?.closeAppGentle) {
            window.electronAPI.closeAppGentle()
          }
        }}
        style={{
          position: 'absolute',
          top: 20,
          right: 60,
          background: currentTheme === 'light' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)',
          border: currentTheme === 'light' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 8,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: currentTheme === 'light' ? '#3b82f6' : '#60a5fa',
          fontSize: 20,
          lineHeight: 1,
          padding: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = currentTheme === 'light' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = currentTheme === 'light' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)'
        }}
        title="Minimize to tray"
      >
        −
      </button>
      
      {/* Close button */}
      <button
        className="close-button"
        onClick={() => {
          // Use quit-app to fully close the application
          if (window.electronAPI?.closeApp) {
            window.electronAPI.closeApp()
          } else if (window.electronAPI?.closeAppGentle) {
            // Fallback to gentle close if quit not available
            window.electronAPI.closeAppGentle()
          } else {
            window.close()
          }
        }}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: currentTheme === 'light' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(227, 103, 86, 0.2)',
          border: currentTheme === 'light' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(227, 103, 86, 0.3)',
          borderRadius: '50%',
          width: 32,
          height: 32,
          color: currentTheme === 'light' ? '#ef4444' : '#E36756',
          fontSize: 16,
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitAppRegion: 'no-drag',
          zIndex: 1000,
          transition: 'all 0.2s ease'
        }}
      >
        ×
      </button>

      <div 
        className={signUpMode ? 'signup-form-container' : ''}
        style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: signUpMode ? 'flex-start' : 'center',
        WebkitAppRegion: 'no-drag',
        maxWidth: 350,
        width: '100%',
        height: signUpMode ? 'auto' : '100%',
        maxHeight: signUpMode ? 'calc(100vh - 40px)' : '100%',
        overflowY: signUpMode ? 'auto' : 'visible',
        padding: signUpMode ? '20px 0' : '0',
        marginTop: signUpMode ? '20px' : '0'
      }}>
        {/* RadPal Logo */}
        <div
          className="radpal-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: signUpMode ? 20 : 32,
            transform: signUpMode ? 'scale(0.8)' : 'scale(1)',
            transition: 'all 0.3s ease'
          }}
        >
          <img 
            src={loginLogo}
            alt="RadPal"
            style={{
              width: signUpMode ? '180px' : '220px',
              height: 'auto',
              transition: 'all 0.3s ease'
            }}
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          style={{ marginBottom: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {signUpMode && (
            <>
              <InputWrapper currentTheme={currentTheme} style={{ marginBottom: 12, width: '100%', maxWidth: 280 }}>
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{
                    padding: 12,
                    width: '100%',
                    borderRadius: 16,
                    fontSize: 14,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 400,
                    backgroundColor: 'transparent',
                    color: currentTheme === 'light' ? '#000000' : '#fff',
                    border: 'none',
                    outline: 'none',
                    WebkitAppRegion: 'no-drag'
                  }}
                />
              </InputWrapper>
              <InputWrapper currentTheme={currentTheme} style={{ marginBottom: 12, width: '100%', maxWidth: 280 }}>
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={{
                    padding: 12,
                    width: '100%',
                    borderRadius: 16,
                    fontSize: 14,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 400,
                    backgroundColor: 'transparent',
                    color: currentTheme === 'light' ? '#000000' : '#fff',
                    border: 'none',
                    outline: 'none',
                    WebkitAppRegion: 'no-drag'
                  }}
                />
              </InputWrapper>
            </>
          )}
          <InputWrapper currentTheme={currentTheme} style={{ marginBottom: 12, width: '100%', maxWidth: 280 }}>
            <input
              ref={!signUpMode ? emailRef : undefined}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: 14,
                width: '100%',
                borderRadius: 16,
                fontSize: 14,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 400,
                backgroundColor: 'transparent',
                color: '#fff',
                border: 'none',
                outline: 'none',
                WebkitAppRegion: 'no-drag'
              }}
            />
          </InputWrapper>
          <InputWrapper currentTheme={currentTheme} style={{ 
            marginBottom: signUpMode && password && password.length < 6 ? 8 : 12, 
            width: '100%', 
            maxWidth: 280,
            borderColor: signUpMode && password && password.length < 6 ? 'rgba(239, 68, 68, 0.5)' : undefined
          }}>
            <input
              type="password"
              placeholder={signUpMode ? "Password (min 6 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: 14,
                width: '100%',
                borderRadius: 16,
                fontSize: 14,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 400,
                backgroundColor: 'transparent',
                color: '#fff',
                border: 'none',
                outline: 'none',
                WebkitAppRegion: 'no-drag'
              }}
            />
          </InputWrapper>
          {signUpMode && password && password.length < 6 && (
            <p style={{ 
              color: '#ef4444', 
              fontSize: 12, 
              marginTop: 0,
              marginBottom: 12,
              fontFamily: 'DM Sans, sans-serif'
            }}>
              Password must be at least 6 characters
            </p>
          )}
          {signUpMode && (
            <>
              <InputWrapper currentTheme={currentTheme} style={{ 
                marginBottom: confirmPassword && password !== confirmPassword ? 8 : 12, 
                width: '100%', 
                maxWidth: 280,
                borderColor: confirmPassword && password !== confirmPassword ? 'rgba(239, 68, 68, 0.5)' : undefined
              }}>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    padding: 12,
                    width: '100%',
                    borderRadius: 16,
                    fontSize: 14,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 400,
                    backgroundColor: 'transparent',
                    color: currentTheme === 'light' ? '#000000' : '#fff',
                    border: 'none',
                    outline: 'none',
                    WebkitAppRegion: 'no-drag'
                  }}
                />
              </InputWrapper>
              {confirmPassword && password !== confirmPassword && (
                <p style={{ 
                  color: '#ef4444', 
                  fontSize: 12, 
                  marginTop: 0,
                  marginBottom: 12,
                  fontFamily: 'DM Sans, sans-serif'
                }}>
                  Passwords do not match
                </p>
              )}
              <InputWrapper currentTheme={currentTheme} style={{ marginBottom: 12, width: '100%', maxWidth: 280 }}>
                <input
                  type="text"
                  placeholder="Invite Code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  style={{
                    padding: 12,
                    width: '100%',
                    borderRadius: 16,
                    fontSize: 14,
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 400,
                    backgroundColor: 'transparent',
                    color: currentTheme === 'light' ? '#000000' : '#fff',
                    border: 'none',
                    outline: 'none',
                    WebkitAppRegion: 'no-drag'
                  }}
                />
              </InputWrapper>
            </>
          )}
        </form>

        {currentTheme === 'light' ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ 
              marginBottom: signUpMode ? 12 : 20,
              padding: signUpMode ? '12px 28px' : '14px 32px', 
              borderRadius: 16, 
              fontSize: 14,
              background: 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
              opacity: isSubmitting ? 0.5 : 1,
              pointerEvents: isSubmitting ? 'none' : 'auto',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            {isSubmitting ? 'Loading...' : (signUpMode ? 'Sign Up' : 'Log In')}
          </button>
        ) : (
          <BlurCard 
            onClick={handleSubmit}
            style={{ 
              marginBottom: signUpMode ? 12 : 20,
              opacity: isSubmitting ? 0.5 : 1,
              pointerEvents: isSubmitting ? 'none' : 'auto',
              padding: 6
            }}
          >
            <button
              disabled={isSubmitting}
              style={{ 
                padding: signUpMode ? '12px 28px' : '14px 32px', 
                borderRadius: 16, 
                fontSize: 14,
                backgroundColor: 'transparent',
                color: '#fff',
                border: 'none',
                WebkitAppRegion: 'no-drag',
                pointerEvents: 'none'
              }}
            >
              {isSubmitting ? 'Loading...' : (signUpMode ? 'Sign Up' : 'Log In')}
            </button>
          </BlurCard>
        )}

        <label style={{
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: 'center',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 400,
          color: currentTheme === 'light' ? '#000000' : '#fff'
        }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => setRememberMe(!rememberMe)}
            style={{ WebkitAppRegion: 'no-drag' }}
          />
          <span>Remember Me</span>
        </label>

        {message && (
          <p className="login-message-animated" style={{
            marginTop: signUpMode ? 12 : 20,
            marginBottom: 0,
            color: message.startsWith('✅') ? 'green' : 'red',
            fontSize: signUpMode ? 14 : 16,
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 400
          }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: signUpMode ? 12 : 20, fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: 400, color: currentTheme === 'light' ? '#000000' : '#fff' }}>
          {signUpMode ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            style={{
              color: currentTheme === 'light' ? '#3B82F6' : '#7CC2D7',
              background: 'none',
              border: 'none',
              /* cursor removed */
              fontSize: 14,
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 400
            }}
            onClick={() => {
              setSignUpMode(!signUpMode)
              // Clear form fields when switching modes
              setMessage(null)
              setConfirmPassword('')
              setFirstName('')
              setLastName('')
              setInviteCode('')
            }}
          >
            {signUpMode ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
