import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import logo from '../assets/radpal_logo_dev.png'
// Removed direct supabase import - using IPC instead
import BlurCard from './BlurCard'

export default function LoginPanel() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [signUpMode, setSignUpMode] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const remembered = localStorage.getItem('radpal_remember_login') === '1'
    const savedEmail = localStorage.getItem('radpal_email') || ''
    const savedPassword = localStorage.getItem('radpal_password') || ''

    if (remembered) {
      setRememberMe(true)
      setEmail(savedEmail)
      setPassword(savedPassword)
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
      // console.log('🔍 triggerTemplateCopy → userId:', userId)
      const confirmed = await waitForUserToExist(userId)
      // console.log('🧪 waitForUserToExist result:', confirmed)
      if (!confirmed) {
        // console.error('❌ Gave up waiting for user to appear in users table')
        return
      }

      const response = await window.electronAPI?.triggerTemplateCopy(userId)
      if (!response?.success) {
        console.error('Template copy failed:', response?.error)
      }

    } catch (err) {
      // console.error('🔥 Template seeding failed:', err)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setMessage(null)

    try {
      if (signUpMode) {
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

      if (signUpMode && userId) {
        // console.log('✅ Signup complete for:', userId)
        const updateResult = await window.electronAPI?.markInviteCodeUsed(inviteCode, userId)
        if (!updateResult?.success) {
          console.error('Failed to mark invite code as used:', updateResult?.error)
        }
        // console.log('✅ Invite code marked used, seeding templates...')
        await triggerTemplateCopy(userId)
      }

      if (rememberMe) {
        localStorage.setItem('radpal_remember_login', '1')
        localStorage.setItem('radpal_email', email)
        localStorage.setItem('radpal_password', password)
      } else {
        localStorage.removeItem('radpal_remember_login')
        localStorage.removeItem('radpal_email')
        localStorage.removeItem('radpal_password')
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
        backgroundColor: 'inherit',
        WebkitAppRegion: 'drag',
        padding: '60px 32px',
        textAlign: 'center',
        fontFamily: 'SF Pro, system-ui, sans-serif',
        fontWeight: 400,
        position: 'relative'
      }}
    >
      {/* Close button */}
      <button
        onClick={() => {
          if (window.electronAPI?.closeApp) {
            window.electronAPI.closeApp()
          } else {
            window.close()
          }
        }}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(227, 103, 86, 0.2)',
          border: '1px solid rgba(227, 103, 86, 0.3)',
          borderRadius: '50%',
          width: 32,
          height: 32,
          color: '#E36756',
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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(227, 103, 86, 0.3)'
          e.currentTarget.style.transform = 'scale(1.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(227, 103, 86, 0.2)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        ×
      </button>

      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitAppRegion: 'no-drag',
        maxWidth: 350,
        width: '100%'
      }}>
        <img
          src={logo}
          alt="RadPal Logo"
          className="radpal-logo"
          style={{ 
            maxWidth: 400, 
            marginBottom: 32,
            backgroundColor: 'transparent',
            mixBlendMode: 'normal'
          }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          style={{ marginBottom: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <BlurCard style={{ marginBottom: 16, width: '100%', maxWidth: 280 }}>
            <input
              ref={emailRef}
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
          </BlurCard>
          <BlurCard style={{ marginBottom: 16, width: '100%', maxWidth: 280 }}>
            <input
              type="password"
              placeholder="Password"
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
          </BlurCard>
          {signUpMode && (
            <BlurCard style={{ marginBottom: 16, width: '100%', maxWidth: 280 }}>
              <input
                type="text"
                placeholder="Invite Code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
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
            </BlurCard>
          )}
        </form>

        <BlurCard 
          onClick={handleSubmit}
          style={{ 
            marginBottom: 20,
            /* cursor removed */
            opacity: isSubmitting ? 0.5 : 1,
            pointerEvents: isSubmitting ? 'none' : 'auto',
            padding: 6
          }}
        >
          <button
            disabled={isSubmitting}
            style={{ 
              padding: '14px 32px', 
              borderRadius: 16, 
              fontSize: 14,
              backgroundColor: 'transparent',
              color: '#fff',
              border: 'none',
              /* cursor removed */
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'none'
            }}
          >
            {isSubmitting ? 'Loading...' : (signUpMode ? 'Sign Up' : 'Log In')}
          </button>
        </BlurCard>

        <label style={{
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: 'center',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 400,
          color: '#fff'
        }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => setRememberMe(!rememberMe)}
            style={{ WebkitAppRegion: 'no-drag' }}
          />
          Remember Me
        </label>

        {message && (
          <p className="login-message-animated" style={{
            marginTop: 20,
            color: message.startsWith('✅') ? 'green' : 'red',
            fontSize: 16,
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 400
          }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: 20, fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: 400, color: '#fff' }}>
          {signUpMode ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            style={{
              color: '#7CC2D7',
              background: 'none',
              border: 'none',
              /* cursor removed */
              fontSize: 14,
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 400
            }}
            onClick={() => setSignUpMode(!signUpMode)}
          >
            {signUpMode ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
