import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useUndoRedo } from './hooks/useUndoRedoFixed'
import { useAuth } from './hooks/useAuth'
import { useGpt } from './hooks/useGpt'
import { useAgentReport } from './hooks/useAgentReport'
import { mapRadPalModelToAgent } from '../agent/modelMapping'
import { useSupabaseTemplatesWithOffline } from './hooks/useSupabaseTemplatesWithOffline'
import { useWindowResize } from './hooks/useWindowResize'
import { useStyles } from './hooks/useStyles'
import LoginPanel from './components/LoginPanel'
import UpdateChecker from './components/UpdateChecker'
import DictationModal from './components/DictationModal'
import { supabase } from './lib/supabase'
import ShortcutManager from './components/ShortcutManager'
import { offlineStorage } from './services/offlineStorage'
import LogicEditorChat from './components/LogicEditorChat'
import LogicEditorDirect from './components/LogicEditorDirect'
import LogicEditorV3 from './components/LogicEditorV3'
import BlurCard from './components/BlurCard'
import DragTextEditor from './components/DragTextEditor'
import AskAI from './components/AskAI'
import AIRefinement from './components/AIRefinement'
import RichTextEditor, { RichTextEditorHandle } from './components/RichTextEditorSimple'
import { buttonStyles, layoutStyles } from './utils/styleConstants'
import { debounce } from './utils/debounce'
import { localStorageCache } from './utils/localStorage'
import { diffWordsWithSpace } from 'diff'
import { insertDictationAtCaret, FindingsEditorHandle } from './utils/dictationUtils'
import { getDictationHotkey, parseHotkey, matchesHotkey } from './utils/hotkeyUtils'
import { detectMacroCommand, executeMacro, insertMacroText, getCaretPosition, getCurrentScope } from './utils/macroUtils'
import { macroStore } from './stores/macroStore'
import { MacroPicklist } from './components/MacroPicklist'
import { MacroManager } from './components/MacroManager'
import type { MacroSettings } from './types/macro'
import { DEFAULT_MACRO_SETTINGS } from './types/macro'
import { loadMacroSettings, saveMacroSettings } from './utils/macroSettings'
import styles from './App.module.css'


export default React.memo(function App() {
  // Only log on mount, not every render
  useEffect(() => {
    console.log('🚀 MAIN APP MOUNTED - App component mounted successfully! VERSION: 2024-08-18-2035-AI-REFINEMENT-FIX');
    
    // Add pulse animation CSS if not already present
    if (!document.getElementById('llama-pulse-animation')) {
      const style = document.createElement('style');
      style.id = 'llama-pulse-animation';
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  const { width: windowWidth, isContracted } = useWindowResize();
  const styles = useStyles();

  // Replace simple findings state with undo/redo capable state
  // Temporarily use direct state to debug the issue
  const [findings, setFindingsState] = useState('')
  const setFindingsWithHistory = useCallback((value: string | ((prev: string) => string), saveToHistory?: boolean) => {
    console.log('🎯 Direct setFindings called with:', {
      valueType: typeof value,
      valueLength: typeof value === 'string' ? value.length : 'function',
      saveToHistory
    })
    setFindingsState(value)
  }, [])
  const undoFindings = () => {}
  const redoFindings = () => {}
  const canUndo = false
  const canRedo = false
  const saveFindingsCheckpoint = () => {}
  
  // Log findings changes
  useEffect(() => {
    console.log('📊 FINDINGS STATE CHANGED:', {
      length: findings.length,
      preview: findings.substring(0, 100),
      timestamp: Date.now(),
      stackTrace: new Error().stack
    })
  }, [findings])
  
  // Wrapper to maintain backward compatibility
  const setFindings = useCallback((value: string | ((prev: string) => string), saveToHistory: boolean = true) => {
    console.log('🎯 setFindings wrapper called - BYPASSING AND CALLING DIRECTLY:', {
      isFunction: typeof value === 'function',
      saveToHistory,
      valueLength: typeof value === 'string' ? value.length : 'function',
      actualValue: typeof value === 'string' ? value.substring(0, 100) : 'function'
    });
    
    // BYPASS EVERYTHING AND DIRECTLY CALL THE SETTER
    setFindingsWithHistory(value, saveToHistory);
  }, [setFindingsWithHistory]) // Remove findings from dependencies
  const findingsTextareaRef = useRef<HTMLTextAreaElement>(null)
  const richTextEditorRef = useRef<RichTextEditorHandle>(null)
  const lastSuggestionTimeRef = useRef<number>(0)
  const findingsEditorRef = useRef<FindingsEditorHandle>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [dictationError, setDictationError] = useState<string | null>(null)
  const [picklistState, setPicklistState] = useState<{ options: string[]; position: { x: number; y: number } } | null>(null)
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(() => loadMacroSettings())
  const [showMacroManager, setShowMacroManager] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [hardwareMicEnabled, setHardwareMicEnabled] = useState(() => {
    // Default to disabled (false) to prevent conflicts with PowerScribe
    const saved = localStorage.getItem('radpal_hardware_mic_enabled')
    // Only enable if explicitly set to 'true', otherwise default to false
    return saved === 'true'
  })
  
  // Hardware mic callbacks moved after showNotification declaration
  
  // Web Audio API refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioNodesRef = useRef<{ workletNode?: AudioWorkletNode, scriptProcessor?: ScriptProcessorNode, source?: MediaStreamAudioSourceNode }>({})  
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const autoCleanupEnabled = true // Always enabled
  const [isAutoCleaningUp, setIsAutoCleaningUp] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  // Temporarily use useAuth directly to bypass useAuthWithOffline hook chain issues
  const { user, signOut, loading: authLoading } = useAuth()
  // Offline mode state
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    const saved = localStorage.getItem('radpal_offline_mode')
    return saved === 'true'
  })
  const lastSyncTime = offlineStorage.getLastSync()
  
  // console.log('🔥 App using useAuth directly - user:', user ? `${user.email} (${user.id})` : 'null', 'authLoading:', authLoading);

  // Show notification without stealing focus
  const showNotification = useCallback((message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000) // Auto-hide after 3 seconds
  }, [])

  // Toggle hardware microphone integration
  const toggleHardwareMic = useCallback(() => {
    const newValue = !hardwareMicEnabled
    setHardwareMicEnabled(newValue)
    localStorage.setItem('radpal_hardware_mic_enabled', newValue.toString())
    
    if (newValue) {
      showNotification('✅ SpeedMic III hardware button enabled - may conflict with PowerScribe')
    } else {
      showNotification('✅ SpeedMic III hardware button disabled - no PowerScribe conflicts')
    }
  }, [hardwareMicEnabled, showNotification])

  // Show initial hardware mic info on first load
  useEffect(() => {
    const hasShownHardwareMicInfo = localStorage.getItem('radpal_shown_hardware_mic_info')
    if (!hasShownHardwareMicInfo && !hardwareMicEnabled) {
      setTimeout(() => {
        showNotification('💡 SpeedMic III hardware button is disabled by default to prevent PowerScribe conflicts. Click 🔗⛔ to enable if needed.')
        localStorage.setItem('radpal_shown_hardware_mic_info', 'true')
      }, 3000) // Show after 3 seconds
    }
  }, [hardwareMicEnabled, showNotification])
  const [selectedDictation, setSelectedDictation] = useState(() => localStorageCache.getItem('dictationTarget') || 'PowerScribe')
  const [showDictationModal, setShowDictationModal] = useState(false)
  const [showShortcutManager, setShowShortcutManager] = useState(false)
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false)

  // Hook declarations - templates hook must be declared before useEffect hooks that use refetchTemplates
  const {
    templates = {},
    loading: templatesLoading = false,
    saveTemplate = async () => {},
    refetchTemplates = async () => {}
  } = useSupabaseTemplatesWithOffline(user, true, isOfflineMode) || {}
  const [showLogicEditor, setShowLogicEditor] = useState(false)
  const [showOfflineDataViewer, setShowOfflineDataViewer] = useState(false)
  const [showTokenTooltip, setShowTokenTooltip] = useState(false)
  const [apiProvider, setApiProvider] = useState<'openai' | 'claude-sonnet' | 'claude-opus' | 'claude-opus-4.1' | 'gemini' | 'kimi' | 'gpt-5' | 'mistral-local'>('openai') // Default to GPT-4o
  const [llamaServerStatus, setLlamaServerStatus] = useState<{ running: boolean; error?: string; external?: boolean }>({ running: false })
  const [modelDownloadStatus, setModelDownloadStatus] = useState<{
    downloading: boolean;
    progress: number;
    bytesDownloaded?: number;
    bytesTotal?: number;
    status?: string;
    error?: string;
    complete?: boolean;
  }>({ downloading: false, progress: 0 })
  const [cudaInstallStatus, setCudaInstallStatus] = useState<{
    installing: boolean;
    progress: number;
    status?: string;
    error?: string;
  }>({ installing: false, progress: 0 })
  const [hasCudaSupport, setHasCudaSupport] = useState<boolean>(false)
  const [userTier, setUserTier] = useState<number>(1) // Default to tier 1
  const [tokenUsage, setTokenUsage] = useState<{used: number, limit: number, percentage: number}>({
    used: 0,
    limit: 20000,  // Default to tier 1 limit
    percentage: 0
  })
  const [colorScheme, setColorScheme] = useState<'venice-blue' | 'dark-ocean' | 'lawrencium' | 'deep-space' | 'void-black' | 'yoda'>('void-black')
  const [selectedStudyType, setSelectedStudyType] = useState<string>('')
  const [suggestedStudyTypes, setSuggestedStudyTypes] = useState<Array<{type: string, confidence: number}>>([])
  const [suggestedStudyType, setSuggestedStudyType] = useState<string>('') // Keep for backward compatibility
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false)
  const [showStudyTypeDropdown, setShowStudyTypeDropdown] = useState(false)
  const [studyTypeFilter, setStudyTypeFilter] = useState<string>('')
  const [favoriteStudyTypes, setFavoriteStudyTypes] = useState<Set<string>>(new Set())
  
  // Integrated UI state for generation results
  const [generationResult, setGenerationResult] = useState<{
    type: 'report' | 'impression' | null
    originalFindings: string
    generatedText: string
    generationTime: string
    tokens: { input: number, output: number, total: number }
    templateText?: string
    showDiff?: boolean
    diffParts?: any[] // Pre-calculated diff parts to avoid recalculation
  } | null>(null)
  const [showDiffView, setShowDiffView] = useState(false)
  const [showAskAI, setShowAskAI] = useState(false)
  const [showAIRefinement, setShowAIRefinement] = useState(false)
  const [updateCheckComplete, setUpdateCheckComplete] = useState(false)

  // Load favorite study types from localStorage
  useEffect(() => {
    const savedFavorites = localStorageCache.getItem('favoriteStudyTypes')
    if (savedFavorites) {
      try {
        setFavoriteStudyTypes(new Set(JSON.parse(savedFavorites)))
      } catch (e) {
        console.error('Failed to parse favorite study types:', e)
      }
    }
  }, [])

  // Save favorite study types to localStorage
  const toggleFavoriteStudyType = (studyType: string) => {
    setFavoriteStudyTypes(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(studyType)) {
        newFavorites.delete(studyType)
      } else {
        newFavorites.add(studyType)
      }
      localStorageCache.setItem('favoriteStudyTypes', JSON.stringify(Array.from(newFavorites)))
      return newFavorites
    })
  }

  // Load API provider preference
  useEffect(() => {
    if (window.electronAPI?.getApiProvider) {
      window.electronAPI.getApiProvider().then(provider => {
        setApiProvider(provider);
      });
    }
  }, []);
  
  // Debug log for download status
  useEffect(() => {
    console.log('🔍 modelDownloadStatus changed:', modelDownloadStatus);
    console.log('🔍 Should show modal?', modelDownloadStatus.downloading === true);
  }, [modelDownloadStatus]);

  // Listen for llama server status updates
  useEffect(() => {
    // Use the safe electronAPI methods instead of raw ipcRenderer
    if (window.electronAPI?.onLlamaServerStatus && window.electronAPI?.onModelDownloadStatus) {
      const unsubscribeServer = window.electronAPI.onLlamaServerStatus((status: { running: boolean; error?: string; external?: boolean }) => {
        console.log('llama.cpp server status:', status);
        setLlamaServerStatus(status);
      });
      
      const unsubscribeDownload = window.electronAPI.onModelDownloadStatus((status: any) => {
        console.log('📥 Model download status received:', status);
        console.log('📥 Setting modelDownloadStatus.downloading to:', status.downloading);
        setModelDownloadStatus(status);
      });
      
      // Listen for CUDA installation progress
      const unsubscribeCuda = window.electronAPI.onCudaInstallProgress ? 
        window.electronAPI.onCudaInstallProgress((progress: any) => {
          console.log('🎮 CUDA install progress:', progress);
          setCudaInstallStatus({
            installing: progress.progress < 100 && !progress.error,
            progress: progress.progress,
            status: progress.status,
            error: progress.error
          });
        }) : null;
      
      // Check initial status
      if (window.electronAPI?.getLlamaServerStatus) {
        window.electronAPI.getLlamaServerStatus().then((status: any) => {
          setLlamaServerStatus(status);
        }).catch(console.error);
      }
      
      // Check CUDA support
      if (window.electronAPI?.checkCudaSupport) {
        window.electronAPI.checkCudaSupport().then((hasCuda: boolean) => {
          setHasCudaSupport(hasCuda);
        }).catch(console.error);
      }
      
      return () => {
        if (unsubscribeServer) unsubscribeServer();
        if (unsubscribeDownload) unsubscribeDownload();
        if (unsubscribeCuda) unsubscribeCuda();
      };
    } else {
      console.log('Llama server status methods not available in electronAPI');
    }
  }, []);

  // Listen for llama.cpp installation prompts
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleLlamaNotInstalled = (data: { message: string; downloadUrl: string }) => {
      console.log('🚫 Llama.cpp not installed:', data);
      const userConfirmed = window.confirm(data.message);
      if (userConfirmed) {
        // Trigger CUDA binary installation
        if (window.electronAPI?.installCudaBinary) {
          setCudaInstallStatus({
            installing: true,
            progress: 0,
            status: 'Starting download...',
            error: false
          });
          window.electronAPI.installCudaBinary(data.downloadUrl).then((success: boolean) => {
            if (success) {
              showNotification('✅ Llama.cpp installed successfully!');
              // The server should auto-start after installation
            } else {
              showNotification('❌ Failed to install llama.cpp');
            }
            setCudaInstallStatus({
              installing: false,
              progress: 0,
              status: '',
              error: !success
            });
          }).catch((error: any) => {
            console.error('Failed to install llama.cpp:', error);
            showNotification('❌ Failed to install llama.cpp');
            setCudaInstallStatus({
              installing: false,
              progress: 0,
              status: '',
              error: true
            });
          });
        }
      }
    };

    const handleLlamaUpdateAvailable = (data: { currentVersion: string; downloadUrl: string }) => {
      console.log('🔄 Llama.cpp update available:', data);
      const message = `A newer version of llama.cpp (${data.currentVersion}) is available. Update for better performance?`;
      const userConfirmed = window.confirm(message);
      if (userConfirmed) {
        // Trigger CUDA binary installation with the new version
        if (window.electronAPI?.installCudaBinary) {
          setCudaInstallStatus({
            installing: true,
            progress: 0,
            status: 'Downloading update...',
            error: false
          });
          window.electronAPI.installCudaBinary(data.downloadUrl).then((success: boolean) => {
            if (success) {
              showNotification('✅ Llama.cpp updated successfully!');
              // The server should auto-restart after update
            } else {
              showNotification('❌ Failed to update llama.cpp');
            }
            setCudaInstallStatus({
              installing: false,
              progress: 0,
              status: '',
              error: !success
            });
          }).catch((error: any) => {
            console.error('Failed to update llama.cpp:', error);
            showNotification('❌ Failed to update llama.cpp');
            setCudaInstallStatus({
              installing: false,
              progress: 0,
              status: '',
              error: true
            });
          });
        }
      }
    };

    // Register event listeners
    const unsubscribeNotInstalled = window.electronAPI.onLlamaNotInstalled?.(handleLlamaNotInstalled);
    const unsubscribeUpdateAvailable = window.electronAPI.onLlamaUpdateAvailable?.(handleLlamaUpdateAvailable);

    return () => {
      unsubscribeNotInstalled?.();
      unsubscribeUpdateAvailable?.();
    };
  }, [showNotification]);

  // Auto-cleanup is always enabled - no need to load preference

  // Load color scheme preference
  useEffect(() => {
    const savedScheme = localStorageCache.getItem('colorScheme') as 'venice-blue' | 'dark-ocean' | 'lawrencium' | 'deep-space' | 'void-black' | 'yoda';
    if (savedScheme && (savedScheme === 'venice-blue' || savedScheme === 'dark-ocean' || savedScheme === 'lawrencium' || savedScheme === 'deep-space' || savedScheme === 'void-black' || savedScheme === 'yoda')) {
      setColorScheme(savedScheme);
    }
  }, []);

  // Apply color scheme to body class
  useEffect(() => {
    // Remove any existing color scheme classes
    document.body.className = document.body.className.replace(/color-scheme-[\w-]+/g, '');
    // Add the current color scheme class
    document.body.classList.add(`color-scheme-${colorScheme}`);
  }, [colorScheme]);



  // Close settings sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettingsSidebar) {
        const target = event.target as Element
        const sidebarElement = document.querySelector('.settings-sidebar')
        const triggerElement = document.querySelector('[data-settings-trigger]')
        if (sidebarElement && !sidebarElement.contains(target) && 
            triggerElement && !triggerElement.contains(target)) {
          setShowSettingsSidebar(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettingsSidebar])

  // Load token usage on startup and when user changes
  useEffect(() => {
    if (window.electronAPI?.getTokenUsage) {
      window.electronAPI.getTokenUsage().then(usage => {
        setTokenUsage(usage);
      });

      // Listen for token usage updates
      const handleTokenUpdate = (usage) => {
        setTokenUsage(usage);
      };

      window.electronAPI.onTokenUsageUpdated?.(handleTokenUpdate);
    }
  }, []);

  // Reload token usage and tier when user authentication state changes
  useEffect(() => {
    if (user && window.electronAPI) {
      // Small delay to ensure user session is fully established
      setTimeout(async () => {
        // Fetch token usage
        if (window.electronAPI.getTokenUsage) {
          const usage = await window.electronAPI.getTokenUsage();
          console.log('🔄 Refreshing token usage after user login:', usage);
          setTokenUsage(usage);
        }
        
        // Fetch user tier
        if (window.electronAPI.getUserTier && user.id) {
          const tier = await window.electronAPI.getUserTier(user.id);
          console.log('🎯 User subscription tier:', tier);
          setUserTier(tier || 1);
        }
      }, 1000);
    }
  }, [user]);


  // Model tier mapping
  const modelTiers = {
    // Tier 1 models (available to all)
    'gemini': 1,
    'kimi': 1,
    
    // Tier 2 models
    'openai': 2,      // GPT-4o
    'gpt-5': 2,
    'claude-sonnet': 2,
    
    // Tier 3 models (premium)
    'claude-opus': 3,
    'claude-opus-4.1': 3,
    
    // Tier 4 models (developer only)
    'mistral-local': 4
  };
  
  // Check if a model is available based on user tier
  const isModelAvailable = (modelKey: string): boolean => {
    const requiredTier = modelTiers[modelKey] || 3;
    return userTier >= requiredTier;
  };
  
  // Get tier label for display
  const getTierLabel = (tier: number): string => {
    switch(tier) {
      case 1: return 'Free';
      case 2: return 'Pro';
      case 3: return 'Premium';
      case 4: return 'Developer';
      default: return 'Free';
    }
  };

  // Handle API provider change
  const handleApiProviderChange = async (provider: 'openai' | 'claude-sonnet' | 'claude-opus' | 'claude-opus-4.1' | 'gemini' | 'kimi' | 'gpt-5' | 'mistral-local') => {
    // Check if user has access to this model
    if (!isModelAvailable(provider)) {
      const requiredTier = modelTiers[provider] || 3;
      const message = `🔒 ${getTierLabel(requiredTier)} subscription required (Tier ${requiredTier}). You're on ${getTierLabel(userTier)}.`;
      showNotification(message);
      
      // Optional: Restore focus to the findings editor after a short delay
      setTimeout(() => {
        const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
        if (editor) {
          editor.focus();
        }
      }, 100);
      
      return;
    }
    
    setApiProvider(provider);
    if (window.electronAPI?.setApiProvider) {
      await window.electronAPI.setApiProvider(provider as any);
    }
  };

  // Handle color scheme toggle
  const handleColorSchemeToggle = () => {
    let nextScheme: 'venice-blue' | 'dark-ocean' | 'lawrencium' | 'deep-space' | 'void-black' | 'yoda';
    if (colorScheme === 'venice-blue') {
      nextScheme = 'dark-ocean';
    } else if (colorScheme === 'dark-ocean') {
      nextScheme = 'lawrencium';
    } else if (colorScheme === 'lawrencium') {
      nextScheme = 'deep-space';
    } else if (colorScheme === 'deep-space') {
      nextScheme = 'void-black';
    } else if (colorScheme === 'void-black') {
      nextScheme = 'yoda';
    } else {
      nextScheme = 'venice-blue';
    }
    setColorScheme(nextScheme);
    localStorageCache.setItem('colorScheme', nextScheme);
  };

  // Window control functions
  const handleContract = () => {
    // console.log('Contract button clicked');
    if (window.electronAPI?.contractWindow) {
      window.electronAPI.contractWindow();
    } else {
      console.error('Electron IPC not available');
    }
  }


  const handleMinimize = () => {
    window.electronAPI?.minimizePopup?.()
  }

  const handleClose = () => {
    window.electronAPI?.closePopup?.()
  }

  const handleExpand = () => {
    window.electronAPI?.expandWindow?.()
  }

  // Dictation functions
  const handleDictationToggle = useCallback(async () => {
    if (isRecording) {
      // Stop dictation
      setIsRecording(false)
      setDictationError(null)
      if (window.electronAPI?.stopDictation) {
        try {
          await window.electronAPI.stopDictation()
        } catch (error) {
          console.error('Failed to stop dictation:', error)
        }
      }
    } else {
      // Start dictation
      setDictationError(null)
      if (window.electronAPI?.startDictation) {
        try {
          const result = await window.electronAPI.startDictation()
          if (result.success) {
            setIsRecording(true)
          } else {
            setDictationError(result.error || 'Failed to start dictation')
          }
        } catch (error) {
          setDictationError('Failed to start dictation: ' + (error as Error).message)
        }
      }
    }
  }, [isRecording])

  // Web Audio API functions
  const startAudioCapture = useCallback(async () => {
    try {
      console.log('🎤 Starting Web Audio API capture...')
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      })
      streamRef.current = stream
      
      // Create AudioContext for processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })
      audioContextRef.current = audioContext
      
      // Create MediaStreamAudioSourceNode
      const source = audioContext.createMediaStreamSource(stream)
      audioNodesRef.current.source = source
      
      // Try AudioWorklet first, fall back to ScriptProcessor if it fails
      try {
        // Load AudioWorklet processor
        const workletPath = '/audio-worklet-processor.js'
        await audioContext.audioWorklet.addModule(workletPath)
        
        // Create AudioWorkletNode to capture raw audio data
        const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor')
        audioNodesRef.current.workletNode = audioWorkletNode
        
        // Listen for audio data from the worklet
        audioWorkletNode.port.onmessage = (event) => {
          if (event.data.type === 'audioData') {
            // Send to main process with error handling
            try {
              window.electronAPI?.sendAudioData?.(event.data.buffer)
            } catch (error) {
              console.error('Failed to send audio data:', error)
              // Trigger a connection refresh if audio sending fails repeatedly
              window.electronAPI?.sendAudioError?.('Audio data transmission failed')
            }
          }
        }
        
        // Connect the nodes
        source.connect(audioWorkletNode)
        console.log('✅ Using modern AudioWorkletNode')
        
      } catch (workletError) {
        console.warn('AudioWorklet failed, falling back to ScriptProcessor:', workletError)
        
        // Fallback to ScriptProcessorNode
        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
        audioNodesRef.current.scriptProcessor = scriptProcessor
        
        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputBuffer = audioProcessingEvent.inputBuffer
          const inputData = inputBuffer.getChannelData(0)
          
          // Convert Float32 to Int16 for Deepgram
          const int16Array = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767))
          }
          
          // Send to main process with error handling
          try {
            window.electronAPI?.sendAudioData?.(int16Array.buffer)
          } catch (error) {
            console.error('Failed to send audio data via ScriptProcessor:', error)
            window.electronAPI?.sendAudioError?.('Audio data transmission failed')
          }
        }
        
        // Connect the nodes
        source.connect(scriptProcessor)
        scriptProcessor.connect(audioContext.destination)
        console.log('✅ Using fallback ScriptProcessorNode')
      }
      
      console.log('✅ Web Audio API capture started')
      
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error)
      window.electronAPI?.sendAudioError?.(error.message)
    }
  }, [])

  const stopAudioCapture = useCallback(async () => {
    try {
      console.log('🛑 Stopping Web Audio API capture...')
      
      // Disconnect and clean up audio nodes first
      if (audioNodesRef.current.workletNode) {
        try {
          audioNodesRef.current.workletNode.port.onmessage = null
          audioNodesRef.current.workletNode.port.close()
          audioNodesRef.current.workletNode.disconnect()
          audioNodesRef.current.workletNode = undefined
        } catch (error) {
          console.error('Error disconnecting AudioWorkletNode:', error)
        }
      }
      
      if (audioNodesRef.current.scriptProcessor) {
        try {
          audioNodesRef.current.scriptProcessor.onaudioprocess = null
          audioNodesRef.current.scriptProcessor.disconnect()
          audioNodesRef.current.scriptProcessor = undefined
        } catch (error) {
          console.error('Error disconnecting ScriptProcessorNode:', error)
        }
      }
      
      if (audioNodesRef.current.source) {
        try {
          audioNodesRef.current.source.disconnect()
          audioNodesRef.current.source = undefined
        } catch (error) {
          console.error('Error disconnecting MediaStreamAudioSourceNode:', error)
        }
      }
      
      // Stop the media stream completely
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop()
            track.enabled = false
            track.onended = null
          } catch (e) {
            console.log('Track stop error:', e)
          }
        })
        streamRef.current = null
      }
      
      // Close AudioContext with state check
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close()
          }
        } catch (error) {
          console.error('Error closing AudioContext:', error)
        }
        audioContextRef.current = null
      }
      
      // Clear all node references
      audioNodesRef.current = {}
      
      console.log('✅ Web Audio API capture stopped and cleaned up')
      
    } catch (error) {
      console.error('❌ Error stopping audio capture:', error)
    }
  }, [])

  // Reset microphone system completely (fixes accuracy issues)
  const resetMicrophone = useCallback(async () => {
    console.log('🔄 Resetting microphone system...')
    
    // Stop current recording if active
    if (isRecording) {
      setIsRecording(false)
    }
    
    // Clear any dictation errors
    setDictationError(null)
    setCleanupError(null)
    
    // Force stop all audio capture with extra cleanup
    await stopAudioCapture()
    
    // Additional browser-level cleanup
    try {
      // Get all media devices and revoke permissions temporarily
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      console.log(`Found ${audioInputs.length} audio input devices to reset`)
      
      // Clear any cached media streams
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Request and immediately stop a new stream to reset the device
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false 
            } 
          })
          tempStream.getTracks().forEach(track => {
            track.stop()
            track.enabled = false
          })
          console.log('✅ Temporary stream created and stopped to reset device')
        } catch (e) {
          console.log('Could not create temp stream:', e)
        }
      }
    } catch (error) {
      console.error('Browser-level cleanup error:', error)
    }
    
    // Force reset the entire dictation system
    if (window.electronAPI?.forceResetDictation) {
      try {
        console.log('🔧 Performing deep dictation system reset...')
        const result = await window.electronAPI.forceResetDictation()
        if (result.success) {
          console.log('✅ Deep dictation reset completed successfully')
        } else {
          console.error('❌ Deep dictation reset failed:', result.error)
        }
      } catch (error) {
        console.error('❌ Failed to perform deep dictation reset:', error)
      }
    }
    
    // Stop system dictation (fallback)
    if (window.electronAPI?.stopDictation) {
      try {
        await window.electronAPI.stopDictation()
      } catch (error) {
        console.error('Failed to stop dictation during reset:', error)
      }
    }
    
    // Wait longer for complete cleanup
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Reset all audio context and node references
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
        audioContextRef.current = null
      } catch (error) {
        console.error('Error closing AudioContext during reset:', error)
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
        mediaRecorderRef.current = null
      } catch (error) {
        console.error('Error stopping MediaRecorder during reset:', error)
      }
    }
    
    // Clear all audio node references
    audioNodesRef.current = {}
    
    // Show notification
    showNotification('🎤 Microphone system fully reset - accuracy restored')
    
    console.log('✅ Microphone reset complete')
  }, [isRecording, stopAudioCapture])

  // Listen for audio capture commands from main process
  useEffect(() => {
    const unsubscribes: Array<() => void> = []
    
    if (window.electronAPI?.onStartAudioCapture) {
      const unsubscribeStart = window.electronAPI.onStartAudioCapture(() => {
        console.log('📡 Received start-audio-capture from main process')
        startAudioCapture()
      })
      unsubscribes.push(unsubscribeStart)
    }
    
    if (window.electronAPI?.onStopAudioCapture) {
      const unsubscribeStop = window.electronAPI.onStopAudioCapture(() => {
        console.log('📡 Received stop-audio-capture from main process')
        stopAudioCapture()
      })
      unsubscribes.push(unsubscribeStop)
    }
    
    // Listen for reset audio system signal
    if (window.electronAPI?.onResetAudioSystem) {
      const unsubscribeReset = window.electronAPI.onResetAudioSystem(async () => {
        console.log('📡 Received reset-audio-system from main process')
        await stopAudioCapture()
        // Force cleanup all audio references
        audioNodesRef.current = {}
        streamRef.current = null
        audioContextRef.current = null
      })
      unsubscribes.push(unsubscribeReset)
    }
    
    // Listen for critical audio errors
    if (window.electronAPI?.onCriticalAudioError) {
      const unsubscribeCritical = window.electronAPI.onCriticalAudioError((error: string) => {
        console.error('🚨 Critical audio error:', error)
        setDictationError(`Critical error: ${error}. Please use Reset Microphone button.`)
        setIsRecording(false)
        stopAudioCapture()
      })
      unsubscribes.push(unsubscribeCritical)
    }
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
    }
  }, [startAudioCapture, stopAudioCapture])

  // Create the insertDictation function with voice command and macro support
  const insertDictation = useCallback(async (rawText: string) => {
    // Check for macro command first
    const macroDetection = detectMacroCommand(rawText, macroSettings);
    
    if (macroDetection.isMacro && macroDetection.macroName) {
      // Get the current element - prioritize rich text editor
      let element: HTMLTextAreaElement | HTMLElement | null = null;
      
      if (richTextEditorRef.current) {
        element = richTextEditorRef.current.getElement();
      }
      
      if (!element) {
        element = findingsTextareaRef.current;
      }
      
      if (!element) {
        const contentEditables = document.querySelectorAll('[contenteditable="true"]');
        for (const el of contentEditables) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.width === '100%' && htmlEl.style.height === '100%') {
            element = htmlEl;
            break;
          }
        }
      }
      
      if (!element) return;
      
      // Insert any remaining text before the macro command
      if (macroDetection.remainingText) {
        insertMacroText(element, macroDetection.remainingText);
      }
      
      // Execute the macro
      const scope = getCurrentScope();
      const result = await executeMacro(macroDetection.macroName, scope);
      
      if (result.success && result.macro) {
        if (result.macro.type === 'text' && result.macro.valueText) {
          // Insert text macro directly
          insertMacroText(element, result.macro.valueText);
          element.focus();
        } else if (result.macro.type === 'picklist' && result.macro.options) {
          // Show picklist dropdown
          const position = getCaretPosition(element);
          if (position) {
            setPicklistState({
              options: result.macro.options,
              position
            });
          }
        }
      } else {
        // Macro not found - show toast
        console.warn('Macro not found:', macroDetection.macroName);
        // You could add a toast notification here
        if (!macroSettings.insertLiteralOnNotFound) {
          return; // Don't insert the literal text
        }
      }
      
      return; // Exit early for macro commands
    }
    
    // Pre-check: If the backend has normalized this to "delete that", handle it immediately
    // This catches cases where backend preprocessing identified a delete command
    if (rawText.trim().toLowerCase() === 'delete that') {
      // Process as delete command
      let element: HTMLTextAreaElement | HTMLElement | null = null;
      
      if (richTextEditorRef.current) {
        element = richTextEditorRef.current.getElement();
      }
      
      if (!element) {
        element = findingsTextareaRef.current;
      }
      
      if (!element) {
        const contentEditables = document.querySelectorAll('[contenteditable="true"]');
        for (const el of contentEditables) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.width === '100%' && htmlEl.style.height === '100%') {
            element = htmlEl;
            break;
          }
        }
      }
      if (element) {
        const result = insertDictationAtCaret(element, rawText);
        if (result.commandExecuted === 'delete') {
          // Command was executed, don't insert text
          return;
        }
      }
    }
    
    // First try the rich text editor
    if (richTextEditorRef.current) {
      console.log('🎤 insertDictation: Before inserting, current findings from ref:', {
        currentHtml: richTextEditorRef.current.getValue(),
        currentHtmlLength: richTextEditorRef.current.getValue().length
      });
      
      // Just call insertDictation - it will trigger onChange which updates the state
      richTextEditorRef.current.insertDictation(rawText);
      
      // Log the updated value immediately after insertion
      const afterHtml = richTextEditorRef.current.getValue();
      const afterPlainText = richTextEditorRef.current.getPlainText();
      console.log('🎤 insertDictation: After inserting, new HTML from ref:', {
        newHtml: afterHtml,
        newHtmlLength: afterHtml.length,
        plainText: afterPlainText,
        plainTextLength: afterPlainText.length,
        preview: afterHtml.substring(0, 100)
      });
      
      // Force update the state if it's not updating
      if (afterHtml && afterHtml.length > 0) {
        setFindingsWithHistory(afterHtml, true);
      }
      
      return;
    }
    
    // Then try the textarea
    let element: HTMLTextAreaElement | HTMLElement | null = findingsTextareaRef.current;
    
    // If no textarea (likely showing diff view), find the contentEditable div
    if (!element) {
      const contentEditables = document.querySelectorAll('[contenteditable="true"]');
      // Find the one that contains the findings (not in a modal or popup)
      for (const el of contentEditables) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.width === '100%' && htmlEl.style.height === '100%') {
          element = htmlEl;
          break;
        }
      }
    }
    
    if (!element) return;
    
    // Check if we need to add a space before the new text (for chunk continuation)
    let textToInsert = rawText;
    if (element instanceof HTMLTextAreaElement) {
      const cursorPos = element.selectionStart;
      if (cursorPos > 0) {
        const prevChar = element.value[cursorPos - 1];
        const firstChar = rawText[0];
        
        // Smart spacing rules:
        // 1. Don't add space if new text already starts with space
        // 2. Don't add space if previous char is already a space
        // 3. Add space between alphanumeric and letter
        // 4. Don't add space if punctuation already has space after it
        if (prevChar && firstChar && firstChar !== ' ' && prevChar !== ' ') {
          if (/[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z]/.test(firstChar)) {
            textToInsert = ' ' + rawText;
          } else if (/[.,:;!?]/.test(prevChar) && /[a-zA-Z]/.test(firstChar)) {
            // Only add space after punctuation if the text doesn't already handle it
            textToInsert = ' ' + rawText;
          }
        }
        
        // Clean up any potential double spaces
        if (prevChar === ' ' && firstChar === ' ') {
          textToInsert = rawText.trimStart();
        }
      }
    } else if (element.isContentEditable) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          const text = container.textContent || '';
          const offset = range.startOffset;
          if (offset > 0) {
            const prevChar = text[offset - 1];
            const firstChar = rawText[0];
            
            // Smart spacing rules (same as textarea):
            // Don't add space if new text already starts with space or prev is space
            if (prevChar && firstChar && firstChar !== ' ' && prevChar !== ' ') {
              if (/[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z]/.test(firstChar)) {
                textToInsert = ' ' + rawText;
              } else if (/[.,:;!?]/.test(prevChar) && /[a-zA-Z]/.test(firstChar)) {
                textToInsert = ' ' + rawText;
              }
            }
            
            // Clean up any potential double spaces
            if (prevChar === ' ' && firstChar === ' ') {
              textToInsert = rawText.trimStart();
            }
          }
        }
      }
    }
    
    // Use the new voice command system that handles both commands and text insertion
    const result = insertDictationAtCaret(element, textToInsert)
    
    if (result.success) {
      // Update the findings state based on element type
      if (element instanceof HTMLTextAreaElement) {
        setFindings(element.value)
      } else if (element.isContentEditable) {
        setFindings(element.textContent || '')
      }
      
      // Focus the element - caret position is already set by the insertion function
      element.focus()
      
      // Show feedback for commands
      if (result.commandExecuted) {
        switch (result.commandExecuted) {
          case 'delete':
            // No notification for delete - it's obvious from the text disappearing
            break;
          case 'undo':
            showNotification('↶ Undo completed');
            // Update the findings state after undo with a small delay for execCommand to complete
            setTimeout(() => {
              if (element instanceof HTMLTextAreaElement) {
                setFindings(element.value);
              } else if (element && element.isContentEditable) {
                setFindings(element.textContent || '');
              }
            }, 50);
            break;
          case 'redo':
            showNotification('↷ Redo completed');
            // Update the findings state after redo with a small delay for execCommand to complete
            setTimeout(() => {
              if (element instanceof HTMLTextAreaElement) {
                setFindings(element.value);
              } else if (element && element.isContentEditable) {
                setFindings(element.textContent || '');
              }
            }, 50);
            break;
          case 'newParagraph':
            showNotification('¶ New paragraph created');
            break;
          case 'newLine':
            showNotification('↵ New line created');
            break;
        }
      }
    }
  }, [showNotification, macroSettings, setFindings, findings])
  
  // Update the editor handle ref whenever insertDictation changes
  useEffect(() => {
    findingsEditorRef.current = {
      insertDictation,
      getValue: () => findingsTextareaRef.current?.value || '',
      focus: () => findingsTextareaRef.current?.focus()
    }
  }, [insertDictation])
  
  // Listen for dictation text from main process
  useEffect(() => {
    if (window.electronAPI?.onDictationText) {
      const unsubscribe = window.electronAPI.onDictationText((text: string) => {
        console.log('🎙️ Received dictation text from main process:', text)
        // Save cursor position before inserting dictation
        if (richTextEditorRef.current) {
          richTextEditorRef.current.saveCursor()
        }
        insertDictation(text)
      })
      return unsubscribe
    }
  }, [insertDictation])

  // Listen for dictation errors
  useEffect(() => {
    if (window.electronAPI?.onDictationError) {
      const unsubscribe = window.electronAPI.onDictationError((error: string) => {
        console.error('Dictation error:', error)
        setIsRecording(false)
        setDictationError(error)
      })
      return unsubscribe
    }
  }, [])
  
  // Listen for Power Mic III events
  useEffect(() => {
    if (!window.electronAPI) return
    
    const unsubscribes: Array<() => void> = []
    
    // Power Mic III record button pressed
    if (window.electronAPI.onPowerMicRecordPressed) {
      unsubscribes.push(
        window.electronAPI.onPowerMicRecordPressed(() => {
          if (!hardwareMicEnabled) {
            console.log('🎤 Power Mic III: Hardware mic disabled, ignoring button press')
            return
          }
          console.log('🎤 Power Mic III: Record button pressed - triggering dictation')
          if (!isRecording) {
            handleDictationToggle()
          }
        })
      )
    }
    
    // Power Mic III record button released
    if (window.electronAPI.onPowerMicRecordReleased) {
      unsubscribes.push(
        window.electronAPI.onPowerMicRecordReleased(() => {
          if (!hardwareMicEnabled) {
            console.log('🎤 Power Mic III: Hardware mic disabled, ignoring button release')
            return
          }
          console.log('🎤 Power Mic III: Record button released - stopping dictation')
          // Stop dictation when PowerMic button is released (push-to-talk mode)
          if (isRecording) {
            handleDictationToggle()
          }
        })
      )
    }
    
    // Generic dictation toggle trigger
    if (window.electronAPI.onTriggerDictationToggle) {
      unsubscribes.push(
        window.electronAPI.onTriggerDictationToggle(() => {
          console.log('🎤 Dictation toggle triggered')
          handleDictationToggle()
        })
      )
    }
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
    }
  }, [handleDictationToggle, isRecording, hardwareMicEnabled])

  // Listen for cleanup results
  useEffect(() => {
    if (window.electronAPI?.onCleanupResult) {
      const unsubscribe = window.electronAPI.onCleanupResult((cleanedText: string) => {
        setFindings(cleanedText)
        setIsCleaningUp(false)
        setCleanupError(null)
      })
      return unsubscribe
    }
  }, [])

  // Listen for template updates from other windows
  useEffect(() => {
    if (!window.electronAPI?.onTemplatesUpdated) return

    const handleTemplatesUpdated = (data) => {
      console.log('🔄 Templates updated event received:', data)
      // Refresh templates if this is for the current user
      if (user && data.userId === user.id) {
        console.log('🔄 Refreshing templates for current user')
        refetchTemplates()
      }
    }

    const cleanup = window.electronAPI.onTemplatesUpdated(handleTemplatesUpdated)
    return cleanup
  }, [user, refetchTemplates])

  // Listen for cleanup errors
  useEffect(() => {
    if (window.electronAPI?.onCleanupError) {
      const unsubscribe = window.electronAPI.onCleanupError((error: string) => {
        console.error('Cleanup error:', error)
        setIsCleaningUp(false)
        setCleanupError(error)
      })
      return unsubscribe
    }
  }, [])

  // Listen for dictation chunk complete (for real-time auto-cleanup)
  useEffect(() => {
    if (window.electronAPI?.onDictationChunkComplete) {
      const unsubscribe = window.electronAPI.onDictationChunkComplete(async (chunkText: string) => {
        if (autoCleanupEnabled && chunkText && chunkText.trim().length > 0) {
          console.log('🔄 Processing chunk in real-time:', chunkText);
          setIsAutoCleaningUp(true);
          
          try {
            if (window.electronAPI?.autoCleanupText) {
              const result = await window.electronAPI.autoCleanupText(chunkText);
              if (result.success && result.cleanedText) {
                console.log('🧠 Chunk processed:', chunkText, '→', result.cleanedText);
                // The cleaned text will replace the raw text that was already added
                setFindings(prev => {
                  // Replace the last occurrence of the raw chunk with the cleaned version
                  const lastIndex = prev.lastIndexOf(chunkText.trim());
                  if (lastIndex !== -1) {
                    return prev.slice(0, lastIndex) + result.cleanedText + prev.slice(lastIndex + chunkText.trim().length);
                  }
                  // If not found, just append (shouldn't happen normally)
                  return prev + (prev ? ' ' : '') + result.cleanedText;
                });
              } else {
                console.warn('🧠 Chunk processing failed, keeping original');
              }
            }
          } catch (error) {
            console.error('🧠 Chunk processing error:', error);
          } finally {
            setIsAutoCleaningUp(false);
          }
        }
      });
      return unsubscribe;
    }
  }, [autoCleanupEnabled]);

  // Cleanup function
  const handleCleanupText = useCallback(async () => {
    if (!findings || findings.trim().length === 0) {
      setCleanupError('No text to clean up')
      return
    }

    if (isCleaningUp) {
      return // Already processing
    }

    try {
      setIsCleaningUp(true)
      setCleanupError(null)
      
      if (window.electronAPI?.cleanupText) {
        const result = await window.electronAPI.cleanupText(findings)
        if (!result.success) {
          setCleanupError(result.error || 'Failed to clean up text')
          setIsCleaningUp(false)
        }
        // Success is handled by the onCleanupResult listener
      } else {
        setCleanupError('Cleanup functionality not available')
        setIsCleaningUp(false)
      }
    } catch (error) {
      console.error('Failed to cleanup text:', error)
      setCleanupError('Failed to clean up text: ' + (error as Error).message)
      setIsCleaningUp(false)
    }
  }, [findings, isCleaningUp])

  // Auto-cleanup toggle removed - feature is always enabled

  // Configurable keyboard shortcut for dictation toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentHotkey = getDictationHotkey();
      const hotkeyConfig = parseHotkey(currentHotkey);
      
      if (matchesHotkey(event, hotkeyConfig)) {
        event.preventDefault();
        handleDictationToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDictationToggle]);

  // Backup and restore functions
  const handleBackupData = () => {
    try {
      const backupData = {
        ...offlineStorage.exportOfflineData(),
        exportDate: new Date().toISOString(),
        version: '1.0'
      }
      
      const dataStr = JSON.stringify(backupData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `radpal-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      showNotification('✅ Backup exported successfully!')
    } catch (error) {
      console.error('Backup failed:', error)
      showNotification('❌ Backup export failed')
    }
  }

  const handleRestoreData = () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const backupData = JSON.parse(e.target?.result as string)
            
            // Basic validation
            if (!backupData.version || !backupData.exportDate) {
              throw new Error('Invalid backup file format')
            }
            
            // Import the data
            offlineStorage.importOfflineData(backupData)
            
            showNotification('✅ Backup restored successfully! Please restart the app to see changes.')
          } catch (error) {
            console.error('Restore failed:', error)
            showNotification('❌ Backup restore failed - invalid file format')
          }
        }
        reader.readAsText(file)
      }
      
      input.click()
    } catch (error) {
      console.error('Restore failed:', error)
      showNotification('❌ Backup restore failed')
    }
  }

  const handleViewOfflineData = () => {
    setShowOfflineDataViewer(true)
    setShowSettingsSidebar(false)
  }

  const handleSettingsAction = (action: string) => {
    if (action === 'edit') {
      window.electron?.ipcRenderer?.send('open-popup-templates', { isOfflineMode })
    } else if (action === 'edit-logic') {
      window.electron?.ipcRenderer?.send('open-popup-logic', { isOfflineMode })
    } else if (action === 'debug') {
      window.dispatchEvent(new CustomEvent('toggle-debug'))
    } else if (action === 'shortcuts') {
      setShowShortcutManager(true)
    } else if (action === 'logout') {
      // console.log('🔍 TopBar logout initiated');
      // Resize window to default login dimensions before logout
      window.electron?.ipcRenderer?.send('resize-window', {
        width: 600,
        height: 900
      });
      window.electronAPI?.authSignOut().then(() => {
        // console.log('🔍 Supabase signOut completed');
        // console.log('🔍 About to reload page');
        // Give a bit more time for auth state to propagate before reload
        setTimeout(() => {
          window.location.reload()
        }, 300)
      }).catch((error) => {
        console.error('❌ Logout failed:', error)
        // Even if logout fails, still reload to clear state
        setTimeout(() => {
          window.location.reload()
        }, 300)
      })
    }
  }


  // Window resizing is now handled natively by Electron

  


  // ✅ Toggle body class for login page + root UI (no scrollbar) and resize window
  useEffect(() => {
  if (!user && !authLoading) {
    console.log('🔄 Switching to login mode, user:', user, 'authLoading:', authLoading);
    document.body.classList.add('login-mode');
    document.body.classList.remove('main-mode');
    
    // Resize window for login mode - ensure this always happens
    if (window.electronAPI?.resizeForLoginMode) {
      console.log('📏 Calling resizeForLoginMode');
      window.electronAPI.resizeForLoginMode();
      
      // Additional fallback for logout scenarios
      setTimeout(() => {
        console.log('📏 Fallback resizeForLoginMode call');
        window.electronAPI.resizeForLoginMode();
      }, 200);
    } else {
      console.log('❌ resizeForLoginMode not available');
    }
  } else if (user) {
    console.log('🔄 Switching to main UI mode, user:', user?.email);
    document.body.classList.add('main-mode');
    document.body.classList.remove('login-mode');
    
    // Resize window for main UI mode (wider) - with longer delay to ensure main process is ready
    setTimeout(() => {
      if (window.electronAPI?.resizeForMainMode) {
        console.log('📏 Delayed resizeForMainMode call');
        window.electronAPI.resizeForMainMode();
      } else {
        console.log('❌ resizeForMainMode not available');
      }
    }, 500);
    
    // Additional fallback: force resize after a longer delay
    setTimeout(() => {
      if (window.electronAPI?.resizeForMainMode) {
        console.log('📏 Second delayed resizeForMainMode call');
        window.electronAPI.resizeForMainMode();
      }
    }, 1000);

    // ✅ Ask main process to launch AHK shortcut EXE
    window.electronAPI?.send('launch-autofill-hotkeys');
  }
}, [user, authLoading]);

// Manual resize saving is handled by the main process window event listeners
// to prevent bounds contamination between login and main UI modes




  useEffect(() => {
  const sendSessionToMain = async () => {
    const result = await window.electronAPI?.authGetSession()
    if (result?.data?.session) {
      // console.log('📤 Sending Supabase session to main:', result.data.session)
      window.electron?.ipcRenderer?.invoke('set-supabase-session', result.data.session)
    } else {
      // console.warn('⚠️ No session found in main app')
    }
  }

  if (user) {
    sendSessionToMain()
  }
}, [user])

// Handle popup content events
useEffect(() => {
  const cleanup = window.electronAPI?.onPopupContent?.((data) => {
    if (data?.type === 'toggle-debug') {
      setShowDebug(prev => !prev)
    }
  })

  return () => {
    if (cleanup && typeof cleanup === 'function') {
      cleanup()
    }
  }
}, [])

  useEffect(() => {
  const toggleHandler = () => setShowDebug(prev => !prev)
  window.addEventListener('toggle-debug', toggleHandler)
  return () => window.removeEventListener('toggle-debug', toggleHandler)
}, [])

  
  // 2. Send current Supabase user to main process for popup use
useEffect(() => {
  if (user) {
    // console.log('📤 Sending user to main process:', user)
    window.electron?.ipcRenderer?.invoke('set-current-user', user).then(() => {
      // console.log('✅ user set remotely')
    }).catch(() => {
      // console.error('❌ Failed to set user remotely:', err)
    })
  }
}, [user])

useEffect(() => {
  console.log('🔧 IPC useEffect running, checking electron availability...');
  const ipc = window?.electron?.ipcRenderer;
  console.log('🔧 IPC object:', !!ipc, 'has on function:', typeof ipc?.on);
  console.log('🔧 IPC properties:', Object.keys(ipc || {}));
  console.log('🔧 Full electron object:', window?.electron);
  console.log('🔧 window.electron keys:', Object.keys(window?.electron || {}));
  
  if (!ipc || typeof ipc.on !== 'function') {
    console.log('❌ IPC not available, returning early');
    return;
  }
  console.log('✅ IPC available, setting up listeners...');

  const reportHandler = () => {
    // console.log('⚡️ IPC → handleGenerate triggered');
    handleGenerate(); // make sure this function exists in App.tsx
  };

  const impressionHandler = () => {
    // console.log('⚡️ IPC → handleGenerateImpression triggered');
    handleGenerateImpression(); // make sure this also exists
  };

  const autofillHandler = (_event, autofillKey) => {
    const shortcuts = JSON.parse(localStorageCache.getItem('globalShortcuts') || '[]');
    const match = shortcuts.find((s) => s.action === autofillKey);

    if (match?.text) {
      navigator.clipboard.writeText(match.text);
      setTimeout(() => document.execCommand('paste'), 100);
    }
  };

  // Logic editor handler
  const logicEditorHandler = (data) => {
    console.log('🎯 Logic editor handler received:', data);
    const { userId, studyType } = data;
    if (userId && studyType) {
      console.log('✅ Setting selectedStudyType to:', studyType);
      setSelectedStudyType(studyType);
      setShowLogicEditor(true);
      console.log('✅ Logic editor should now be visible');
    } else {
      console.error('❌ Missing userId or studyType:', { userId, studyType });
    }
  };

  ipc.on('trigger-generate-report', reportHandler);
  ipc.on('trigger-generate-impression', impressionHandler);
  ipc.on('trigger-auto-text-fill', autofillHandler);
  console.log('🔧 Setting up open-logic-editor event listener');
  ipc.on('open-logic-editor', logicEditorHandler);
  
  // Removed test listener that was opening logic editor on startup

  return () => {
    ipc.removeListener('trigger-generate-report', reportHandler);
    ipc.removeListener('trigger-generate-impression', impressionHandler);
    ipc.removeListener('trigger-auto-text-fill', autofillHandler);
    ipc.removeListener('open-logic-editor', logicEditorHandler);
  };
}, []);

// Separate useEffect for logic editor listener using electronAPI
useEffect(() => {
  console.log('🔧 Setting up logic editor listener...');
  
  if (!window.electronAPI?.onOpenLogicEditor) {
    console.log('❌ onOpenLogicEditor not available');
    return;
  }

  console.log('✅ Setting up open-logic-editor event listener');
  const unsubscribe = window.electronAPI.onOpenLogicEditor((data) => {
    console.log('🎯 Logic editor handler received:', data);
    const { userId, studyType } = data;
    if (userId && studyType) {
      console.log('✅ Setting selectedStudyType to:', studyType);
      setSelectedStudyType(studyType);
      setShowLogicEditor(true);
      console.log('✅ Logic editor should now be visible');
    } else {
      console.error('❌ Missing userId or studyType:', { userId, studyType });
    }
  });

  // Test successful - listener is working!

  return unsubscribe;
}, []);

  // Hook declarations moved earlier to avoid initialization issues

  const {
    generateReport,
    generateReportFromTemplates,
    generateImpressionFromTemplates,
    loading: gptLoading,
    debugPrompt,
    debugResult
  } = useGpt()

  const {
    generateReportWithAgent,
    generateImpressionWithAgent,
    loading: agentLoading,
    error: agentError
  } = useAgentReport()

  // Auto-suggest study type based on findings using local keyword matching
  const suggestStudyType = useCallback((findingsText: string) => {
    if (!findingsText.trim() || findingsText.length < 10 || selectedStudyType) {
      setSuggestedStudyTypes([])
      setSuggestedStudyType('')
      return
    }

    setIsGeneratingSuggestion(true)
    
    try {
      const lowerFindings = findingsText.toLowerCase()
      const suggestions: Array<{type: string, confidence: number}> = []
      
      console.log('🔍 Auto-suggest running with findings:', findingsText.substring(0, 50))
      console.log('🔍 Templates loaded:', templates ? Object.keys(templates).length : 0)
      
      // Define keyword patterns for each study type
      const studyTypePatterns = {
        'MRI Ankle': [
          // Basic anatomy
          'ankle', 'talus', 'calcaneus', 'fibula', 'tibia', 'malleolus', 'posterior talus',
          // Joints
          'tibiotalar', 'tibiotalar joint', 'subtalar', 'subtalar joint', 'midfoot joints',
          // Ligaments - comprehensive ankle ligament list
          'anterior talofibular ligament', 'atfl', 'talofibular ligament', 'talofibular', 
          'posterior talofibular ligament', 'ptfl', 'calcaneofibular ligament', 'cfl',
          'tibiofibular ligament', 'syndesmosis', 'anterior tibiofibular ligament', 
          'posterior tibiofibular ligament', 'interosseous ligament',
          'deltoid ligament', 'deltoid', 'deltoid ligament superficial', 'deltoid ligament deep',
          'spring ligament', 'bifurcate ligament',
          // Tendons - medial
          'posterior tibial tendon', 'flexor digitorum longus', 'flexor hallucis longus', 'fhl',
          // Tendons - lateral
          'peroneus longus', 'peroneus brevis', 'peroneal tendon', 'peroneus',
          // Tendons - anterior
          'anterior tibial tendon', 'extensor hallucis longus', 'ehl', 
          'extensor digitorum longus',
          // Tendons - posterior
          'achilles tendon', 'achilles',
          // Other structures
          'plantar fascia', 'tarsal tunnel', 'sinus tarsi',
          // Common conditions
          'ankle sprain', 'lateral ankle sprain', 'medial ankle sprain', 'high ankle sprain',
          'ankle instability', 'ankle impingement'
        ],
        'MRI Foot': [
          'foot', 'forefoot', 'midfoot', 'hindfoot', 'rearfoot',
          // Bones
          'metatarsal', 'metatarsals', 'phalanx', 'phalanges', 'navicular', 'cuboid', 'cuneiform',
          'tarsals', 'first ray', 'second ray', 'third ray', 'fourth ray', 'fifth ray',
          // Toes and hallux
          'toe', 'big toe', 'great toe', 'hallux', 'lesser toes',
          'hallux-sesamoid complex', 'sesamoid',
          // Joints
          'metatarsophalangeal joint', 'mtp joint', '1st mtp', '2nd mtp', '3rd mtp', '4th mtp', '5th mtp',
          // Ligaments and specific structures
          'lisfranc ligament', 'lisfranc injury', 'lisfranc joint', 'chopart joint',
          'plantar fascia', 'plantar plate',
          // Neuromas
          'morton neuroma', 'morton', 'interdigital neuroma',
          // Tendons
          'flexor tendons', 'extensor tendons', 'flexor tendons of toes', 'extensor tendons of toes',
          // Common conditions
          'hallux valgus', 'bunion', 'hammer toe', 'claw toe', 'mallet toe', 'jones fracture',
          'rays'
        ],
        'MRI Knee': [
          'knee', 'patella', 'patellar', 'femoral condyle', 'tibial plateau', 'intercondylar notch',
          // Ligaments
          'anterior cruciate ligament', 'acl', 'posterior cruciate ligament', 'pcl',
          'medial collateral ligament', 'mcl', 'lateral collateral ligament', 'lcl', 'llc',
          'cruciate', 'collateral ligament', 'patellar ligament', 'quadriceps tendon',
          'patellar tendon', 'popliteus tendon', 'popliteofibular ligament',
          // Meniscus
          'meniscus', 'medial meniscus', 'lateral meniscus', 'meniscal tear', 'meniscal',
          // Joints and cartilage
          'proximal tibiofibular joint', 'trochlea cartilage', 'plica',
          // Other structures
          'baker cyst', 'popliteal', 'patellofemoral', 'chondromalacia', 'runner knee',
          'jumper knee', 'iliotibial band', 'itb', 'pes anserine', 'hoffa fat pad',
          'intercondylar', 'compartments'
        ],
        'MRI Hip': [
          'hip', 'hip joint', 'femoral head', 'femoral neck', 'acetabulum', 'acetabular',
          // Impingement and morphology
          'femoroacetabular impingement', 'fai', 'cam lesion', 'pincer lesion', 
          'cam impingement', 'pincer impingement', 'os acetabulare',
          'dysplasia', 'acetabular retroversion', 'head-neck angle',
          // Labrum and cartilage
          'labrum', 'labral', 'labral tear', 'femoral cartilage', 'acetabular cartilage',
          // Muscles and soft tissues
          'capsule', 'gluteus maximus', 'hamstring origin', 'abductors', 'adductors',
          'short external rotators', 'iliopsoas', 'psoas', 'gluteal', 'gluteus',
          'piriformis', 'piriformis syndrome',
          // Nerves and joints
          'sciatic nerve', 'femoral nerve', 'sacroiliac joint', 'pubic symphysis',
          // Trochanters and conditions
          'trochanter', 'greater trochanter', 'lesser trochanter', 'trochanteric',
          'trochanteric bursitis', 'fibrocystic lesion',
          'hip dysplasia', 'avascular necrosis', 'avn', 'osteonecrosis', 'snapping hip'
        ],
        'MRI Shoulder': [
          'shoulder', 'glenohumeral', 'glenohumeral joint', 'glenoid', 'humeral head',
          // Rotator cuff
          'rotator cuff', 'supraspinatus', 'infraspinatus', 'subscapularis', 'teres minor',
          'rotator cuff tear', 'cuff tear', 'impingement', 'subacromial impingement',
          // Labrum and ligaments
          'labrum', 'labral', 'slap tear', 'bankart lesion', 'hill sachs lesion',
          'glenohumeral ligaments',
          // Acromion and AC joint
          'acromion', 'subacromial spur', 'lateral downsloping', 'acromial arch',
          'acromioclavicular', 'acromioclavicular joint', 'ac joint',
          // Biceps and bursa
          'biceps tendon', 'long head biceps', 'long head of biceps tendon', 'bicipital anchor',
          'subacromial-subdeltoid bursa', 'subdeltoid bursa',
          // Cartilage and other structures
          'humeral head cartilage',
          'frozen shoulder', 'adhesive capsulitis', 'shoulder instability', 'dislocation'
        ],
        'MRI Elbow': [
          'elbow', 'elbow joint', 'humerus', 'radius', 'ulna',
          // Epicondyles and prominences
          'lateral epicondyle', 'medial epicondyle', 'olecranon', 'radial head',
          // Ligaments
          'ulnar collateral ligament', 'ucl', 'radial collateral ligament',
          'lateral ulnar collateral ligament',
          // Tendons
          'common flexor tendon', 'common extensor tendon', 'triceps tendon',
          'biceps tendon', 'brachialis',
          // Joints and bursa
          'radio-capitellar joint', 'ulno-humeral joint', 'proximal radioulnar joint',
          'bicipitoradial bursa',
          // Nerve and tunnel
          'ulnar nerve', 'cubital tunnel', 'cubital tunnel syndrome',
          // Common conditions
          'tennis elbow', 'lateral epicondylitis', 'golfer elbow', 'medial epicondylitis',
          'intra-articular bodies'
        ],
        'MRI Wrist': [
          'wrist', 'wrist joint', 'radiocarpal', 'midcarpal',
          // Joints
          'distal radioulnar joint', 'druj', 'pisiform-triquetral joint', 
          'scaphotrapezotrapezoidal joint', 'stt joint', 'thumb carpometacarpal joint',
          // Carpal bones
          'carpal', 'carpus', 'carpal bones', 'scaphoid', 'lunate', 'triquetrum', 'pisiform', 
          'hamate', 'capitate', 'trapezoid', 'trapezium',
          // Ligaments and TFCC
          'tfcc', 'triangular fibrocartilage', 'triangular fibrocartilage complex',
          'scapholunate ligament', 'lunotriquetral ligament',
          // Compartments and tendons
          'extensor compartments', 'extensor compartment i', 'extensor compartment ii',
          'extensor compartment iii', 'extensor compartment iv', 'extensor compartment v',
          'extensor compartment vi', 'flexor tendons', 'flexor retinaculum',
          // Tunnels and nerves
          'carpal tunnel', 'carpal tunnel syndrome', 'median nerve',
          'guyon canal',
          // Conditions
          'de quervain', 'kienbock disease', 'scaphoid fracture'
        ],
        'MRI Hand': [
          'hand', 'finger', 'thumb', 'digits',
          'metacarpal', 'phalanges', 'phalanx', 'proximal phalanx', 'middle phalanx', 'distal phalanx',
          'mcp joint', 'pip joint', 'dip joint', 'metacarpophalangeal', 'interphalangeal',
          'flexor tendon', 'extensor tendon', 'trigger finger', 'trigger thumb',
          'mallet finger', 'swan neck deformity', 'boutonniere deformity',
          'dupuytren contracture', 'ganglion cyst'
        ],
        'MRI Cervical Spine': [
          'cervical', 'cervical spine', 'c-spine', 'c spine', 'neck',
          'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'atlas', 'axis',
          'cervical disc', 'cervical stenosis', 'cervical radiculopathy', 'cervical myelopathy',
          'neck pain', 'whiplash', 'torticollis', 'cervical spondylosis'
        ],
        'MRI Thoracic Spine': [
          'thoracic', 'thoracic spine', 't-spine', 't spine', 'mid back', 'middle back',
          't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12',
          'thoracic disc', 'thoracic stenosis', 'thoracic radiculopathy',
          'thoracolumbar', 'kyphosis', 'thoracic kyphosis'
        ],
        'MRI Lumbar Spine': [
          'lumbar', 'lumbar spine', 'l-spine', 'l spine', 'lower back', 'low back',
          'l1', 'l2', 'l3', 'l4', 'l5', 's1', 'lumbosacral',
          'lumbar disc', 'disc herniation', 'herniated disc', 'bulging disc', 'disc protrusion',
          'lumbar stenosis', 'spinal stenosis', 'canal stenosis', 'foraminal stenosis',
          'sciatica', 'radiculopathy', 'nerve root', 'nerve root compression',
          'facet joint', 'facet arthropathy', 'spondylolisthesis', 'spondylolysis',
          'lumbar spondylosis', 'degenerative disc disease', 'ddd'
        ],
        'MRI Total Spine': ['total spine', 'whole spine', 'entire spine', 'full spine', 'complete spine'],
        'CT Abdomen Pelvis': [
          // Liver and biliary
          'liver', 'hepatic', 'biliary', 'intrahepatic ductal dilatation',
          'gallbladder', 'gallstones', 'common bile duct',
          // Other organs
          'spleen', 'splenic',
          'pancreas', 'peripancreatic',
          'adrenal glands',
          // Genitourinary
          'kidneys', 'renal', 'ureters', 'hydronephrosis', 'nephrolithiasis',
          'bladder',
          // GI tract
          'bowel', 'small bowel', 'large bowel', 'obstruction',
          // Vascular
          'abdominal aorta', 'aneurysm', 'dissection',
          // Other structures
          'retroperitoneum', 'lymph nodes', 'lymphadenopathy',
          // Lung bases
          'lungs (bases)', 'consolidation', 'effusion', 'nodule',
          // Legacy keywords
          'abdomen', 'pelvis', 'appendix', 'ovary', 'uterus', 'prostate', 'colon', 'intestine'
        ],
        'CT Chest': [
          // Lungs and airways
          'lungs', 'pulmonary', 'airways', 'consolidation', 'pneumothorax',
          'pulmonary nodule', 'bronchial obstruction', 'endobronchial lesion',
          // Pleura and chest wall
          'pleural effusion', 'pleura', 'chest wall',
          // Heart and vessels
          'heart', 'great vessels', 'aorta', 'dissection', 'aneurysm', 'pulmonary embolism',
          // Mediastinum
          'mediastinum', 'hilar lymph nodes', 'mediastinal lymphadenopathy',
          // Other
          'upper abdomen (visualized)',
          'fracture', 'dislocation', 'aggressive osseous lesion',
          'subcutaneous tissues',
          // Legacy keywords
          'chest', 'lung', 'pleural', 'thorax', 'bronchi', 'pneumonia', 'nodule', 'embolism'
        ],
        'CT Head': [
          // Brain parenchyma
          'brain parenchyma', 'hemorrhage', 'intracranial hemorrhage',
          // Mass effect and anatomy
          'mass effect', 'herniation', 'gray-white differentiation',
          // Ventricles and fluid
          'white matter', 'ventricles', 'extra-axial', 'hydrocephalus', 'fluid collections',
          // Extracranial
          'extracranial structures', 'fracture', 'paranasal sinuses', 'mastoids',
          // Pathology
          'large territorial infarct',
          // Legacy keywords
          'head', 'brain', 'skull', 'intracranial', 'stroke', 'subdural', 'subarachnoid', 'ventricle', 'sinuses'
        ],
        'CT Pulmonary Embolism': [
          // Main distinguishing features
          'pulmonary arteries', 'main pulmonary artery', 'pulmonary embolism', 'pe',
          // Lung findings
          'lungs', 'consolidation', 'pneumothorax', 'pulmonary nodule',
          'bronchial obstruction', 'endobronchial lesion',
          // Pleura and chest wall
          'pleural effusion', 'pleura', 'chest wall',
          // Heart and vessels
          'heart', 'aorta', 'dissection', 'aneurysm',
          // Mediastinum
          'mediastinum', 'hilar lymph nodes',
          // Other
          'upper abdomen (visualized)',
          'fracture', 'dislocation', 'aggressive osseous lesion',
          'subcutaneous tissues',
          // Legacy keywords
          'pe protocol', 'pulmonary artery', 'embolus', 'thrombosis', 'ctpa'
        ],
        'DEXA': ['dexa', 'bone density', 'osteoporosis', 'osteopenia', 't-score', 'z-score', 'bmd', 'fracture risk'],
        'MRI Generic': ['mri', 'magnetic resonance'],
        'CT Generic': ['ct', 'computed tomography', 'cat scan'],
        'MSK MRI Generic': [
          // Common findings
          'fracture', 'traumatic malalignment', 'bone marrow edema', 'marrow signal',
          'osteoarthritis', 'joint effusion',
          // Anatomical structures
          'ligaments', 'tendons', 'muscles', 'atrophy', 'muscle atrophy',
          'neurovascular structures', 'neurovascular structures intact',
          'subcutaneous tissues', 'soft tissues',
          // Common descriptors
          'unremarkable'
        ]
      }
      
      // Score each study type based on keyword matches
      // First process predefined patterns
      for (const [studyType, keywords] of Object.entries(studyTypePatterns)) {
        // Check if template exists OR if no templates are loaded yet (allow suggestions to work)
        if (templates && Object.keys(templates).length > 0 && !templates[studyType]) {
          continue // Only skip if templates are loaded AND this specific template doesn't exist
        }
        
        let score = 0
        let matchedKeywords = 0
        
        for (const keyword of keywords) {
          if (lowerFindings.includes(keyword)) {
            // Give higher weight to more specific/longer keywords
            const weight = keyword.split(' ').length > 1 ? 3 : 1
            score += weight
            matchedKeywords++
            console.log(`  ✓ Matched "${keyword}" for ${studyType} (weight: ${weight})`)
          }
        }
        
        if (score > 0) {
          // Calculate confidence based on matched keywords
          // Base confidence on number of matches and their weights
          const baseConfidence = (matchedKeywords / Math.min(3, keywords.length)) * 60 // Up to 60% for matching 3 keywords
          const scoreBonus = Math.min(35, score * 10) // Up to 35% bonus for weighted matches
          const confidence = Math.min(95, Math.round(baseConfidence + scoreBonus))
          
          console.log(`  → ${studyType}: ${matchedKeywords} matches, score ${score}, confidence ${confidence}%`)
          suggestions.push({ type: studyType, confidence })
        }
      }
      
      // Process ALL loaded templates that don't have predefined patterns
      if (templates && Object.keys(templates).length > 0) {
        const allTemplateNames = Object.keys(templates);
        const patternsKeys = Object.keys(studyTypePatterns);
        const templatesWithoutPatterns = allTemplateNames.filter(name => !patternsKeys.includes(name));
        
        console.log('🔍 Templates without patterns:', templatesWithoutPatterns);
        
        for (const studyType of templatesWithoutPatterns) {
          // Create basic keyword matching from the template name itself
          const templateKeywords = studyType.toLowerCase().split(/[\s_-]+/).filter(word => word.length > 2);
          
          let score = 0;
          let matchedKeywords = 0;
          
          for (const keyword of templateKeywords) {
            if (lowerFindings.includes(keyword)) {
              score += keyword.length; // Weight by keyword length
              matchedKeywords++;
            }
          }
          
          if (matchedKeywords > 0) {
            // Lower confidence for templates without specific patterns
            const baseConfidence = (matchedKeywords / Math.min(2, templateKeywords.length)) * 40; // Up to 40% for name matching
            const scoreBonus = Math.min(15, score * 2); // Up to 15% bonus
            const confidence = Math.min(60, Math.round(baseConfidence + scoreBonus)); // Max 60% for name-only matches
            
            console.log(`  → ${studyType} (name-based): ${matchedKeywords} matches, score ${score}, confidence ${confidence}%`);
            suggestions.push({ type: studyType, confidence });
          }
        }
      }
      
      // Sort by confidence and take top 3
      suggestions.sort((a, b) => b.confidence - a.confidence)
      const topSuggestions = suggestions.slice(0, 3).filter(s => s.confidence >= 20) // Lowered threshold
      
      console.log('🔍 Local suggestions:', topSuggestions)
      
      if (topSuggestions.length > 0) {
        setSuggestedStudyTypes(topSuggestions)
        setSuggestedStudyType(topSuggestions[0].type)
      } else {
        setSuggestedStudyTypes([])
        setSuggestedStudyType('')
      }
    } catch (error) {
      console.error('Auto-suggest error:', error)
      setSuggestedStudyTypes([])
      setSuggestedStudyType('')
    } finally {
      // Add a small delay to simulate processing
      setTimeout(() => {
        setIsGeneratingSuggestion(false)
      }, 100)
    }
  }, [selectedStudyType, templates])

  // Debounced version of suggestStudyType with longer delay to prevent excessive queries
  const debouncedSuggestStudyType = useMemo(
    () => debounce(suggestStudyType, 1000), // Wait 1 second after user stops typing
    [suggestStudyType]
  )
  
  // Create a stable onChange handler for RichTextEditor
  const handleRichTextChange = useCallback((newFindings: string) => {
    console.log('📝 App: RichTextEditor onChange called:', {
      length: newFindings?.length || 0,
      preview: newFindings?.substring(0, 50),
      currentFindings: findings.substring(0, 50),
      currentLength: findings.length,
      typeOfNewFindings: typeof newFindings,
      isNull: newFindings === null,
      isUndefined: newFindings === undefined,
      actualNewFindings: newFindings
    })
    
    // Directly update the findings state
    if (newFindings !== undefined && newFindings !== null) {
      setFindingsWithHistory(newFindings, true)
      
      // Get plain text for suggestions - extract from HTML
      const temp = document.createElement('div')
      temp.innerHTML = newFindings
      const plainText = temp.textContent || temp.innerText || ''
      
      console.log('📝 Plain text for suggestions:', {
        html: newFindings,
        length: plainText.length,
        preview: plainText.substring(0, 50),
        fullText: plainText
      })
      
      // Clear suggestions if text is too short
      if (plainText.trim().length < 10) {
        setSuggestedStudyTypes([])
        setSuggestedStudyType('')
        return
      }
      
      // Trigger auto-suggestion when text is substantial
      if (plainText.trim().length > 20) {
        try {
          console.log('🔍 Triggering study type suggestion from handleRichTextChange with text:', plainText)
          debouncedSuggestStudyType(plainText)
        } catch (error) {
          console.log('Auto-suggest error:', error)
        }
      }
    }
  }, [findings, setFindingsWithHistory, debouncedSuggestStudyType, setSuggestedStudyTypes, setSuggestedStudyType])
  
  // Helper function to extract plain text from HTML
  const getPlainTextFromHTML = (html: string): string => {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div')
    temp.innerHTML = html
    // Get text content, which strips all HTML tags
    return temp.textContent || temp.innerText || ''
  }

  // Auto-suggest study type when findings change (from dictation or manual input)
  useEffect(() => {
    console.log('📝 Findings changed, length:', findings?.length || 0);
    
    if (!findings) {
      setSuggestedStudyTypes([])
      setSuggestedStudyType('')
      return
    }
    
    // Extract plain text from HTML findings
    const plainText = getPlainTextFromHTML(findings)
    console.log('📝 Plain text extracted, length:', plainText.length, 'preview:', plainText.substring(0, 50));
    
    if (plainText.trim().length < 10) {
      setSuggestedStudyTypes([])
      setSuggestedStudyType('')
      return
    }
    
    if (plainText.trim().length > 20) {
      try {
        console.log('🔍 Triggering study type suggestion...');
        debouncedSuggestStudyType(plainText)
      } catch (error) {
        console.log('Auto-suggest error from dictation:', error)
      }
    }
  }, [findings, debouncedSuggestStudyType])

const openEditablePopup = (content) => {
  const channel = content?.mode === 'impression-only' ? 'open-popup-impression' : 'open-popup'
  if (window?.electronAPI?.send) {
    window.electronAPI.send(channel, content)
  } else {
    // console.error('❌ IPC not available in window context.')
  }
}



const handleGenerate = useCallback(async () => {
  try {
    console.log('🔍 handleGenerate called');
    console.log('🔍 selectedStudyType:', selectedStudyType);
    console.log('🔍 templates keys:', Object.keys(templates));
    console.log('🔍 generateReportWithAgent available:', !!generateReportWithAgent);
  
  // Check if study type is selected
  if (!selectedStudyType) {
    console.log('❌ No study type selected');
    showNotification('Please select a study type before generating report');
    return;
  }

  // Validate that the entered study type exists in templates
  if (!templates[selectedStudyType]) {
    console.log('❌ Study type not found in templates:', selectedStudyType);
    console.log('❌ Available templates:', Object.keys(templates));
    showNotification(`Invalid study type: "${selectedStudyType}". Please select from the available options.`);
    return;
  }

  // Get findings from state or directly from the RichTextEditor if state is empty
  let currentFindings = findings;
  if ((!currentFindings || currentFindings.trim().length === 0) && richTextEditorRef.current) {
    currentFindings = richTextEditorRef.current.getValue();
    console.log('📝 Retrieved findings directly from RichTextEditor:', {
      html: currentFindings,
      length: currentFindings.length,
      preview: currentFindings.substring(0, 100),
      plainText: richTextEditorRef.current.getPlainText()
    });
  }

  // Extract plain text from HTML findings for AI generation
  let finalFindings = getPlainTextFromHTML(currentFindings);
  
  // If still empty, try getting plain text directly
  if ((!finalFindings || finalFindings.trim().length === 0) && richTextEditorRef.current) {
    finalFindings = richTextEditorRef.current.getPlainText();
    console.log('📝 Using plain text directly from editor:', finalFindings);
  }
  
  // If findings are empty or just whitespace, show error
  if (!finalFindings || finalFindings.trim().length === 0) {
    console.error('❌ No findings to generate report from');
    showNotification('Please enter findings before generating a report');
    return;
  }
  
  console.log('📋 Findings for report generation:', {
    rawFindings: findings,
    htmlLength: findings?.length || 0,
    plainTextLength: finalFindings?.length || 0,
    preview: finalFindings?.substring(0, 100) || 'No findings',
    extractedText: finalFindings
  });

  console.log('🔍 Starting generation');
  // STEP 1: Clear any previous generation result
  setGenerationResult(null);

  try {
    console.log('🔍 Starting report generation with agent');
    // STEP 2: Use new agent-based system
    const model = mapRadPalModelToAgent(apiProvider);
    const startTime = Date.now();
    
    const agentResult = await generateReportWithAgent(
      finalFindings,
      selectedStudyType,
      model
    );
    
    console.log('🔍 Agent result:', agentResult);

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // STEP 4: Update main UI with results
    const templateText = templates[selectedStudyType]?.template || '';
    const generatedText = agentResult.text || '❌ Report generation failed.';
    
    // Pre-calculate diff parts to avoid recalculation during editing
    console.log('🔍 DIFF DEBUG - Template text preview:', templateText.trim().substring(0, 200));
    console.log('🔍 DIFF DEBUG - Generated text preview:', generatedText.trim().substring(0, 200));
    
    const rawDiffParts = diffWordsWithSpace(templateText.trim(), generatedText.trim());
    console.log('🔍 DIFF DEBUG - Raw diff parts count:', rawDiffParts.length);
    
    const diffParts = rawDiffParts.filter((part, i) => {
      // DO NOT FILTER ANYTHING - show the complete diff
      // The previous filtering was removing important spaces from the displayed text
      return true;
    });
    
    console.log('🔍 DIFF DEBUG - Filtered diff parts count:', diffParts.length);
    
    setGenerationResult({
      type: 'report',
      originalFindings: finalFindings,
      templateText: templateText,
      generatedText: generatedText,
      generationTime,
      tokens: agentResult.tokens,
      showDiff: true, // Enable diff view for report generation
      diffParts: diffParts // Store pre-calculated diff
    });
    
    // Build HTML with diff formatting for the rich text editor
    let diffHtml = '';
    if (diffParts) {
      diffParts.forEach(part => {
        let partHtml = part.value
          // Apply keyword formatting first
          .replace(/\b(FINDINGS?:)/gi, '<strong>$1</strong>')
          .replace(/\b(IMPRESSION:)/gi, '<strong>$1</strong>')
          .replace(/\b(LEFT|RIGHT)\b/g, '<strong>$1</strong>')
          // Convert newlines to <br> tags
          .replace(/\n/g, '<br>');
        
        if (part.added) {
          // Green background for added text
          diffHtml += `<span style="background-color: rgba(58, 188, 150, 0.3); color: #3ABC96; padding: 1px 2px; border-radius: 2px;">${partHtml}</span>`;
        } else if (part.removed) {
          // Red strikethrough for removed text
          diffHtml += `<span style="background-color: rgba(227, 103, 86, 0.3); color: #E36756; text-decoration: line-through; padding: 1px 2px; border-radius: 2px;">${partHtml}</span>`;
        } else {
          // Normal text
          diffHtml += partHtml;
        }
      });
    }
    
    // Save checkpoint before replacing for undo functionality
    saveFindingsCheckpoint();
    
    // Update the RichTextEditor with the diff HTML
    if (richTextEditorRef.current && diffHtml) {
      richTextEditorRef.current.setValue(diffHtml);
      setFindings(diffHtml);
    } else if (diffHtml) {
      setFindings(diffHtml);
    }
  } catch (error) {
    console.error('Agent report generation failed:', error);
    const errorMessage = `❌ Report generation failed: ${error.message || 'Unknown error'}`;
    const templateText = templates[selectedStudyType]?.template || '';
    
    // Pre-calculate diff parts even for error case
    const diffParts = diffWordsWithSpace(templateText.trim(), errorMessage.trim()).filter((part, i) => {
      // DO NOT FILTER ANYTHING - show the complete diff
      // The previous filtering was removing important spaces from the displayed text
      return true;
    });
    
    setGenerationResult({
      type: 'report',
      originalFindings: finalFindings,
      templateText: templateText,
      generatedText: errorMessage,
      generationTime: '0.0',
      tokens: { input: 0, output: 0, total: 0 },
      showDiff: true, // Enable diff view for report generation
      diffParts: diffParts // Store pre-calculated diff
    });
    // Don't save error to history - user can undo to get back findings
    setFindings(errorMessage, false);
  }
} catch (error) {
  console.error('❌ handleGenerate error:', error);
  showNotification(`Generation failed: ${error.message || 'Unknown error'}`);
  // Don't modify findings on error - user keeps their original text
}
}, [templates, generateReportWithAgent, findings, selectedStudyType, apiProvider, showNotification, saveFindingsCheckpoint]);



  const handleGenerateImpression = useCallback(async () => {
  // Check if study type is selected
  if (!selectedStudyType) {
    showNotification('Please select a study type before generating impression');
    return;
  }

  // Validate that the entered study type exists in templates
  if (!templates[selectedStudyType]) {
    showNotification(`Invalid study type: "${selectedStudyType}". Please select from the available options.`);
    return;
  }

  // Get findings from state or directly from the RichTextEditor if state is empty
  let currentFindings = findings;
  if ((!currentFindings || currentFindings.trim().length === 0) && richTextEditorRef.current) {
    currentFindings = richTextEditorRef.current.getValue();
    console.log('📝 Retrieved findings directly from RichTextEditor for impression:', {
      html: currentFindings,
      length: currentFindings.length,
      preview: currentFindings.substring(0, 100),
      plainText: richTextEditorRef.current.getPlainText()
    });
  }

  // Extract plain text from HTML findings for AI generation
  let finalFindings = getPlainTextFromHTML(currentFindings);
  
  // If still empty, try getting plain text directly
  if ((!finalFindings || finalFindings.trim().length === 0) && richTextEditorRef.current) {
    finalFindings = richTextEditorRef.current.getPlainText();
    console.log('📝 Using plain text directly from editor for impression:', finalFindings);
  }
  
  console.log('📋 Findings for impression generation:', {
    htmlLength: currentFindings?.length || 0,
    plainTextLength: finalFindings?.length || 0,
    preview: finalFindings?.substring(0, 100) || 'No findings'
  });

  // If findings are empty or just whitespace, show error
  if (!finalFindings || finalFindings.trim().length === 0) {
    console.error('❌ No findings to generate impression from');
    showNotification('Please enter findings before generating an impression');
    return;
  }

  // STEP 1: Clear any previous generation result
  setGenerationResult(null);

  try {
    // STEP 2: Use new agent-based system
    const model = mapRadPalModelToAgent(apiProvider);
    const startTime = Date.now();
    
    const agentResult = await generateImpressionWithAgent(
      finalFindings,
      selectedStudyType,
      model
    );

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // STEP 3: Update main UI with results - directly in rich text editor
    const impressionText = agentResult.text || '❌ Impression generation failed.';
    
    // Save checkpoint before replacing for undo functionality
    saveFindingsCheckpoint();
    
    // Update the rich text editor with formatted content
    // Format the impression text with bold FINDINGS: and IMPRESSION:
    const formattedImpressionText = impressionText
      .replace(/\b(FINDINGS?:)/gi, '<strong>$1</strong>')
      .replace(/\b(IMPRESSION:)/gi, '<strong>$1</strong>')
      .replace(/\b(LEFT|RIGHT)\b/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    
    if (richTextEditorRef.current) {
      richTextEditorRef.current.setValue(formattedImpressionText);
      setFindings(formattedImpressionText);
    } else {
      setFindings(formattedImpressionText);
    }
    
    // Update status message only (no diff view)
    setGenerationResult({
      type: 'impression',
      originalFindings: finalFindings,
      templateText: '', // No template comparison for impression
      generatedText: impressionText,
      generationTime,
      tokens: agentResult.tokens,
      showDiff: false // Flag to indicate no diff should be shown
    });
    
    // Diff view is now always-on, shows changes automatically
  } catch (error) {
    console.error('Agent impression generation failed:', error);
    const errorMessage = `❌ Impression generation failed: ${error.message || 'Unknown error'}`;
    setGenerationResult({
      type: 'impression',
      originalFindings: finalFindings,
      templateText: '', // No template comparison for impression
      generatedText: errorMessage,
      generationTime: '0.0',
      tokens: { input: 0, output: 0, total: 0 },
      showDiff: false // Flag to indicate no diff should be shown
    });
    // Don't save error to history - user can undo to get back findings
    setFindings(errorMessage, false);
  }
}, [templates, generateImpressionWithAgent, findings, selectedStudyType, apiProvider, showNotification, saveFindingsCheckpoint])



  // Debug logging to see what's happening with auth state
  // console.log('🔍 App render - authLoading:', authLoading, 'user:', user ? `${user.email} (${user.id})` : 'null');
  // console.log('🔍 Templates loaded:', Object.keys(templates).length, 'keys:', Object.keys(templates));
  // console.log('🔍 Selected study type:', selectedStudyType);
  // console.log('🔍 gptLoading:', gptLoading, 'templatesLoading:', templatesLoading);

  // Handle picklist selection
  const handlePicklistSelect = useCallback((value: string) => {
    // Get the current element
    let element: HTMLTextAreaElement | HTMLElement | null = findingsTextareaRef.current;
    if (!element) {
      const contentEditables = document.querySelectorAll('[contenteditable="true"]');
      for (const el of contentEditables) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.width === '100%' && htmlEl.style.height === '100%') {
          element = htmlEl;
          break;
        }
      }
    }
    
    if (element) {
      insertMacroText(element, value);
      element.focus();
    }
    
    setPicklistState(null);
  }, []);

  // Initialize macro store with user ID
  useEffect(() => {
    if (user?.id) {
      macroStore.setUserId(user.id);
    }
  }, [user?.id]);

  // Save macro settings when they change
  useEffect(() => {
    saveMacroSettings(macroSettings);
  }, [macroSettings]);

  return (
  authLoading ? (
    <div style={{ padding: 40 }}>🔐 Loading user...</div>
  ) : !user ? (
    <>
      {/* Show update checker before login */}
      {!updateCheckComplete && (
        <UpdateChecker onComplete={() => setUpdateCheckComplete(true)} />
      )}
      <div className="radpal-outer-frame">
        <div className="window-frame">
          <LoginPanel />
        </div>
      </div>
    </>
  ) : (
    <>
      {/* CUDA Installation Progress Modal */}
      {cudaInstallStatus.installing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2a2d31 0%, #1e2023 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 32,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: 24,
              fontWeight: 600,
              color: '#fff',
              fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
            }}>
              🎮 Installing GPU Acceleration
            </h2>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.5
            }}>
              Installing CUDA-enabled binaries to accelerate offline AI generation with your NVIDIA GPU.
            </p>
            
            {/* Progress Bar */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 8,
              height: 8,
              overflow: 'hidden',
              marginBottom: 16
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
                height: '100%',
                width: `${cudaInstallStatus.progress || 0}%`,
                transition: 'width 0.3s ease',
                boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
              }} />
            </div>
            
            {/* Status Text */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8
            }}>
              <span style={{
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.6)'
              }}>
                {cudaInstallStatus.status || 'Starting installation...'}
              </span>
              <span style={{
                fontSize: 13,
                color: '#4CAF50',
                fontWeight: 500
              }}>
                {cudaInstallStatus.progress || 0}%
              </span>
            </div>
            
            {/* Error Message */}
            {cudaInstallStatus.error && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.2)',
                borderRadius: 8
              }}>
                <p style={{
                  margin: 0,
                  fontSize: 12,
                  color: 'rgba(244, 67, 54, 0.9)',
                  lineHeight: 1.4
                }}>
                  Error: {cudaInstallStatus.error}
                </p>
              </div>
            )}
            
            {/* Info Note */}
            <div style={{
              marginTop: 24,
              padding: 12,
              background: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.2)',
              borderRadius: 8
            }}>
              <p style={{
                margin: 0,
                fontSize: 12,
                color: 'rgba(76, 175, 80, 0.9)',
                lineHeight: 1.4
              }}>
                ⚡ GPU acceleration will provide significantly faster offline generation (typically 10x speed improvement).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Model Download Progress Modal */}
      {modelDownloadStatus.downloading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2a2d31 0%, #1e2023 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 32,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: 24,
              fontWeight: 600,
              color: '#fff',
              fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
            }}>
              Setting up Local AI
            </h2>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.5
            }}>
              {modelDownloadStatus.status?.includes('server') 
                ? 'Setting up local AI server. This is a one-time setup.'
                : 'Downloading Mistral AI model for offline use. This is a one-time download.'}
            </p>
            
            {/* Progress Bar */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 8,
              height: 8,
              overflow: 'hidden',
              marginBottom: 16
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #FF6B35, #FF8E53)',
                height: '100%',
                width: `${modelDownloadStatus.progress || 0}%`,
                transition: 'width 0.3s ease',
                boxShadow: '0 0 10px rgba(255, 107, 53, 0.5)'
              }} />
            </div>
            
            {/* Status Text */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8
            }}>
              <span style={{
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.6)'
              }}>
                {modelDownloadStatus.status || 'Starting download...'}
              </span>
              <span style={{
                fontSize: 13,
                color: '#FF6B35',
                fontWeight: 500
              }}>
                {modelDownloadStatus.progress || 0}%
              </span>
            </div>
            
            {/* File Size Info */}
            {modelDownloadStatus.bytesTotal && (
              <div style={{
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center',
                marginTop: 8
              }}>
                {Math.round((modelDownloadStatus.bytesDownloaded || 0) / 1024 / 1024)} MB / {Math.round(modelDownloadStatus.bytesTotal / 1024 / 1024)} MB
              </div>
            )}
            
            {/* Info Note */}
            <div style={{
              marginTop: 24,
              padding: 12,
              background: 'rgba(255, 165, 0, 0.1)',
              border: '1px solid rgba(255, 165, 0, 0.2)',
              borderRadius: 8
            }}>
              <p style={{
                margin: 0,
                fontSize: 12,
                color: 'rgba(255, 165, 0, 0.9)',
                lineHeight: 1.4
              }}>
                ℹ️ This 4.4GB model enables completely offline AI processing. After this download, RadPal will work without internet.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="radpal-outer-frame" style={isContracted ? { overflow: 'visible' } : {}}>
        <div className="window-frame" style={isContracted ? { overflow: 'visible' } : {}}>
        {!isContracted && (
          <div
            className="radpal-root dark"
            style={{
              padding: '12px',
              minHeight: '100vh',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}
          >

            {/* Top Bar - New thin topbar with main controls */}
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: 50,
              background: 'rgba(42, 45, 49, 0.95)',
              backdropFilter: 'blur(12px) saturate(120%)',
              WebkitBackdropFilter: 'blur(12px) saturate(120%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              zIndex: 1000,
              gap: 12
            }}>
              {/* Draggable area in topbar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '30%',
                right: '30%',
                height: '100%',
                WebkitAppRegion: 'drag',
                pointerEvents: 'none',
                zIndex: -1
              }} />
              
              {/* Left section - Dictate and Clear All buttons */}
              <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 10 }}>
                {/* Microphone Toggle */}
                <button
                  onMouseDown={(e) => e.preventDefault()}   // keeps focus in editor
                  onPointerDown={(e) => e.preventDefault()} // touch/pen too
                  onClick={handleDictationToggle}
                  disabled={gptLoading}
                  style={{
                    padding: '8px 12px',
                    background: isRecording ? 'linear-gradient(135deg, #E36756 0%, #c7564a 100%)' : 'rgba(108, 117, 125, 0.1)',
                    border: isRecording ? '1px solid rgba(227, 103, 86, 0.5)' : '1px solid rgba(108, 117, 125, 0.3)',
                    borderRadius: 8,
                    color: isRecording ? '#fff' : '#6C757D',
                    fontSize: 14,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: gptLoading ? 'not-allowed' : 'pointer',
                    opacity: gptLoading ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {isRecording ? '⏸ Recording...' : '🎙 Dictate'}
                </button>
                
                {/* Microphone Reset Button */}
                <button
                  onMouseDown={(e) => e.preventDefault()}   // keeps focus in editor
                  onPointerDown={(e) => e.preventDefault()} // touch/pen too
                  onClick={resetMicrophone}
                  title="Reset microphone system (fixes accuracy issues)"
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(108, 117, 125, 0.1)',
                    border: '1px solid rgba(108, 117, 125, 0.3)',
                    borderRadius: 8,
                    color: '#6C757D',
                    fontSize: 12,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag'
                  }}
                >
                  🔄
                </button>
                
                {/* Hardware Mic Toggle Button */}
                <button
                  onMouseDown={(e) => e.preventDefault()}   // keeps focus in editor
                  onPointerDown={(e) => e.preventDefault()} // touch/pen too
                  onClick={toggleHardwareMic}
                  title={hardwareMicEnabled ? 
                    "Disable SpeedMic III hardware button (prevents conflicts with PowerScribe)" : 
                    "Enable SpeedMic III hardware button"
                  }
                  style={{
                    padding: '8px 10px',
                    background: hardwareMicEnabled ? 
                      'rgba(58, 188, 150, 0.1)' : 
                      'rgba(108, 117, 125, 0.1)',
                    border: hardwareMicEnabled ? 
                      '1px solid rgba(58, 188, 150, 0.3)' : 
                      '1px solid rgba(108, 117, 125, 0.3)',
                    borderRadius: 8,
                    color: hardwareMicEnabled ? '#3ABC96' : '#6C757D',
                    fontSize: 12,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag'
                  }}
                >
                  {hardwareMicEnabled ? '🔗' : '🔗⛔'}
                </button>
                
                {/* Undo Button */}
                <button
                  onClick={() => {
                    undoFindings();
                    // Update the rich text editor to reflect the undo
                    if (richTextEditorRef.current) {
                      richTextEditorRef.current.setValue(findings);
                      richTextEditorRef.current.focus();
                    } else if (findingsTextareaRef.current) {
                      findingsTextareaRef.current.focus();
                    }
                  }}
                  title="Undo (or say 'undo that')"
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(108, 117, 125, 0.1)',
                    border: '1px solid rgba(108, 117, 125, 0.3)',
                    borderRadius: 8,
                    color: '#6C757D',
                    fontSize: 14,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#3ABC96';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#6C757D';
                  }}
                >
                  ↶
                </button>
                
                {/* Redo Button */}
                <button
                  onClick={() => {
                    redoFindings();
                    // Update the rich text editor to reflect the redo
                    if (richTextEditorRef.current) {
                      richTextEditorRef.current.setValue(findings);
                      richTextEditorRef.current.focus();
                    } else if (findingsTextareaRef.current) {
                      findingsTextareaRef.current.focus();
                    }
                  }}
                  title="Redo (or say 'redo that')"
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(108, 117, 125, 0.1)',
                    border: '1px solid rgba(108, 117, 125, 0.3)',
                    borderRadius: 8,
                    color: '#6C757D',
                    fontSize: 14,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#3ABC96';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#6C757D';
                  }}
                >
                  ↷
                </button>
                
                {/* Clear All Button */}
                <button
                  onClick={() => {
                    setSelectedStudyType('')
                    setSuggestedStudyTypes([])
                    setSuggestedStudyType('')
                    setGenerationResult(null)
                    
                    // Clear findings in a way that preserves undo history
                    if (richTextEditorRef.current) {
                      richTextEditorRef.current.setValue('');
                      richTextEditorRef.current.focus();
                      setFindings('');
                    } else {
                      const textarea = findingsTextareaRef.current;
                      if (textarea) {
                        // Select all text and replace with empty string using setRangeText
                        // This preserves the undo stack
                        textarea.focus();
                        textarea.select();
                        textarea.setRangeText('', 0, textarea.value.length, 'end');
                        setFindings('');
                      } else {
                        // If contentEditable (diff view), find and clear it
                        const contentEditables = document.querySelectorAll('[contenteditable="true"]');
                        for (const el of contentEditables) {
                          const htmlEl = el as HTMLElement;
                          if (htmlEl.style.width === '100%' && htmlEl.style.height === '100%') {
                            htmlEl.focus();
                            // Select all and delete preserves undo history in contentEditable
                            document.execCommand('selectAll');
                            document.execCommand('delete');
                            setFindings('');
                            break;
                          }
                        }
                      }
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(227, 103, 86, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#E36756',
                    fontSize: 14,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag'
                  }}
                >
                  🗑 Clear All
                </button>
                
              </div>
              
              {/* Spacer */}
              <div style={{ flex: 1 }} />
              
              {/* Center buttons - Report and Impression */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                <button
                  onClick={handleGenerate}
                  disabled={gptLoading || templatesLoading}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: gptLoading || templatesLoading ? 'not-allowed' : 'pointer',
                    opacity: gptLoading || templatesLoading ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag',
                    minWidth: '90px',
                    textAlign: 'center'
                  }}
                >
                  📄 Report
                </button>
                
                <button
                  onClick={handleGenerateImpression}
                  disabled={gptLoading || templatesLoading}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: gptLoading || templatesLoading ? 'not-allowed' : 'pointer',
                    opacity: gptLoading || templatesLoading ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag',
                    minWidth: '110px',
                    textAlign: 'center'
                  }}
                >
                  💭 Impression
                </button>
              </div>
              
              {/* Right section - Settings and window controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', position: 'relative', zIndex: 10 }}>
                {/* Settings Button */}
                <button
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(42, 45, 49, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    WebkitAppRegion: 'no-drag'
                  }}
                  onClick={() => setShowSettingsSidebar(true)}
                  data-settings-trigger
                >
                  ⚙️
                </button>
                
                {/* Offline Mode Indicator */}
                {isOfflineMode && (
                  <div
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(255, 165, 0, 0.9)',
                      border: '1px solid rgba(255, 165, 0, 0.3)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={`Offline mode active${lastSyncTime ? `. Last sync: ${lastSyncTime.toLocaleString()}` : '. No previous sync found.'}`}
                  >
                    🔌 Offline
                    {lastSyncTime && (
                      <span style={{ fontSize: 9, opacity: 0.8 }}>
                        ({Math.floor((Date.now() - lastSyncTime.getTime()) / (1000 * 60))}m)
                      </span>
                    )}
                  </div>
                )}
                
                {/* Window Controls */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handleContract}
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      color: '#ccc',
                      WebkitAppRegion: 'no-drag',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ▶
                  </button>
                  <button
                    onClick={handleMinimize}
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      color: '#ccc',
                      WebkitAppRegion: 'no-drag',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    －
                  </button>
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(227, 103, 86, 0.1)',
                      border: '1px solid rgba(227, 103, 86, 0.2)',
                      borderRadius: 12,
                      color: '#E36756',
                      WebkitAppRegion: 'no-drag',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
            
            {/* Main Content Area - New Layout with Left Sidebar and Right Content */}
            <div style={{
              display: 'flex',
              marginTop: 50,
              height: 'calc(100vh - 50px)',
              width: '100%'
            }}>
              {/* Left Sidebar - 25.5% width (reduced by 15%) */}
              <div style={{
                width: '25.5%',
                padding: '20px',
                background: 'rgba(30, 32, 35, 0.5)',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                overflowY: 'auto'
              }}>
                {/* Daily Tokens & Subscription Section */}
                <div style={{ width: '100%' }}>
                  <BlurCard style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 8,
                    position: 'relative',
                    width: '100%',
                    gap: 6
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                      <span style={{
                        fontSize: 11,
                        color: userTier === 3 ? '#FFD700' : userTier === 2 ? '#C0C0C0' : '#CD7F32',
                        fontWeight: 500,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {getTierLabel(userTier)} • Tier {userTier}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#aaa',
                      textAlign: 'center',
                      fontWeight: 300,
                      textShadow: 'none',
                      userSelect: 'none',
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    }}>
                      Daily tokens: {tokenUsage?.used?.toLocaleString() || 0} / {userTier === 4 ? 'Unlimited' : (tokenUsage?.limit?.toLocaleString() || 20000)}
                    </div>
                    
                    <div style={{
                      width: '100%',
                      height: 12,
                      backgroundColor: 'rgba(20, 22, 25, 0.8)',
                      borderRadius: 6,
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)'
                    }}>
                      <div
                        style={{
                          width: userTier === 4 ? '0%' : `${Math.min(tokenUsage?.percentage || 0, 100)}%`,
                          height: '100%',
                          backgroundColor: userTier === 4 ? '#9b59b6' : 
                                         (tokenUsage?.percentage || 0) > 90 ? '#E36756' :
                                         (tokenUsage?.percentage || 0) > 75 ? '#E1865D' : '#3ABC96',
                          transition: 'all 0.3s ease',
                          borderRadius: '6px 0 0 6px',
                          boxShadow: userTier === 4 ? 'none' : '0 0 12px rgba(58, 188, 150, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        }}
                      />
                    </div>
                  </BlurCard>
                </div>
                
                {/* AI Model Selector */}
                <div style={{ width: '100%' }}>
                  <div style={{
                    fontSize: 12,
                    color: '#aaa',
                    marginBottom: 8,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}>
                    AI Model
                  </div>
                  <BlurCard style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 2,
                    gap: 2
                  }}>
                    <button
                      onClick={() => handleApiProviderChange('openai')}
                      title={!isModelAvailable('openai') ? `Requires ${getTierLabel(modelTiers['openai'])} subscription` : 'GPT-4o'}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'openai' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'openai' ? '#fff' : !isModelAvailable('openai') ? '#666' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: isModelAvailable('openai') ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        opacity: isModelAvailable('openai') ? 1 : 0.5,
                        position: 'relative'
                      }}
                    >
                      GPT-4o {!isModelAvailable('openai') && <span style={{ float: 'right' }}>🔒</span>}
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('gpt-5')}
                      title={!isModelAvailable('gpt-5') ? `Requires ${getTierLabel(modelTiers['gpt-5'])} subscription` : 'GPT-5'}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'gpt-5' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'gpt-5' ? '#fff' : !isModelAvailable('gpt-5') ? '#666' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: isModelAvailable('gpt-5') ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        opacity: isModelAvailable('gpt-5') ? 1 : 0.5,
                        position: 'relative'
                      }}
                    >
                      GPT-5 {!isModelAvailable('gpt-5') && <span style={{ float: 'right' }}>🔒</span>}
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('gemini')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'gemini' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'gemini' ? '#fff' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                    >
                      Gemini 2.5 Flash
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('claude-sonnet')}
                      title={!isModelAvailable('claude-sonnet') ? `Requires ${getTierLabel(modelTiers['claude-sonnet'])} subscription` : 'Claude 4 Sonnet'}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'claude-sonnet' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'claude-sonnet' ? '#fff' : !isModelAvailable('claude-sonnet') ? '#666' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: isModelAvailable('claude-sonnet') ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        opacity: isModelAvailable('claude-sonnet') ? 1 : 0.5,
                        position: 'relative'
                      }}
                    >
                      Claude 4 Sonnet {!isModelAvailable('claude-sonnet') && <span style={{ float: 'right' }}>🔒</span>}
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('claude-opus')}
                      title={!isModelAvailable('claude-opus') ? `Requires ${getTierLabel(modelTiers['claude-opus'])} subscription` : 'Claude 4 Opus'}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'claude-opus' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'claude-opus' ? '#fff' : !isModelAvailable('claude-opus') ? '#666' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: isModelAvailable('claude-opus') ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        opacity: isModelAvailable('claude-opus') ? 1 : 0.5,
                        position: 'relative'
                      }}
                    >
                      Claude 4 Opus {!isModelAvailable('claude-opus') && <span style={{ float: 'right' }}>🔒</span>}
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('claude-opus-4.1')}
                      title={!isModelAvailable('claude-opus-4.1') ? `Requires ${getTierLabel(modelTiers['claude-opus-4.1'])} subscription` : 'Claude 4.1 Opus'}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'claude-opus-4.1' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'claude-opus-4.1' ? '#fff' : !isModelAvailable('claude-opus-4.1') ? '#666' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: isModelAvailable('claude-opus-4.1') ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        opacity: isModelAvailable('claude-opus-4.1') ? 1 : 0.5,
                        position: 'relative'
                      }}
                    >
                      Claude 4.1 Opus {!isModelAvailable('claude-opus-4.1') && <span style={{ float: 'right' }}>🔒</span>}
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('kimi')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'kimi' ? '#5F33FF' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'kimi' ? '#fff' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                    >
                      Kimi v2
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('mistral-local')}
                      title={!isModelAvailable('mistral-local') ? `Requires ${getTierLabel(modelTiers['mistral-local'])} subscription` : 'Mistral (Local)'}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: apiProvider === 'mistral-local' ? '#FF6B35' : 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: apiProvider === 'mistral-local' ? '#fff' : !isModelAvailable('mistral-local') ? '#666' : '#aaa',
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        cursor: isModelAvailable('mistral-local') ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        opacity: isModelAvailable('mistral-local') ? 1 : 0.5,
                        position: 'relative'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          Mistral (Local)
                          {!isModelAvailable('mistral-local') && <span>🔒</span>}</span>
                        {apiProvider === 'mistral-local' && (
                          <>
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: llamaServerStatus.running ? '#4CAF50' : '#f44336',
                              display: 'inline-block',
                              animation: llamaServerStatus.running ? undefined : 'pulse 1.5s infinite'
                            }} 
                            title={llamaServerStatus.running ? 'Server running' : llamaServerStatus.error || 'Server not running'}
                            />
                            {llamaServerStatus.modelMissing && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const shouldDownload = window.confirm(
                                    'Download Mistral model?\n\n' +
                                    'Size: 4.07 GB\n' +
                                    'This will download the model to enable local AI generation.\n\n' +
                                    'Continue?'
                                  );
                                  if (shouldDownload) {
                                    console.log('Starting model download...');
                                    const success = await window.electronAPI.invoke('download-mistral-model');
                                    if (success) {
                                      alert('Model downloaded successfully! Local AI is now ready.');
                                    } else {
                                      alert('Download failed. Please check your internet connection.');
                                    }
                                  }
                                }}
                                style={{
                                  marginLeft: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  backgroundColor: '#ff9800',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 3,
                                  cursor: 'pointer'
                                }}
                              >
                                Download Model (4GB)
                              </button>
                            )}
                            {apiProvider === 'mistral-local' && !hasCudaSupport && !cudaInstallStatus.installing && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const shouldInstall = window.confirm(
                                    'Enable GPU Acceleration for Offline AI?\n\n' +
                                    'Downloads CUDA binaries (~30MB) to accelerate local Mistral generation.\n' +
                                    'Makes offline AI 10x faster with NVIDIA GPU.\n\n' +
                                    'Continue?'
                                  );
                                  if (shouldInstall) {
                                    console.log('Starting CUDA binary installation...');
                                    const success = await window.electronAPI.installCudaBinary();
                                    if (success) {
                                      setHasCudaSupport(true);
                                      alert('GPU acceleration installed! Offline AI will now use your GPU for faster generation.');
                                    } else {
                                      alert('Installation failed. Please check the console for details.');
                                    }
                                  }
                                }}
                                style={{
                                  marginLeft: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 3,
                                  cursor: 'pointer'
                                }}
                                title="Enable GPU acceleration for 10x faster generation"
                              >
                                🚀 Enable GPU
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  </BlurCard>
                </div>
                
                {/* Voice Macros Button */}
                <div style={{ width: '100%', marginTop: 10 }}>
                  <button
                    onClick={() => setShowMacroManager(true)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(58, 188, 150, 0.1)',
                      border: '1px solid rgba(58, 188, 150, 0.3)',
                      borderRadius: 8,
                      color: '#3ABC96',
                      fontSize: 13,
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(58, 188, 150, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(58, 188, 150, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(58, 188, 150, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(58, 188, 150, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📝</span>
                    Voice Macros
                  </button>
                </div>
                
                {/* Study Type Selector */}
                <div style={{ width: '100%', marginTop: 10 }}>
                  <div style={{
                    fontSize: 12,
                    color: '#aaa',
                    marginBottom: 8,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}>
                    Study Type
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={studyTypeFilter || selectedStudyType}
                      onChange={(e) => {
                        const value = e.target.value
                        setStudyTypeFilter(value)
                        setShowStudyTypeDropdown(true)
                        
                        if (templates && templates[value]) {
                          setSelectedStudyType(value)
                          setSuggestedStudyTypes([])
                          setSuggestedStudyType('')
                        }
                      }}
                      onFocus={() => {
                        setShowStudyTypeDropdown(true)
                        setStudyTypeFilter('')
                      }}
                      onBlur={(e) => {
                        setTimeout(() => {
                          setShowStudyTypeDropdown(false)
                          setStudyTypeFilter('')
                        }, 200)
                      }}
                      placeholder="Select or search study type..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: 'rgba(42, 45, 49, 0.95)',
                        color: (studyTypeFilter || selectedStudyType) ? '#fff' : '#999',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        outline: 'none',
                        cursor: 'text'
                      }}
                    />
                    
                    {/* Study Type Dropdown */}
                    {showStudyTypeDropdown && templates && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        maxHeight: 200,
                        overflowY: 'auto',
                        backgroundColor: 'rgba(42, 45, 49, 0.98)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: 8,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                        zIndex: 100
                      }}>
                        {(() => {
                          const filteredTypes = Object.keys(templates)
                            .filter(type => 
                              !studyTypeFilter || 
                              type.toLowerCase().includes(studyTypeFilter.toLowerCase())
                            );
                          
                          // Separate favorites and regular types, then sort alphabetically
                          const favoriteTypes = filteredTypes.filter(type => favoriteStudyTypes.has(type)).sort();
                          const regularTypes = filteredTypes.filter(type => !favoriteStudyTypes.has(type)).sort();
                          
                          return [...favoriteTypes, ...regularTypes].map((studyType) => {
                            const isFavorite = favoriteStudyTypes.has(studyType);
                            return (
                              <div
                                key={studyType}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  color: studyType === selectedStudyType ? '#3ABC96' : '#fff',
                                  backgroundColor: studyType === selectedStudyType ? 'rgba(58, 188, 150, 0.1)' : 'transparent',
                                  fontSize: 12,
                                  fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (studyType !== selectedStudyType) {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (studyType !== selectedStudyType) {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }
                                }}
                              >
                                <div
                                  onClick={() => {
                                    setSelectedStudyType(studyType)
                                    setShowStudyTypeDropdown(false)
                                    setStudyTypeFilter('')
                                  }}
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  {studyType}
                                </div>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleFavoriteStudyType(studyType)
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    color: isFavorite ? '#FFD700' : '#666',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    transition: 'color 0.2s ease'
                                  }}
                                >
                                  {isFavorite ? '★' : '☆'}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Template Preview Box */}
                {selectedStudyType && templates && templates[selectedStudyType] && (
                  <div style={{ 
                    width: '100%', 
                    marginTop: 16,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0 // Important for flex container to allow shrinking
                  }}>
                    <div style={{
                      fontSize: 12,
                      color: '#aaa',
                      marginBottom: 8,
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                      flexShrink: 0
                    }}>
                      Template Preview
                    </div>
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      backgroundColor: 'rgba(42, 45, 49, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New, monospace',
                      color: '#ccc',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      minHeight: 0 // Important for flexbox overflow
                    }}>
                      {templates[selectedStudyType].template}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Content Area - 74.5% width (compensated for smaller left sidebar) */}
              <div style={{
                width: '74.5%',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20
              }}>
                {/* Findings Textarea - 85% height (increased since message bar is smaller) */}
                <div style={{
                  height: '85%',
                  position: 'relative'
                }}>
                  {/* Findings textarea or diff view */}
                  <div style={{
                    height: '100%',
                    background: 'rgba(42, 45, 49, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 16,
                    overflow: 'hidden'
                  }}>
                    {/* Always show rich text editor, with diff content when available */}
                    <div style={{ position: 'relative', height: '100%' }}>
                      <RichTextEditor
                        ref={richTextEditorRef}
                        value={findings}
                        onChange={handleRichTextChange}
                        placeholder="Enter findings here..."
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'transparent',
                          color: '#fff',
                          border: 'none',
                          fontSize: 14,
                          fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                        }}
                      />
                      
                      {/* Action buttons - show for both report (with diff) and impression generation */}
                      {generationResult && ((generationResult.showDiff && generationResult.diffParts) || generationResult.type === 'impression') && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          display: 'flex',
                          gap: '6px',
                          zIndex: 10
                        }}>
                          <button
                            onClick={() => {
                              // Get the HTML content and convert to text with preserved formatting
                              const htmlContent = richTextEditorRef.current?.getValue() || findings
                              
                              // Create a temporary element to extract text with line breaks
                              const temp = document.createElement('div')
                              temp.innerHTML = htmlContent
                                .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
                                .replace(/<\/p>/gi, '\n\n')      // Add double newline after paragraphs
                                .replace(/<\/div>/gi, '\n')      // Add newline after divs
                              
                              // Get text content with formatting preserved
                              const formattedText = temp.textContent || temp.innerText || ''
                              
                              navigator.clipboard.writeText(formattedText)
                            }}
                            style={{
                              background: 'rgba(58, 188, 150, 0.2)',
                              border: '1px solid rgba(58, 188, 150, 0.3)',
                              borderRadius: '6px',
                              color: '#3ABC96',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            📋 Copy
                          </button>
                          
                          <button
                            onClick={() => setShowAskAI(true)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              color: '#3B82F6',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            💬 Ask AI
                          </button>
                          
                          <button
                            onClick={() => {
                              console.log('AI Refinement button clicked');
                              setShowAIRefinement(true);
                            }}
                            style={{
                              background: 'rgba(147, 51, 234, 0.2)',
                              border: '1px solid rgba(147, 51, 234, 0.3)',
                              borderRadius: '6px',
                              color: '#9333EA',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            ✨ AI Refinement
                          </button>
                          
                          {/* Only show Remove Strikeout and Accept buttons for reports with diff */}
                          {generationResult.showDiff && generationResult.diffParts && (
                            <>
                          <button
                            onClick={() => {
                              if (!generationResult) return;
                              
                              // Remove strikeout text but keep diff highlighting for additions
                              let diffHtml = '';
                              generationResult.diffParts?.forEach(part => {
                                if (!part.removed) {
                                  let partHtml = part.value
                                    .replace(/\b(FINDINGS?:)/gi, '<strong>$1</strong>')
                                    .replace(/\b(IMPRESSION:)/gi, '<strong>$1</strong>')
                                    .replace(/\b(LEFT|RIGHT)\b/g, '<strong>$1</strong>')
                                    .replace(/\n/g, '<br>');
                                  
                                  if (part.added) {
                                    // Keep green background for added text
                                    diffHtml += `<span style="background-color: rgba(58, 188, 150, 0.3); color: #3ABC96; padding: 1px 2px; border-radius: 2px;">${partHtml}</span>`;
                                  } else {
                                    // Normal text
                                    diffHtml += partHtml;
                                  }
                                }
                              });
                              
                              // Set the HTML with green highlights preserved but strikeouts removed
                              setFindings(diffHtml);
                              
                              // Update the editor with the diff HTML (green highlights preserved)
                              if (richTextEditorRef.current) {
                                richTextEditorRef.current.setValue(diffHtml);
                              }
                              
                              // Update diff parts to remove strikeouts from the generation result
                              const updatedDiffParts = generationResult.diffParts
                                ?.filter(part => !part.removed) || [];
                              
                              setGenerationResult({
                                ...generationResult,
                                diffParts: updatedDiffParts
                              });
                            }}
                            style={{
                              background: 'rgba(227, 103, 86, 0.2)',
                              border: '1px solid rgba(227, 103, 86, 0.3)',
                              borderRadius: '6px',
                              color: '#E36756',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            ✂ Remove Strikeout
                          </button>
                          
                          <button
                            onClick={() => {
                              // Accept clean text (remove diff formatting, keep only added parts)
                              const cleanText = generationResult.diffParts
                                ?.filter(part => !part.removed)
                                .map(part => part.value)
                                .join('')
                                .trim() || '';
                              
                              // Format with bold keywords
                              const formattedText = cleanText
                                .replace(/\b(FINDINGS?:)/gi, '<strong>$1</strong>')
                                .replace(/\b(IMPRESSION:)/gi, '<strong>$1</strong>')
                                .replace(/\b(LEFT|RIGHT)\b/g, '<strong>$1</strong>')
                                .replace(/\n/g, '<br>');
                              
                              setFindings(formattedText);
                              setGenerationResult(null);
                              
                              // Update the editor with clean formatted text
                              setTimeout(() => {
                                if (richTextEditorRef.current) {
                                  richTextEditorRef.current.setValue(formattedText);
                                }
                              }, 0);
                            }}
                            style={{
                              background: 'rgba(58, 188, 150, 0.2)',
                              border: '1px solid rgba(58, 188, 150, 0.3)',
                              borderRadius: '6px',
                              color: '#3ABC96',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 500,
                              marginLeft: '8px'
                            }}
                          >
                            ✓ Accept Clean
                          </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Message Bar - Below findings (smaller height) */}
                <div style={{
                  height: '12%',
                  minHeight: '80px',
                  background: 'rgba(42, 45, 49, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: '12px 16px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  {/* Generation Status */}
                  {(agentLoading || gptLoading || generationResult) && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '8px',
                      backgroundColor: agentLoading || gptLoading ? 
                        'rgba(88, 166, 255, 0.1)' : 
                        'rgba(58, 188, 150, 0.1)',
                      border: agentLoading || gptLoading ? 
                        '1px solid rgba(88, 166, 255, 0.2)' : 
                        '1px solid rgba(58, 188, 150, 0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: agentLoading || gptLoading ? '#58A6FF' : '#3ABC96',
                      textAlign: 'center',
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}>
                      {agentLoading ? '🔄 Generating Report...' :
                       gptLoading ? '💭 Generating Impression...' :
                       generationResult ? `✅ ${generationResult.type === 'report' ? 'Report' : 'Impression'} Generated${generationResult.tokens ? ` • ${generationResult.tokens.input}→${generationResult.tokens.output} tokens • ${generationResult.generationTime}s` : ''}` :
                       '⚡ Ready'}
                    </div>
                  )}
                  
                  {/* AI Study Type Suggestions */}
                  {suggestedStudyTypes.length > 0 && (
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(95, 51, 255, 0.1)',
                      border: '1px solid rgba(95, 51, 255, 0.3)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#7C5AFF',
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: suggestedStudyTypes.length > 1 ? '8px' : 0
                      }}>
                        <span>🎯 Suggested Study Types:</span>
                        <button
                          onClick={() => {
                            setSuggestedStudyType('')
                            setSuggestedStudyTypes([])
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#7C5AFF',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '0 4px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {suggestedStudyTypes.slice(0, 3).map((suggestion, index) => (
                          <div
                            key={suggestion.type}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 8px',
                              background: index === 0 ? 'rgba(95, 51, 255, 0.15)' : 'rgba(95, 51, 255, 0.08)',
                              borderRadius: '4px',
                              border: index === 0 ? '1px solid rgba(95, 51, 255, 0.3)' : '1px solid rgba(95, 51, 255, 0.15)'
                            }}
                          >
                            <span style={{ flex: 1 }}>
                              <strong>{index + 1}. {suggestion.type}</strong>
                              <span style={{ opacity: 0.7, marginLeft: '8px', fontSize: '11px' }}>
                                ({suggestion.confidence}% match)
                              </span>
                            </span>
                            <button
                              onClick={() => {
                                setSelectedStudyType(suggestion.type)
                                setSuggestedStudyType('')
                                setSuggestedStudyTypes([])
                              }}
                              style={{
                                background: 'rgba(95, 51, 255, 0.2)',
                                border: '1px solid rgba(95, 51, 255, 0.4)',
                                borderRadius: '4px',
                                color: '#7C5AFF',
                                padding: '2px 6px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Notifications */}
                  {notification && (
                    <div style={{
                      padding: '8px',
                      backgroundColor: 'rgba(58, 188, 150, 0.1)',
                      border: '1px solid rgba(58, 188, 150, 0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#3ABC96',
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}>
                      {notification}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* OLD CONTENT - TEMPORARILY HIDDEN */}
            <div style={{ display: 'none' }}>
            {/* Token Status Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingLeft: '7.5%',
              paddingRight: '7.5%',
              width: '90%',
              margin: '0 auto',
              marginTop: 60,
              marginBottom: 15,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Empty left side to match layout */}
              </div>
              
              {/* Token Status Bar - matching model button container width */}
              <div style={{ width: '100%' }}>
                <BlurCard style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 8,
                  position: 'relative',
                  width: '100%',
                  gap: 6
                }}>
                  {/* Description text */}
                  <div style={{
                    fontSize: 12,
                    color: '#aaa',
                    textAlign: 'center',
                    fontWeight: 300,
                    textShadow: 'none',
                    userSelect: 'none',
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                  }}>
                    Daily tokens: {tokenUsage?.used?.toLocaleString() || 0} / {userTier === 4 ? 'Unlimited' : (tokenUsage?.limit?.toLocaleString() || 125000)}
                  </div>
                  
                  {/* Token status bar - fills the entire model button container width */}
                  <div style={{ 
                    width: '100%', 
                    height: windowWidth < 600 ? 8 : windowWidth < 800 ? 10 : 12, 
                    backgroundColor: 'rgba(20, 22, 25, 0.8)',
                    borderRadius: (windowWidth < 600 ? 8 : windowWidth < 800 ? 10 : 12) / 2,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    overflow: 'hidden',
                    position: 'relative',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)'
                  }}>
                    <div 
                      style={{
                        width: `${Math.min(tokenUsage?.percentage || 0, 100)}%`,
                        height: '100%',
                        backgroundColor: (tokenUsage?.percentage || 0) > 90 ? '#E36756' : 
                                       (tokenUsage?.percentage || 0) > 75 ? '#E1865D' : '#3ABC96',
                        transition: 'all 0.3s ease',
                        borderRadius: `${(windowWidth < 600 ? 8 : windowWidth < 800 ? 10 : 12) / 2}px 0 0 ${(windowWidth < 600 ? 8 : windowWidth < 800 ? 10 : 12) / 2}px`,
                        boxShadow: '0 0 12px rgba(58, 188, 150, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    />
                  </div>
                </BlurCard>
              </div>
            </div>

            {/* API Provider Toggle and Auto-pull checkbox */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingLeft: '7.5%',
                  paddingRight: '7.5%',
                  width: '90%',
                  margin: '0 auto',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag', zIndex: 1, position: 'relative' }}>
                  {/* Auto-pull button moved to sidebar */}
                </div>
                
                {/* Platform Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BlurCard style={{ 
                    display: 'flex', 
                    padding: 2
                  }}>
                    <button
                      onClick={() => handleApiProviderChange('openai')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'openai' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'openai' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'openai' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      GPT-4o
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('gpt-5')}
                      title={!isModelAvailable('gpt-5') ? `Requires ${getTierLabel(modelTiers['gpt-5'])} subscription` : 'GPT-5'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'gpt-5' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'gpt-5' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'gpt-5' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      GPT-5
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('gemini')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'gemini' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'gemini' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'gemini' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Gemini 2.5 Flash
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('claude-sonnet')}
                      title={!isModelAvailable('claude-sonnet') ? `Requires ${getTierLabel(modelTiers['claude-sonnet'])} subscription` : 'Claude 4 Sonnet'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'claude-sonnet' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'claude-sonnet' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'claude-sonnet' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Claude 4 Sonnet
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('claude-opus')}
                      title={!isModelAvailable('claude-opus') ? `Requires ${getTierLabel(modelTiers['claude-opus'])} subscription` : 'Claude 4 Opus'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'claude-opus' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'claude-opus' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'claude-opus' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Claude 4 Opus
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('claude-opus-4.1')}
                      title={!isModelAvailable('claude-opus-4.1') ? `Requires ${getTierLabel(modelTiers['claude-opus-4.1'])} subscription` : 'Claude 4.1 Opus'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'claude-opus-4.1' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'claude-opus-4.1' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'claude-opus-4.1' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Claude 4.1 Opus
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('kimi')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'kimi' ? '#5F33FF' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'kimi' ? '0 4px 12px rgba(95, 51, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'kimi' ? {
                          background: 'linear-gradient(135deg, #5F33FF 0%, #4a28cc 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Kimi v2
                    </button>
                    <button
                      onClick={() => handleApiProviderChange('mistral-local')}
                      title={!isModelAvailable('mistral-local') ? `Requires ${getTierLabel(modelTiers['mistral-local'])} subscription` : 'Mistral (Local)'}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: apiProvider === 'mistral-local' ? '#FF6B35' : 'transparent',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: apiProvider === 'mistral-local' ? '0 4px 12px rgba(255, 107, 53, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                        ...(apiProvider === 'mistral-local' ? {
                          background: 'linear-gradient(135deg, #FF6B35 0%, #cc5529 100%)',
                          color: '#fff',
                          textShadow: 'none',
                        } : {
                          background: 'linear-gradient(to bottom, #ffffff, #999999, #333333)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: 'none',
                        }),
                        borderRadius: 16,
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Mistral (Local)
                        {apiProvider === 'mistral-local' && (
                          <>
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: llamaServerStatus.running ? '#4CAF50' : '#f44336',
                              display: 'inline-block',
                              animation: llamaServerStatus.running ? undefined : 'pulse 1.5s infinite'
                            }} 
                            title={llamaServerStatus.running ? 'Server running' : llamaServerStatus.error || 'Server not running'}
                            />
                            {llamaServerStatus.modelMissing && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const shouldDownload = window.confirm(
                                    'Download Mistral model?\n\n' +
                                    'Size: 4.07 GB\n' +
                                    'This will download the model to enable local AI generation.\n\n' +
                                    'Continue?'
                                  );
                                  if (shouldDownload) {
                                    console.log('Starting model download...');
                                    const success = await window.electronAPI.invoke('download-mistral-model');
                                    if (success) {
                                      alert('Model downloaded successfully! Local AI is now ready.');
                                    } else {
                                      alert('Download failed. Please check your internet connection.');
                                    }
                                  }
                                }}
                                style={{
                                  marginLeft: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  backgroundColor: '#ff9800',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 3,
                                  cursor: 'pointer'
                                }}
                              >
                                Download Model (4GB)
                              </button>
                            )}
                            {apiProvider === 'mistral-local' && !hasCudaSupport && !cudaInstallStatus.installing && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const shouldInstall = window.confirm(
                                    'Enable GPU Acceleration for Offline AI?\n\n' +
                                    'Downloads CUDA binaries (~30MB) to accelerate local Mistral generation.\n' +
                                    'Makes offline AI 10x faster with NVIDIA GPU.\n\n' +
                                    'Continue?'
                                  );
                                  if (shouldInstall) {
                                    console.log('Starting CUDA binary installation...');
                                    const success = await window.electronAPI.installCudaBinary();
                                    if (success) {
                                      setHasCudaSupport(true);
                                      alert('GPU acceleration installed! Offline AI will now use your GPU for faster generation.');
                                    } else {
                                      alert('Installation failed. Please check the console for details.');
                                    }
                                  }
                                }}
                                style={{
                                  marginLeft: 4,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 3,
                                  cursor: 'pointer'
                                }}
                                title="Enable GPU acceleration for 10x faster generation"
                              >
                                🚀 Enable GPU
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  </BlurCard>
                </div>
                
                {/* Voice Macros Button */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  marginTop: 12,
                  marginBottom: 12
                }}>
                  <button
                    onClick={() => setShowMacroManager(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(58, 188, 150, 0.1)',
                      border: '1px solid rgba(58, 188, 150, 0.3)',
                      borderRadius: 16,
                      color: '#3ABC96',
                      fontSize: 14,
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      backdropFilter: 'blur(12px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(12px) saturate(180%)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(58, 188, 150, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(58, 188, 150, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(58, 188, 150, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(58, 188, 150, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📝</span>
                    Voice Macros
                  </button>
                </div>
                
                {/* Clear All Button */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 0
                }}>
                  <button
                    onClick={() => {
                      setSelectedStudyType('')
                      if (richTextEditorRef.current) {
                        richTextEditorRef.current.setValue('')
                      }
                      setFindings('')
                      setSuggestedStudyTypes([])
                      setSuggestedStudyType('')
                      setGenerationResult(null) // Exit diff view mode when clearing
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: (!selectedStudyType && !findings) ? 'transparent' : 'rgba(227, 103, 86, 0.1)',
                      backdropFilter: 'blur(12px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: (!selectedStudyType && !findings) ? '0 2px 6px rgba(0, 0, 0, 0.1)' : '0 4px 12px rgba(227, 103, 86, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      borderRadius: 16,
                      fontSize: 14,
                      fontWeight: 300,
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                      transition: 'all 0.2s ease',
                      color: (!selectedStudyType && !findings) ? '#666' : '#E36756',
                      cursor: (!selectedStudyType && !findings) ? 'not-allowed' : 'pointer',
                      opacity: (!selectedStudyType && !findings) ? 0.4 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (selectedStudyType || findings) {
                        e.currentTarget.style.backgroundColor = 'rgba(227, 103, 86, 0.2)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(227, 103, 86, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStudyType || findings) {
                        e.currentTarget.style.backgroundColor = 'rgba(227, 103, 86, 0.1)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(227, 103, 86, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      }
                    }}
                    disabled={!selectedStudyType && !findings}
                    title="Clear both study type and findings"
                  >
                    Clear All
                  </button>
                </div>
                
              </div>

              {/* Study Type Dropdown */}
              <div
                style={{
                  position: 'relative',
                  width: '90%',
                  margin: '0 auto 20px auto',
                  opacity: 1,
                  maxHeight: 100,
                  overflow: 'visible',
                  transition: 'all 0.3s ease',
                  pointerEvents: 'auto'
                }}
              >
                <input
                  value={studyTypeFilter || selectedStudyType}
                  onChange={(e) => {
                    const value = e.target.value
                    setStudyTypeFilter(value)
                    setShowStudyTypeDropdown(true)
                    
                    // If exact match found, select it
                    if (templates && templates[value]) {
                      setSelectedStudyType(value)
                      setSuggestedStudyTypes([])
                      setSuggestedStudyType('')
                    }
                  }}
                  onFocus={() => {
                    setShowStudyTypeDropdown(true)
                    setStudyTypeFilter('')
                  }}
                  onBlur={(e) => {
                    // Delay hiding to allow click on dropdown items
                    setTimeout(() => {
                      setShowStudyTypeDropdown(false)
                      setStudyTypeFilter('')
                    }, 200)
                  }}
                  placeholder="Select or search study type..."
                  style={{
                    width: '100%',
                    padding: '12px 70px 12px 16px', // Add right padding for both buttons
                    backgroundColor: 'rgba(42, 45, 49, 0.95)',
                    color: (studyTypeFilter || selectedStudyType) ? '#fff' : '#999',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    fontFamily: 'DM Sans, sans-serif',
                    outline: 'none',
                    cursor: 'text',
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                  }}
                />
                
                {/* Custom Dropdown Menu */}
                {showStudyTypeDropdown && templates && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    maxHeight: 300,
                    overflowY: 'auto',
                    backgroundColor: 'rgba(42, 45, 49, 0.98)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    zIndex: 100
                  }}>
                    {(() => {
                      // Filter study types based on search
                      const filteredTypes = Object.keys(templates)
                        .filter(type => 
                          !studyTypeFilter || 
                          type.toLowerCase().includes(studyTypeFilter.toLowerCase())
                        )
                      
                      // Separate favorites and non-favorites
                      const favoriteTypes = filteredTypes.filter(type => favoriteStudyTypes.has(type)).sort()
                      const regularTypes = filteredTypes.filter(type => !favoriteStudyTypes.has(type)).sort()
                      
                      // Combine with favorites first
                      const allTypes = [...favoriteTypes, ...regularTypes]
                      
                      return (
                        <>
                          {favoriteTypes.length > 0 && !studyTypeFilter && (
                            <div style={{
                              padding: '6px 16px',
                              color: '#FFA500',
                              fontSize: 12,
                              fontWeight: 600,
                              borderBottom: '1px solid rgba(255, 165, 0, 0.2)',
                              backgroundColor: 'rgba(255, 165, 0, 0.05)'
                            }}>
                              ★ FAVORITES
                            </div>
                          )}
                          {allTypes.map((studyType, index) => {
                            const isFavorite = favoriteStudyTypes.has(studyType)
                            const showDivider = !studyTypeFilter && isFavorite && index === favoriteTypes.length - 1 && regularTypes.length > 0
                            
                            return (
                              <React.Fragment key={studyType}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px 16px',
                                    color: studyType === selectedStudyType ? '#3ABC96' : '#fff',
                                    backgroundColor: studyType === selectedStudyType ? 'rgba(58, 188, 150, 0.1)' : 'transparent',
                                    fontSize: 14,
                                    fontFamily: 'DM Sans, sans-serif',
                                    transition: 'background-color 0.2s ease',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                    cursor: 'pointer'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (studyType !== selectedStudyType) {
                                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (studyType !== selectedStudyType) {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                    }
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleFavoriteStudyType(studyType)
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: isFavorite ? '#FFA500' : '#666',
                                      fontSize: 16,
                                      cursor: 'pointer',
                                      padding: '0 8px 0 0',
                                      transition: 'color 0.2s ease',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = isFavorite ? '#FFB833' : '#FFA500'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = isFavorite ? '#FFA500' : '#666'
                                    }}
                                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                  >
                                    {isFavorite ? '★' : '☆'}
                                  </button>
                                  <div
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                      setSelectedStudyType(studyType)
                                      setStudyTypeFilter('')
                                      setShowStudyTypeDropdown(false)
                                      setSuggestedStudyTypes([])
                                      setSuggestedStudyType('')
                                      lastSuggestionTimeRef.current = Date.now()
                                    }}
                                  >
                                    {studyType}
                                    {studyType === selectedStudyType && (
                                      <span style={{ marginLeft: 8, color: '#3ABC96' }}>✓</span>
                                    )}
                                  </div>
                                </div>
                                {showDivider && (
                                  <div style={{
                                    padding: '6px 16px',
                                    color: '#999',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                                  }}>
                                    ALL STUDY TYPES
                                  </div>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </>
                      )
                    })()}
                    {Object.keys(templates).filter(type => 
                      !studyTypeFilter || 
                      type.toLowerCase().includes(studyTypeFilter.toLowerCase())
                    ).length === 0 && (
                      <div style={{
                        padding: '12px 16px',
                        color: '#999',
                        fontSize: 14,
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        No matching study types
                      </div>
                    )}
                  </div>
                )}

                {/* View Template button */}
                {selectedStudyType && templates[selectedStudyType] && (
                  <button
                    onClick={() => {
                      // Open template viewer window
                      const templateData = templates[selectedStudyType];
                      window.electron?.ipcRenderer?.invoke('open-template-viewer', {
                        studyType: selectedStudyType,
                        template: templateData.template || ''
                      });
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 40,
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#3ABC96',
                      fontSize: 18,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      lineHeight: 1,
                      transition: 'all 0.2s ease',
                      zIndex: 2
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#4ACC96'
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#3ABC96'
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
                    }}
                    title="View Template"
                    aria-label="View template for selected study type"
                  >
                    📄
                  </button>
                )}

                {/* Clear button for study type */}
                {selectedStudyType && (
                  <button
                    onClick={() => {
                      setSelectedStudyType('')
                      setStudyTypeFilter('')
                      setShowStudyTypeDropdown(false)
                      setSuggestedStudyTypes([])
                      setSuggestedStudyType('')
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 12,
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#999',
                      fontSize: 20,
                      fontWeight: 300,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      lineHeight: 1,
                      transition: 'color 0.2s ease',
                      zIndex: 2
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#999'
                    }}
                    className={styles.clearButton}
                    aria-label="Clear study type"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Findings textarea */}
              <div
                style={{
                  maxHeight: 500,
                  opacity: 1,
                  overflow: 'visible',
                  transition: 'all 0.3s ease',
                  marginBottom: 20,
                  pointerEvents: 'auto',
                  width: '90%',
                  margin: '0 auto'
                }}
              >
                <div style={{ 
                  position: 'relative',
                  background: 'rgba(42, 45, 49, 0.95)',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  overflow: 'hidden'
                }}>
                
                  {/* Auto-suggestion UI - moved to top-right of findings area */}
                  {(suggestedStudyTypes.length > 0 || isGeneratingSuggestion) && !selectedStudyType && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        maxWidth: 300,
                        background: 'rgba(58, 188, 150, 0.1)',
                        border: '1px solid rgba(58, 188, 150, 0.3)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        color: '#3ABC96',
                        fontSize: 12,
                        fontWeight: 500,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        zIndex: 10,
                      }}
                    >
                      {isGeneratingSuggestion ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <div 
                            style={{ 
                              width: 12, 
                              height: 12, 
                              border: '2px solid rgba(58, 188, 150, 0.3)',
                              borderTop: '2px solid #3ABC96',
                              borderRadius: '50%'
                            }}
                            className={styles.spin}
                          />
                          Analyzing findings...
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '4px'
                            }}
                          >
                            <span>🤖 AI Suggestions:</span>
                            <button
                              onClick={() => {
                                setSuggestedStudyTypes([])
                                setSuggestedStudyType('')
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(58, 188, 150, 0.7)',
                                fontSize: 10,
                                cursor: 'pointer',
                                padding: '2px'
                              }}
                            >
                              ×
                            </button>
                          </div>
                          {suggestedStudyTypes.map((suggestion, index) => (
                            <div
                              key={suggestion.type}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 6px',
                                background: index === 0 ? 'rgba(58, 188, 150, 0.15)' : 'rgba(58, 188, 150, 0.05)',
                                borderRadius: '4px',
                                fontSize: '11px'
                              }}
                            >
                              <span style={{ flex: 1 }}>
                                <strong>{suggestion.type}</strong>
                                <span style={{ opacity: 0.7, marginLeft: '6px' }}>
                                  ({suggestion.confidence}%)
                                </span>
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedStudyType(suggestion.type)
                                  setSuggestedStudyTypes([])
                                  setSuggestedStudyType('')
                                }}
                                style={{
                                  background: 'rgba(58, 188, 150, 0.2)',
                                  border: '1px solid rgba(58, 188, 150, 0.3)',
                                  borderRadius: 3,
                                  color: '#3ABC96',
                                  fontSize: 9,
                                  padding: '2px 5px',
                                  cursor: 'pointer',
                                  marginLeft: '8px'
                                }}
                              >
                                Use
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Always use RichTextEditor with diff content rendered inside */}
                  <RichTextEditor
                    ref={richTextEditorRef}
                    value={findings}
                    onChange={handleRichTextChange}
                    style={{
                      width: '100%',
                      height: '40vh',
                      minHeight: 200,
                      maxHeight: '50vh',
                      padding: '16px 40px 16px 16px',
                      backgroundColor: 'transparent',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 16,
                      fontSize: 14,
                      fontFamily: 'DM Sans, sans-serif'
                    }}
                    placeholder="Enter findings here..."
                  />


                  {/* Dictation Button */}
                  <button
                    onMouseDown={(e) => e.preventDefault()}   // keeps focus in editor
                    onPointerDown={(e) => e.preventDefault()} // touch/pen too
                    onClick={handleDictationToggle}
                    style={{
                      position: 'absolute',
                      top: findings ? 54 : 16,
                      right: 16,
                      background: isRecording ? 'rgba(227, 103, 86, 0.2)' : 'rgba(58, 188, 150, 0.1)',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      color: isRecording ? '#E36756' : '#3ABC96',
                      border: `1px solid ${isRecording ? 'rgba(227, 103, 86, 0.3)' : 'rgba(58, 188, 150, 0.2)'}`,
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      fontSize: 16,
                      fontWeight: 300,
                      fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      boxShadow: isRecording ? 
                        '0 2px 6px rgba(227, 103, 86, 0.3), 0 0 10px rgba(227, 103, 86, 0.2)' : 
                        '0 1px 3px rgba(58, 188, 150, 0.2)',
                      animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isRecording) {
                        e.currentTarget.style.background = 'rgba(227, 103, 86, 0.3)'
                        e.currentTarget.style.borderColor = 'rgba(227, 103, 86, 0.4)'
                        e.currentTarget.style.boxShadow = '0 3px 8px rgba(227, 103, 86, 0.4), 0 0 15px rgba(227, 103, 86, 0.3)'
                      } else {
                        e.currentTarget.style.background = 'rgba(58, 188, 150, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(58, 188, 150, 0.3)'
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(58, 188, 150, 0.3)'
                      }
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isRecording ? 'rgba(227, 103, 86, 0.2)' : 'rgba(58, 188, 150, 0.1)'
                      e.currentTarget.style.borderColor = isRecording ? 'rgba(227, 103, 86, 0.3)' : 'rgba(58, 188, 150, 0.2)'
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = isRecording ? 
                        '0 2px 6px rgba(227, 103, 86, 0.3), 0 0 10px rgba(227, 103, 86, 0.2)' : 
                        '0 1px 3px rgba(58, 188, 150, 0.2)'
                    }}
                    aria-label={isRecording ? "Stop dictation" : "Start dictation"}
                    title={isRecording ? "Stop dictation" : "Start dictation"}
                  >
                    🎙️
                  </button>


                  {findings && (
                    <button
                      onClick={() => {
                        if (richTextEditorRef.current) {
                          richTextEditorRef.current.setValue('')
                        }
                        setFindings('')
                        setGenerationResult(null) // Exit diff view mode when clearing
                      }}
                      style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'transparent',
                        color: '#E36756',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 300,
                        fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                        /* cursor removed */
                        padding: 0,
                        lineHeight: 1,
                        transition: 'transform 0.2s ease',
                      }}
                      className={styles.clearButton}
                      aria-label="Clear findings"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Dictation Error Display */}
              {dictationError && (
                <div style={{
                  padding: '8px 12px',
                  margin: '8px 0',
                  backgroundColor: 'rgba(227, 103, 86, 0.1)',
                  border: '1px solid rgba(227, 103, 86, 0.3)',
                  borderRadius: '8px',
                  color: '#E36756',
                  fontSize: '12px',
                  fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                  textAlign: 'center'
                }}>
                  ⚠️ {dictationError}
                  <button
                    onClick={() => setDictationError(null)}
                    style={{
                      marginLeft: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#E36756',
                      fontSize: '12px',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* Cleanup Error Display */}
              {cleanupError && (
                <div style={{
                  padding: '8px 12px',
                  margin: '8px 0',
                  backgroundColor: 'rgba(227, 103, 86, 0.1)',
                  border: '1px solid rgba(227, 103, 86, 0.3)',
                  borderRadius: '8px',
                  color: '#E36756',
                  fontSize: '12px',
                  fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                  textAlign: 'center'
                }}>
                  🧠 {cleanupError}
                  <button
                    onClick={() => setCleanupError(null)}
                    style={{
                      marginLeft: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#E36756',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* Auto-cleanup indicator */}
              {isAutoCleaningUp && (
                <div style={{
                  padding: '8px 12px',
                  margin: '8px 0',
                  backgroundColor: 'rgba(95, 51, 255, 0.1)',
                  border: '1px solid rgba(95, 51, 255, 0.3)',
                  borderRadius: '8px',
                  color: '#7C5AFF',
                  fontSize: '12px',
                  fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                  textAlign: 'center',
                  animation: 'pulse 1.5s infinite'
                }}>
                  🧠 Auto-cleaning up text...
                </div>
              )}

              {/* Generation Result Actions - For both report and impression generation */}
              {generationResult && (generationResult.type === 'report' || generationResult.type === 'impression') && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '16px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <BlurCard>
                    <button
                      onClick={() => {
                        // Get the HTML content and convert to text with preserved formatting
                        const htmlContent = richTextEditorRef.current?.getValue() || findings
                        
                        // Create a temporary element to extract text with line breaks
                        const temp = document.createElement('div')
                        temp.innerHTML = htmlContent
                          .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
                          .replace(/<\/p>/gi, '\n\n')      // Add double newline after paragraphs
                          .replace(/<\/div>/gi, '\n')      // Add newline after divs
                        
                        // Get text content with formatting preserved
                        const formattedText = temp.textContent || temp.innerText || ''
                        
                        navigator.clipboard.writeText(formattedText)
                      }}
                      style={{
                        background: 'rgba(58, 188, 150, 0.2)',
                        border: '1px solid rgba(58, 188, 150, 0.3)',
                        borderRadius: '8px',
                        color: '#3ABC96',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      ↗ Copy to Clipboard
                    </button>
                  </BlurCard>

                  <BlurCard>
                    <button
                      onClick={() => setShowAskAI(true)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        color: '#3B82F6',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      💬 Ask AI
                    </button>
                  </BlurCard>

                  <BlurCard>
                    <button
                      onClick={() => setShowAIRefinement(true)}
                      style={{
                        background: 'rgba(147, 51, 234, 0.2)',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        borderRadius: '8px',
                        color: '#9333EA',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      ✨ AI Refinement
                    </button>
                  </BlurCard>

                  {/* Only show Remove Strikeout button for reports with diff */}
                  {generationResult && generationResult.showDiff && generationResult.diffParts && (
                  <BlurCard>
                    <button
                      onClick={() => {
                        if (!generationResult) {
                          console.log('❌ No generation result for strikeout removal');
                          return;
                        }
                        
                        // Remove strikeout text but keep diff highlighting for additions
                        let diffHtml = '';
                        generationResult.diffParts?.forEach(part => {
                          if (!part.removed) {
                            let partHtml = part.value
                              .replace(/\b(FINDINGS?:)/gi, '<strong>$1</strong>')
                              .replace(/\b(IMPRESSION:)/gi, '<strong>$1</strong>')
                              .replace(/\b(LEFT|RIGHT)\b/g, '<strong>$1</strong>')
                              .replace(/\n/g, '<br>');
                            
                            if (part.added) {
                              // Keep green background for added text
                              diffHtml += `<span style="background-color: rgba(58, 188, 150, 0.3); color: #3ABC96; padding: 1px 2px; border-radius: 2px;">${partHtml}</span>`;
                            } else {
                              // Normal text
                              diffHtml += partHtml;
                            }
                          }
                        });
                        
                        // Set the HTML with green highlights preserved but strikeouts removed
                        setFindings(diffHtml);
                        
                        // Update the editor with the diff HTML (green highlights preserved)
                        if (richTextEditorRef.current) {
                          richTextEditorRef.current.setValue(diffHtml);
                        }
                        
                        // Update diff parts to remove strikeouts from the generation result
                        const updatedDiffParts = generationResult.diffParts
                          ?.filter(part => !part.removed) || [];
                        
                        setGenerationResult({
                          ...generationResult,
                          diffParts: updatedDiffParts
                        });
                      }}
                      style={{
                        background: 'rgba(227, 103, 86, 0.2)',
                        border: '1px solid rgba(227, 103, 86, 0.3)',
                        borderRadius: '8px',
                        color: '#E36756',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      ✂ Remove Strikeout
                    </button>
                    <button
                      onClick={() => {
                        // Accept clean text (remove diff formatting, keep only added parts)
                        const cleanText = generationResult.diffParts
                          ?.filter(part => !part.removed)
                          .map(part => part.value)
                          .join('')
                          .trim() || '';
                        
                        // Format with bold keywords
                        const formattedText = cleanText
                          .replace(/\b(FINDINGS?:)/gi, '<strong>$1</strong>')
                          .replace(/\b(IMPRESSION:)/gi, '<strong>$1</strong>')
                          .replace(/\b(LEFT|RIGHT)\b/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br>');
                        
                        setFindings(formattedText);
                        setGenerationResult(null);
                        
                        // Update the editor with clean formatted text
                        setTimeout(() => {
                          if (richTextEditorRef.current) {
                            richTextEditorRef.current.setValue(formattedText);
                          }
                        }, 0);
                      }}
                      style={{
                        background: 'rgba(58, 188, 150, 0.2)',
                        border: '1px solid rgba(58, 188, 150, 0.3)',
                        borderRadius: '8px',
                        color: '#3ABC96',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 500,
                        marginLeft: '8px'
                      }}
                    >
                      ✓ Accept Clean
                    </button>
                  </BlurCard>
                  )}

                </div>
              )}

              {/* Generation Status - Always Visible */}
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: agentLoading || gptLoading ? 
                  'rgba(88, 166, 255, 0.1)' : 
                  generationResult ? 
                    'rgba(58, 188, 150, 0.1)' : 
                    'rgba(255, 255, 255, 0.05)',
                border: agentLoading || gptLoading ? 
                  '1px solid rgba(88, 166, 255, 0.2)' : 
                  generationResult ? 
                    '1px solid rgba(58, 188, 150, 0.2)' : 
                    '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '12px',
                color: agentLoading || gptLoading ? 
                  '#58A6FF' : 
                  generationResult ? 
                    '#3ABC96' : 
                    '#999',
                textAlign: 'center',
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                transition: 'all 0.3s ease'
              }}>
                {agentLoading ? (
                  <div>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>🔄 Generating Report...</strong>
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      Processing findings with AI logic
                    </div>
                  </div>
                ) : gptLoading ? (
                  <div>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>💭 Generating Impression...</strong>
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      Creating clinical impression
                    </div>
                  </div>
                ) : generationResult ? (
                  <div>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>{generationResult.type === 'report' ? '📄 Report' : '💭 Impression'} Generated</strong>
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      ⏱ {generationResult.generationTime}s • 
                      🎯 {generationResult.tokens.total} tokens 
                      ({generationResult.tokens.input} in, {generationResult.tokens.output} out)
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>⚡ Ready to Generate</strong>
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      Click Report or Impression to begin
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div
                className="button-row"
                style={{
                  marginBottom: 0,
                  transition: 'margin-bottom 0.3s ease',
                  gap: 16
                }}
              >
                <button
                  onClick={handleGenerate}
                  disabled={gptLoading || templatesLoading}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)',
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 16,
                    fontSize: 14,
                    fontWeight: 300,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(58, 188, 150, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    width: 120,
                    opacity: gptLoading || templatesLoading ? 0.5 : 1,
                    pointerEvents: gptLoading || templatesLoading ? 'none' : 'auto',
                    transition: 'all 0.2s ease',
                    transform: 'translateY(0)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!gptLoading && !templatesLoading) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #2a9b7a 0%, #238463 100%)'
                      e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(58, 188, 150, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!gptLoading && !templatesLoading) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(58, 188, 150, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  Report
                </button>
                
                <button
                  onClick={handleGenerateImpression}
                  disabled={gptLoading || templatesLoading}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)',
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 16,
                    fontSize: 14,
                    fontWeight: 300,
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, sans-serif',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(58, 188, 150, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    width: 120,
                    opacity: gptLoading || templatesLoading ? 0.5 : 1,
                    pointerEvents: gptLoading || templatesLoading ? 'none' : 'auto',
                    transition: 'all 0.2s ease',
                    transform: 'translateY(0)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!gptLoading && !templatesLoading) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #2a9b7a 0%, #238463 100%)'
                      e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(58, 188, 150, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!gptLoading && !templatesLoading) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(58, 188, 150, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  Impression
                </button>
              </div>

              {/* Debug panel */}
              {showDebug && (
                <div className="card">
                  <h3>🧠 Prompt Sent to GPT:</h3>
                  <pre>{debugPrompt}</pre>
                  <h3>📥 Raw GPT Response:</h3>
                  <pre>{debugResult}</pre>
                </div>
              )}

              {/* Color scheme toggle removed - using single theme */}

            <DictationModal
              visible={showDictationModal}
              selected={selectedDictation}
              onSelect={(value) => {
                setSelectedDictation(value)
                localStorageCache.setItem('dictationTarget', value)
                window?.electron?.ipcRenderer?.invoke('set-dictation-target', value)
              }}
              onClose={() => {
                setShowDictationModal(false)
              }}
              onCancel={() => {
                setShowDictationModal(false)
              }}
            />
            
            {/* Close the hidden old content div */}
            </div>

            <ShortcutManager
              visible={showShortcutManager}
              onClose={() => setShowShortcutManager(false)}
            />
            
            
          </div>
        )}

        {/* Contracted State - Show topbar with mini buttons and dropdown settings */}
        {isContracted && (
          <div 
            style={{
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              boxSizing: 'border-box',
              overflow: 'visible',
              position: 'relative'
            }}
          >
            {/* Draggable Area for Contracted State */}
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 80,
                right: 160,
                height: 50,
                WebkitAppRegion: 'drag',
                pointerEvents: 'none',
                zIndex: -1
              }}
              onDoubleClick={(e) => e.preventDefault()}
            />

            {/* Left Side: Mini Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag', zIndex: 1002 }}>
              {/* Mini Report Button */}
              <button
                className="radpal-button-report radpal-button-mini"
                onClick={handleGenerate}
                disabled={gptLoading || templatesLoading}
                style={{
                  padding: '2px 6px',
                  fontSize: 11,
                  lineHeight: 1.1,
                  color: '#fff',
                  fontFamily: 'SF Pro, system-ui, sans-serif',
                  fontWeight: 400,
                  opacity: gptLoading || templatesLoading ? 0.5 : 1,
                  pointerEvents: gptLoading || templatesLoading ? 'none' : 'auto'
                }}
              >
                Report
              </button>

              {/* Mini Impression Button */}
              <button
                className="radpal-button-impression radpal-button-mini"
                onClick={handleGenerateImpression}
                disabled={gptLoading || templatesLoading}
                style={{
                  padding: '2px 6px',
                  fontSize: 11,
                  lineHeight: 1.1,
                  color: '#fff',
                  fontFamily: 'SF Pro, system-ui, sans-serif',
                  fontWeight: 400,
                  opacity: gptLoading || templatesLoading ? 0.5 : 1,
                  pointerEvents: gptLoading || templatesLoading ? 'none' : 'auto'
                }}
              >
                Impression
              </button>
            </div>

            {/* Right Side: Window Controls */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', WebkitAppRegion: 'no-drag', zIndex: 1002 }}>
              <button
                onClick={handleExpand}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 16,
                  padding: '4px 10px',
                  color: '#ccc',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.color = '#ccc'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
              >
                +
              </button>
              <button
                onClick={handleMinimize}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 16,
                  padding: '4px 10px',
                  color: '#ccc',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.color = '#ccc'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
              >
                –
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: 'linear-gradient(135deg, #E36756 0%, #c85545 100%)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: '4px 10px',
                  color: '#fff',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 6px rgba(227, 103, 86, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #c85545 0%, #b04436 100%)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(227, 103, 86, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #E36756 0%, #c85545 100%)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(227, 103, 86, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        {/* Settings Sidebar - Always available in both contracted and normal states */}
        {showSettingsSidebar && (
          <>
            <div 
              className={`settings-sidebar-overlay ${showSettingsSidebar ? 'open' : ''}`}
              onClick={() => setShowSettingsSidebar(false)}
            />
            <div className={`settings-sidebar ${showSettingsSidebar ? 'open' : ''}`}>
              <div className="settings-sidebar-header">
                <h2 className="settings-sidebar-title">Settings</h2>
                <button
                  className="settings-sidebar-close"
                  onClick={() => setShowSettingsSidebar(false)}
                >
                  ×
                </button>
              </div>
              <div className="settings-sidebar-content">
                <button 
                  className="settings-sidebar-item"
                  onClick={() => {
                    window.electron?.ipcRenderer?.send('open-popup-templates', { isOfflineMode });
                  }}
                >
                  ※ Manage Templates
                </button>
                <button
                  className="settings-sidebar-item"
                  onClick={() => {
                    setShowMacroManager(true);
                  }}
                >
                  📝 Voice Macros
                </button>
                <button 
                  className="settings-sidebar-item"
                  onClick={() => {
                    setShowLogicEditor(true);
                    setShowSettingsSidebar(false);
                  }}
                >
                  ⚡ Edit Logic
                </button>
                
                {/* Backup & Restore Section */}
                <div className="settings-sidebar-section" style={{ marginTop: '20px', marginBottom: '10px' }}>
                  <h3 className="settings-sidebar-section-title" style={{
                    margin: '0 0 12px 0',
                    padding: '8px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}>
                    Backup & Restore
                  </h3>
                  <button 
                    className={`settings-sidebar-item ${userTier < 4 ? 'disabled' : ''}`}
                    onClick={userTier >= 4 ? handleViewOfflineData : undefined}
                    disabled={userTier < 4}
                    title={userTier < 4 ? 'Requires Developer tier' : 'View Offline Data'}
                    style={{
                      opacity: userTier < 4 ? 0.5 : 1,
                      cursor: userTier < 4 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    👁️ View Offline Data {userTier < 4 && '🔒'}
                  </button>
                  <button 
                    className={`settings-sidebar-item ${userTier < 4 ? 'disabled' : ''}`}
                    onClick={userTier >= 4 ? handleBackupData : undefined}
                    disabled={userTier < 4}
                    title={userTier < 4 ? 'Requires Developer tier' : 'Export Backup'}
                    style={{
                      opacity: userTier < 4 ? 0.5 : 1,
                      cursor: userTier < 4 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    💾 Export Backup {userTier < 4 && '🔒'}
                  </button>
                  <button 
                    className={`settings-sidebar-item ${userTier < 4 ? 'disabled' : ''}`}
                    onClick={userTier >= 4 ? handleRestoreData : undefined}
                    disabled={userTier < 4}
                    title={userTier < 4 ? 'Requires Developer tier' : 'Import Backup'}
                    style={{
                      opacity: userTier < 4 ? 0.5 : 1,
                      cursor: userTier < 4 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    📥 Import Backup {userTier < 4 && '🔒'}
                  </button>
                </div>
                
                {/* Other Settings Section */}
                <div className="settings-sidebar-section">
                  <button 
                    className="settings-sidebar-item"
                    onClick={() => {
                      setShowShortcutManager(true);
                    }}
                  >
                    ⌨️ Keyboard Shortcuts
                  </button>
                  <button 
                    className={`settings-sidebar-item ${isOfflineMode ? 'active' : ''} ${userTier < 4 ? 'disabled' : ''}`}
                    onClick={userTier >= 4 ? () => {
                      const newMode = !isOfflineMode;
                      setIsOfflineMode(newMode);
                      localStorage.setItem('radpal_offline_mode', newMode.toString());
                      showNotification(newMode ? '🔌 Offline mode enabled' : '🌐 Online mode enabled');
                    } : undefined}
                    disabled={userTier < 4}
                    title={userTier < 4 ? 'Requires Developer tier' : 'Toggle offline mode'}
                    style={{
                      opacity: userTier < 4 ? 0.5 : 1,
                      cursor: userTier < 4 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isOfflineMode ? '🔌 Offline Mode' : '🌐 Online Mode'} {userTier < 4 && '🔒'}
                  </button>
                  <button 
                    className="settings-sidebar-item danger"
                    onClick={() => {
                      handleSettingsAction('logout');
                    }}
                  >
                    → Log Out
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Debug Panel - only show when debug is active */}
        {showDebug && (
          <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'rgba(20, 20, 20, 0.95)',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '12px',
            color: '#fff',
            fontSize: 12,
            maxWidth: 300,
            zIndex: 10000
          }}>
            <div>API Provider: {apiProvider}</div>
            <div>Window Size: {windowWidth}px</div>
            <div>User: {user?.email || 'Not logged in'}</div>
            <div>Templates Loading: {templatesLoading ? 'Yes' : 'No'}</div>
            <div>GPT Loading: {gptLoading ? 'Yes' : 'No'}</div>
            <div>Contracted: {isContracted ? 'Yes' : 'No'}</div>
          </div>
        )}

        {/* Modal Components */}
        {!isContracted && (
          <>
            <DictationModal
              visible={showDictationModal}
              selected={selectedDictation}
              onSelect={(value) => {
                setSelectedDictation(value)
                localStorageCache.setItem('dictationTarget', value)
                window?.electron?.ipcRenderer?.invoke('set-dictation-target', value)
              }}
              onClose={() => {
                setShowDictationModal(false)
              }}
              onCancel={() => {
                setShowDictationModal(false)
              }}
            />

            <ShortcutManager
              visible={showShortcutManager}
              onClose={() => setShowShortcutManager(false)}
            />
            
            <MacroManager
              isOpen={showMacroManager}
              onClose={() => setShowMacroManager(false)}
            />

            {/* Offline Data Viewer Modal */}
            {showOfflineDataViewer && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
              }}>
                <div style={{
                  width: '90%',
                  maxWidth: '800px',
                  height: '80%',
                  backgroundColor: 'rgba(42, 45, 49, 0.95)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h2 style={{
                      margin: 0,
                      color: '#fff',
                      fontSize: '20px',
                      fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 600
                    }}>
                      Offline Data Viewer
                    </h2>
                    <button
                      onClick={() => setShowOfflineDataViewer(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        fontSize: '24px',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1,
                    padding: '20px 24px',
                    overflow: 'auto',
                    color: '#fff',
                    fontFamily: "'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}>
                    <pre style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {JSON.stringify(offlineStorage.exportOfflineData(), null, 2)}
                    </pre>
                  </div>

                  {/* Footer */}
                  <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '12px',
                      fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif"
                    }}>
                      Last sync: {offlineStorage.getLastSync()?.toLocaleString() || 'Never'}
                    </span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(offlineStorage.exportOfflineData(), null, 2))
                          showNotification('📋 Copied to clipboard!')
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        📋 Copy JSON
                      </button>
                      <button
                        onClick={() => {
                          offlineStorage.clearAll()
                          showNotification('🗑️ All offline data cleared!')
                          setShowOfflineDataViewer(false)
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Clear All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Logic Editor Direct Modal */}
        {showLogicEditor && user?.id && (
          <>
            {console.log('🎯 Rendering LogicEditorV3 with:', { userId: user.id, studyType: selectedStudyType, showLogicEditor })}
            <LogicEditorV3
              userId={user.id}
              studyType={selectedStudyType || ''}
              onClose={() => {
                setShowLogicEditor(false);
                // Restore focus to the editor after modal closes
                setTimeout(() => {
                  const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
                  if (editor) {
                    editor.focus();
                    // Trigger a click to ensure full interactivity is restored
                    editor.click();
                  }
                  // Also ensure the document body is interactive
                  document.body.style.pointerEvents = 'auto';
                }, 100);
              }}
              isOfflineMode={isOfflineMode}
              userTier={userTier}
            />
          </>
        )}

        {/* Ask AI Modal */}
        {showAskAI && user?.id && generationResult && (
          <AskAI
            userId={user.id}
            studyType={selectedStudyType || ''}
            reportText={findings}
            reportId={undefined}
            sessionId={undefined}
            onClose={() => setShowAskAI(false)}
          />
        )}

        {/* AI Refinement Modal */}
        {showAIRefinement && generationResult && (
          <AIRefinement
            originalText={findings}
            studyType={selectedStudyType || ''}
            isImpression={false}
            onClose={() => setShowAIRefinement(false)}
            onAccept={(refinedText) => {
              console.log('AI Refinement accepted');
              setGenerationResult({
                ...generationResult,
                generatedText: refinedText
              });
              setShowAIRefinement(false);
            }}
            onUpdateOriginal={(newText) => {
              setFindings(newText);
            }}
          />
        )}

        {/* Bottom Message Box */}
        {notification && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(58, 188, 150, 0.9)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 10000,
            fontSize: '14px',
            fontWeight: '500',
            maxWidth: '400px',
            textAlign: 'center',
            pointerEvents: 'none', // Don't steal focus
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(58, 188, 150, 0.3)'
          }}>
            {notification}
          </div>
        )}
        
        {/* Macro Picklist Dropdown */}
        {picklistState && (
          <MacroPicklist
            options={picklistState.options}
            position={picklistState.position}
            onSelect={handlePicklistSelect}
            onCancel={() => setPicklistState(null)}
          />
        )}
      </div>
    </div>
    </>
  ))
})
