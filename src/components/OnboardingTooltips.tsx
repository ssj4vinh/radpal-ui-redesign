import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipStep {
  id: string
  targetSelector: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  highlightPadding?: number
}

const TOOLTIP_STEPS: TooltipStep[] = [
  {
    id: 'findings',
    targetSelector: '[data-tooltip-id="findings-textbox"]',
    title: '📝 Findings Input Area',
    content: 'Enter your findings here - you can dictate directly using the microphone button, or copy and paste from your existing dictation software (PowerScribe, Fluency, etc.). RadPal accepts findings in any order or format.',
    position: 'top'
  },
  {
    id: 'dictate',
    targetSelector: '[data-tooltip-id="dictate-button"]',
    title: '🎤 Voice Dictation',
    content: 'Click to start voice dictation directly into RadPal. Works with PowerMic and standard microphones. Click again to stop recording.',
    position: 'right'
  },
  {
    id: 'ai-model',
    targetSelector: '[data-tooltip-id="ai-model-selector"]',
    title: '🤖 AI Model Selection',
    content: 'Choose your AI model. Claude Sonnet is recommended for best accuracy. Different models have different capabilities and token limits.',
    position: 'bottom'
  },
  {
    id: 'token-counter',
    targetSelector: '[data-tooltip-id="token-counter"]',
    title: '📊 Daily Token Usage',
    content: 'Track your daily AI token usage here. Tokens reset every 24 hours. Different subscription tiers have different limits.',
    position: 'bottom'
  },
  {
    id: 'study-type',
    targetSelector: '[data-tooltip-id="study-type-selector"]',
    title: '🏥 Study Type Selection',
    content: 'Select your study type (e.g., MRI Knee, CT Chest). This determines which template RadPal uses to organize your findings.',
    position: 'bottom'
  },
  {
    id: 'generate-report',
    targetSelector: '[data-tooltip-id="generate-report-button"]',
    title: '📄 Generate Full Report',
    content: 'Click here to generate a complete radiology report with all sections filled according to your template and customization rules.',
    position: 'top'
  },
  {
    id: 'generate-impression',
    targetSelector: '[data-tooltip-id="generate-impression-button"]',
    title: '💡 Generate Impression Only',
    content: 'Generate just the impression section - perfect for quick summaries or when you only need the conclusion.',
    position: 'top'
  }
]

interface OnboardingTooltipsProps {
  onComplete?: () => void
}

export const OnboardingTooltips: React.FC<OnboardingTooltipsProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [arrowPosition, setArrowPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('radpal_onboarding_completed')
    if (!hasSeenOnboarding) {
      // Start onboarding after a short delay
      setTimeout(() => setIsVisible(true), 1000)
    }
  }, [])

  const calculatePosition = useCallback((step: TooltipStep) => {
    const element = document.querySelector(step.targetSelector) as HTMLElement
    if (!element) return null

    const rect = element.getBoundingClientRect()
    const tooltipWidth = 320
    const tooltipHeight = 150
    const padding = 15

    let top = 0
    let left = 0
    let arrow: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

    const position = step.position || 'auto'

    if (position === 'auto' || position === 'bottom') {
      // Try bottom first
      top = rect.bottom + padding
      left = rect.left + rect.width / 2 - tooltipWidth / 2
      arrow = 'top'

      // Check if it goes off screen
      if (top + tooltipHeight > window.innerHeight) {
        // Try top
        top = rect.top - tooltipHeight - padding
        arrow = 'bottom'
      }
    } else if (position === 'top') {
      top = rect.top - tooltipHeight - padding
      left = rect.left + rect.width / 2 - tooltipWidth / 2
      arrow = 'bottom'
    } else if (position === 'left') {
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      left = rect.left - tooltipWidth - padding
      arrow = 'right'
    } else if (position === 'right') {
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      left = rect.right + padding
      arrow = 'left'
    }

    // Keep tooltip on screen
    if (left < padding) left = padding
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding
    }
    if (top < padding) top = padding

    return { top, left, arrow }
  }, [])

  useEffect(() => {
    if (!isVisible) return

    const updatePosition = () => {
      const step = TOOLTIP_STEPS[currentStep]
      const position = calculatePosition(step)
      
      if (position) {
        setTooltipPosition({ top: position.top, left: position.left })
        setArrowPosition(position.arrow)
      } else {
        // Element not found, skip to next step
        handleNext()
      }
    }

    updatePosition()

    // Update position on scroll/resize
    window.addEventListener('scroll', updatePosition)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [currentStep, isVisible, calculatePosition])

  const handleNext = () => {
    if (currentStep < TOOLTIP_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = () => {
    setIsVisible(false)
    localStorage.setItem('radpal_onboarding_completed', 'true')
    onComplete?.()
  }

  if (!isVisible) return null

  const currentStepData = TOOLTIP_STEPS[currentStep]
  const targetElement = document.querySelector(currentStepData.targetSelector) as HTMLElement

  return createPortal(
    <>
      {/* Backdrop with highlight */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          pointerEvents: 'auto'
        }}
        onClick={handleSkip}
      />

      {/* Highlight box */}
      {targetElement && (
        <div
          style={{
            position: 'fixed',
            top: targetElement.getBoundingClientRect().top - (currentStepData.highlightPadding || 5),
            left: targetElement.getBoundingClientRect().left - (currentStepData.highlightPadding || 5),
            width: targetElement.getBoundingClientRect().width + (currentStepData.highlightPadding || 5) * 2,
            height: targetElement.getBoundingClientRect().height + (currentStepData.highlightPadding || 5) * 2,
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'all 0.3s ease'
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: 320,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          zIndex: 10000,
          padding: '20px',
          transition: 'all 0.3s ease',
          border: '1px solid #e0e0e0'
        }}
      >
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            ...(arrowPosition === 'top' && {
              top: -10,
              left: '50%',
              marginLeft: -10,
              borderWidth: '0 10px 10px 10px',
              borderColor: 'transparent transparent white transparent'
            }),
            ...(arrowPosition === 'bottom' && {
              bottom: -10,
              left: '50%',
              marginLeft: -10,
              borderWidth: '10px 10px 0 10px',
              borderColor: 'white transparent transparent transparent'
            }),
            ...(arrowPosition === 'left' && {
              left: -10,
              top: '50%',
              marginTop: -10,
              borderWidth: '10px 10px 10px 0',
              borderColor: 'transparent white transparent transparent'
            }),
            ...(arrowPosition === 'right' && {
              right: -10,
              top: '50%',
              marginTop: -10,
              borderWidth: '10px 0 10px 10px',
              borderColor: 'transparent transparent transparent white'
            })
          }}
        />

        {/* Progress indicator */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {TOOLTIP_STEPS.map((_, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: '3px',
                  backgroundColor: index <= currentStep ? '#4CAF50' : '#e0e0e0',
                  borderRadius: '2px',
                  transition: 'background-color 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <h3 style={{
          margin: '0 0 10px 0',
          fontSize: '18px',
          fontWeight: 600,
          color: '#333'
        }}>
          {currentStepData.title}
        </h3>
        
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#666'
        }}>
          {currentStepData.content}
        </p>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            Skip tour
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e8e8e8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              >
                Previous
              </button>
            )}
            
            <button
              onClick={handleNext}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#45a049'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#4CAF50'}
            >
              {currentStep === TOOLTIP_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// Hook to reset onboarding (useful for testing or help menu)
export const useResetOnboarding = () => {
  const resetOnboarding = () => {
    localStorage.removeItem('radpal_onboarding_completed')
    window.location.reload()
  }
  
  return resetOnboarding
}