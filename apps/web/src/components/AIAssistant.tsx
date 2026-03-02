/**
 * AI Assistant — Risk AI Assistant panel (ask, commands, voice).
 * Unified Corporate Style: zinc palette, section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no glass. See Implementation Audit.
 */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  CpuChipIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import { getApiV1Base } from '../config/env'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  action?: { type: string; label?: string; path?: string }
}

// Default UI and speech language (backend understands both EN and RU)
const DEFAULT_SPEECH_LANG = 'en'

// General prompts (default English; backend understands Russian too)
const samplePrompts = [
  "Run a stress test",
  "Check agent status",
  "How does the platform work?",
  "Run diagnostics",
  "What are the main flood risks for Hamburg?",
  "Explain the stress test results",
]

/** Context-specific prompts per path. More specific paths first (e.g. /modules/sro/regulator before /modules/sro). */
const CONTEXT_PROMPTS: Record<string, string[]> = {
  '/modules/sro/regulator': [
    "What is SFI?",
    "What do P50 Failed and Collapse Prob mean?",
    "How do scenarios affect the simulation?",
    "What is the heatmap showing?",
  ],
  '/modules/biosec': [
    "What is the Spread Network?",
    "What are BSL-4 labs?",
    "How is spread risk calculated?",
    "What do the graph nodes and edges mean?",
  ],
  '/modules/fst': [
    "How does the stress test work?",
    "What is the regulatory format?",
    "How to interpret the report?",
  ],
  '/modules/scss': [
    "What are sovereignty scores?",
    "How are suppliers and routes linked?",
  ],
  '/modules/sro': [
    "What is the SRO module?",
    "How does contagion work?",
  ],
  '/modules/cityos': [
    "What are migration routes?",
    "How is capacity forecast calculated?",
  ],
  '/command': [
    "Explain the Command Center timeline",
    "What do the risk scores mean?",
  ],
  '/dashboard': [
    "What do the KPIs on this dashboard mean?",
    "How is risk posture calculated?",
    "Explain capital at risk and stress loss.",
  ],
  '/modules': [
    "What are the Strategic Modules?",
    "Which module should I use for financial stress?",
    "What is SRO vs FST vs BIOSEC?",
  ],
}

/** Ordered keys for suffix match (longest first so /modules/sro/regulator wins over /modules/sro). */
const CONTEXT_PROMPTS_KEYS = [
  '/modules/sro/regulator',
  '/modules/biosec',
  '/modules/fst',
  '/modules/scss',
  '/modules/sro',
  '/modules/cityos',
  '/modules',
  '/dashboard',
  '/command',
] as const

function getContextPrompts(pathname: string): string[] {
  const normalized = (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(/\/$/, '') || '/'
  const exact = CONTEXT_PROMPTS[normalized]
  if (exact?.length) return exact
  for (const key of CONTEXT_PROMPTS_KEYS) {
    if (normalized === key || normalized.endsWith(key)) return CONTEXT_PROMPTS[key] ?? []
  }
  return []
}

// Web Speech API (not in all TS libs) — minimal typing
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionEventLike {
  results: { length: number; item(i: number): { length: number; item(j: number): { transcript: string } } }
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}
const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Prefer female voice for TTS (natural assistant). */
function getPreferredFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = lang === 'en' ? 'en-' : lang === 'ru' ? 'ru' : lang
  const female = voices.find(
    (v) =>
      (v.lang.startsWith(langPrefix) || v.lang.startsWith('en')) &&
      (v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Victoria') || v.name.includes('Google') || v.name.includes('Zira'))
  )
  return female ?? voices.find((v) => v.lang.startsWith(langPrefix) || v.lang.startsWith('en')) ?? null
}

/** Strip [Sources: ...], [1], [2], and technical bits so TTS sounds natural and lively. */
function textForTTS(full: string, maxLen = 500): string {
  let t = full
  const sourcesIdx = t.indexOf('[Sources:')
  if (sourcesIdx >= 0) t = t.slice(0, sourcesIdx).trim()
  t = t.replace(/\n\n\[.*?\]/g, '').trim()
  t = t.replace(/\s*\[\d+\]\s*/g, ' ').trim()
  t = t.replace(/\s{2,}/g, ' ')
  return t.slice(0, maxLen)
}

export interface AIAssistantHandle {
  open: () => void
}

export interface AIAssistantProps {
  /** When false, no floating button is shown (caller renders trigger and uses ref.open()). Default true. */
  floatingButton?: boolean
  /** 'top' = panel and FAB at top-right (e.g. Command Center so not under bottom bar). Default 'bottom'. */
  placement?: 'top' | 'bottom'
  /** Current pathname for context-aware prompts. If not set, useLocation().pathname is used. */
  pathname?: string
}

const AIAssistant = forwardRef<AIAssistantHandle, AIAssistantProps>(function AIAssistant({ floatingButton = true, placement = 'bottom', pathname: pathnameProp }, ref) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = pathnameProp ?? location.pathname
  const contextPrompts = getContextPrompts(pathname)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [rivaAvailable, setRivaAvailable] = useState(false)
  const [useRivaVoice, setUseRivaVoice] = useState(true)
  const [rivaRecording, setRivaRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sendMessageRef = useRef<(content: string, options?: { fromVoice?: boolean }) => void>(() => {})
  const femaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const speechSupported = !!getSpeechRecognition()

  // Load female voice as soon as voices are available (Chrome loads them async) so auto-speak uses it too
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const pick = () => {
      femaleVoiceRef.current = getPreferredFemaleVoice('en-US') || getPreferredFemaleVoice('en')
    }
    pick()
    window.speechSynthesis.onvoiceschanged = pick
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  const getFemaleVoice = useCallback((lang: string) => {
    return femaleVoiceRef.current || getPreferredFemaleVoice(lang)
  }, [])

  // Check Riva health when panel opens
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch(`${getApiV1Base()}/nvidia/riva/health`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRivaAvailable(Boolean(d?.enabled && d?.reachable))
      })
      .catch(() => {
        if (!cancelled) setRivaAvailable(false)
      })
    return () => { cancelled = true }
  }, [isOpen])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Riva STT: record audio and send to server
  const startRivaRecording = useCallback(async () => {
    setSpeechError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mime })
        const buf = await blob.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        try {
          const ac = new AbortController()
          const t = setTimeout(() => ac.abort(), 15000)
          const res = await fetch(`${getApiV1Base()}/nvidia/riva/stt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ audio_base64: base64, language: DEFAULT_SPEECH_LANG }),
            signal: ac.signal,
          })
          clearTimeout(t)
          if (res.ok) {
            const data = await res.json()
            const text = (data?.text || '').trim()
            if (text) sendMessageRef.current(text, { fromVoice: true })
          } else {
            setSpeechError('Riva STT failed; use browser voice or type.')
          }
        } catch {
          setSpeechError('Riva STT unavailable; use browser voice or type.')
        }
        setRivaRecording(false)
      }
      rec.start()
      mediaRecorderRef.current = rec
      setRivaRecording(true)
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [])

  const stopRivaRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setRivaRecording(false)
  }, [])

  // Speech recognition (Web Speech API fallback) or Riva
  const startListening = useCallback(() => {
    if (rivaAvailable && useRivaVoice) {
      startRivaRecording()
      return
    }
    const Klass = getSpeechRecognition()
    if (!Klass) {
      setSpeechError('Voice input not supported in this browser')
      return
    }
    setSpeechError(null)
    try {
      const rec = new Klass()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = DEFAULT_SPEECH_LANG === 'en' ? 'en-US' : 'ru-RU'
      rec.onresult = (e: SpeechRecognitionEventLike) => {
        let transcript = ''
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results.item(i)
          if (r.length > 0) transcript += r.item(0).transcript
        }
        transcript = transcript.trim()
        if (transcript) sendMessageRef.current(transcript, { fromVoice: true })
      }
      rec.onerror = (e: { error: string }) => {
        if (e.error === 'aborted') { setIsListening(false); return }
        if (e.error === 'not-allowed') setSpeechError('Microphone access denied')
        else setSpeechError(`Speech error: ${e.error}`)
        setIsListening(false)
      }
      rec.onend = () => setIsListening(false)
      recognitionRef.current = rec
      rec.start()
      setIsListening(true)
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : 'Speech recognition failed')
    }
  }, [rivaAvailable, useRivaVoice, startRivaRecording])

  const stopListening = useCallback(() => {
    if (rivaRecording) {
      stopRivaRecording()
      return
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [rivaRecording, stopRivaRecording])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
    }
  }, [])

  // Play base64 audio (from Riva TTS)
  const playRivaAudio = useCallback(async (base64: string, format: string) => {
    try {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: format === 'wav' ? 'audio/wav' : 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      await audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch {
      // fallback handled by caller
    }
  }, [])

  // TTS: speak last assistant message (Riva if available, else browser). Female voice, natural text (no Sources).
  const speakLastResponse = useCallback(async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!last?.content) return
    const text = textForTTS(last.content)
    if (!text) return
    if (rivaAvailable && useRivaVoice) {
      try {
        const ac = new AbortController()
        const t = setTimeout(() => ac.abort(), 15000)
        const res = await fetch(`${getApiV1Base()}/nvidia/riva/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text, language: DEFAULT_SPEECH_LANG }),
          signal: ac.signal,
        })
        clearTimeout(t)
        if (res.ok) {
          const data = await res.json()
          if (data?.audio_base64) await playRivaAudio(data.audio_base64, data?.format || 'wav')
          else throw new Error('No audio')
        } else throw new Error('TTS failed')
      } catch {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const u = new SpeechSynthesisUtterance(text)
          u.lang = DEFAULT_SPEECH_LANG === 'en' ? 'en-US' : 'ru-RU'
          u.rate = 0.9
          const female = getFemaleVoice(u.lang)
          if (female) u.voice = female
          window.speechSynthesis.speak(u)
        }
      }
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = DEFAULT_SPEECH_LANG === 'en' ? 'en-US' : 'ru-RU'
      u.rate = 0.9
      const female = getFemaleVoice(u.lang)
      if (female) u.voice = female
      window.speechSynthesis.speak(u)
    }
  }, [messages, rivaAvailable, useRivaVoice, playRivaAudio, getFemaleVoice])
  
  // Send message to AI-Q (with intent/action support). fromVoice = real-time voice: send and speak reply.
  const sendMessage = async (content: string, options?: { fromVoice?: boolean }) => {
    if (!content.trim() || isLoading) return

    const fromVoice = options?.fromVoice ?? false
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    if (isListening) stopListening()

    try {
      const ac = new AbortController()
      const timeout = setTimeout(() => ac.abort(), 60000)
      const response = await fetch(`${getApiV1Base()}/aiq/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: content.trim(),
          include_overseer_status: true,
          context: {},
        }),
        signal: ac.signal,
      })
      clearTimeout(timeout)

      const data = await response.json()
      const answer = data?.answer ?? (data?.error || 'No answer returned.')
      const sources = data?.sources ?? []
      const sourcesNote = sources.length > 0
        ? `\n\n[Sources: ${sources.slice(0, 3).map((s: { title?: string }) => s?.title ?? '').filter(Boolean).join(', ')}]`
        : ''
      const action = data?.action as { type: string; label?: string; path?: string } | undefined

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer + sourcesNote,
        timestamp: new Date(),
        ...(action && { action }),
      }

      setMessages((prev) => [...prev, assistantMessage])
      const textToSpeak = textForTTS(answer + sourcesNote)
      const shouldSpeak = fromVoice || ttsEnabled || (rivaAvailable && useRivaVoice)
      if (shouldSpeak && textToSpeak) {
        if (rivaAvailable && useRivaVoice) {
          try {
            const ac = new AbortController()
            const t = setTimeout(() => ac.abort(), 15000)
            const ttsRes = await fetch(`${getApiV1Base()}/nvidia/riva/tts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ text: textToSpeak, language: DEFAULT_SPEECH_LANG }),
              signal: ac.signal,
            })
            clearTimeout(t)
            if (ttsRes.ok) {
              const ttsData = await ttsRes.json()
              if (ttsData?.audio_base64) await playRivaAudio(ttsData.audio_base64, ttsData?.format || 'wav')
            } else throw new Error('Riva TTS failed')
          } catch {
            if (window.speechSynthesis) {
              window.speechSynthesis.cancel()
              const u = new SpeechSynthesisUtterance(textToSpeak)
              u.lang = DEFAULT_SPEECH_LANG === 'en' ? 'en-US' : 'ru-RU'
              u.rate = 0.9
              const female = getFemaleVoice(u.lang)
              if (female) u.voice = female
              window.speechSynthesis.speak(u)
            }
          }
        } else if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const u = new SpeechSynthesisUtterance(textToSpeak)
          u.lang = DEFAULT_SPEECH_LANG === 'en' ? 'en-US' : 'ru-RU'
          u.rate = 0.9
          const female = getFemaleVoice(u.lang)
          if (female) u.voice = female
          window.speechSynthesis.speak(u)
        }
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isTimeout
          ? 'Request timed out. The server may be busy — try again or shorten your question.'
          : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    sendMessageRef.current = sendMessage
  })

  useImperativeHandle(ref, () => ({ open: () => setIsOpen(true) }), [])

  const executeAction = (action: { type: string; label?: string; path?: string }) => {
    if (action.path) {
      navigate(action.path)
      setIsOpen(false)
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }
  
  return (
    <>
      {/* Floating button — hidden when floatingButton=false (e.g. Command Center uses its own trigger) */}
      {floatingButton && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className={`fixed z-40 p-3 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 transition-all ${placement === 'top' ? 'top-6 right-6' : 'bottom-6 right-6'} ${isOpen ? 'hidden' : ''}`}
          title="Open AI Assistant"
        >
          <CpuChipIcon className="w-5 h-5" />
        </motion.button>
      )}
      
      {/* Chat window — placement=top: bottom edge just above assistant icon; z-[60] above CC bar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: placement === 'top' ? 40 : 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'top' ? 40 : 100, scale: 0.9 }}
            className={`fixed z-[60] w-[95vw] max-w-[420px] max-h-[70vh] min-h-[320px] bg-zinc-900 rounded-md border border-zinc-800 flex flex-col overflow-hidden ${placement === 'top' ? 'bottom-[15.5rem] right-6' : 'bottom-6 right-6'}`}
          >
            {/* Header — corp: icon box rounded-md, label font-mono */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-md border border-zinc-700">
                  <CpuChipIcon className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-semibold text-zinc-100">Risk AI Assistant</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Ask, commands, voice</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-500 hover:text-zinc-300"
                title="Close / collapse"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div key={pathname} className="text-center py-6">
                  <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 mb-4 text-xs">Commands, platform questions. Voice: speak and the reply is sent and spoken back (real-time).</p>
                  
                  {/* General prompts */}
                  <div className="space-y-2 mb-4">
                    {samplePrompts.map((prompt, i) => (
                      <button
                        key={`g-${i}`}
                        onClick={() => sendMessage(prompt)}
                        className="w-full text-left p-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  {contextPrompts.length > 0 && (
                    <>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide mb-2 text-left">Suggested for this page</p>
                      <div className="space-y-2">
                        {contextPrompts.map((prompt, i) => (
                          <button
                            key={`c-${i}`}
                            onClick={() => sendMessage(prompt)}
                            className="w-full text-left p-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-200 border border-zinc-700"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-md ${
                        msg.role === 'user'
                          ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                      }`}
                    >
                      <p className="text-xs font-sans whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <p className="font-mono text-[10px] text-zinc-500 mt-1.5">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {msg.role === 'assistant' && msg.action && (
                      <button
                        type="button"
                        onClick={() => executeAction(msg.action!)}
                        className="mt-1.5 px-2.5 py-1 text-[11px] font-sans rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200"
                      >
                        {msg.action.label || 'Execute'}
                      </button>
                    )}
                  </div>
                ))
              )}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-md">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input + voice — corp: rounded-md, border-zinc-700, font-mono labels */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-900 shrink-0">
              {speechError && (
                <p className="font-mono text-[10px] text-amber-400/80 mb-1.5">{speechError}</p>
              )}
              <div className="flex gap-2 items-center">
                {(speechSupported || rivaAvailable) && (
                  <button
                    type="button"
                    onClick={isListening || rivaRecording ? stopListening : startListening}
                    className={`p-2 rounded-md border shrink-0 transition-colors ${
                      isListening || rivaRecording
                        ? 'bg-red-500/10 border-red-500/40 text-red-400/80'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                    title={isListening || rivaRecording ? 'Stop' : rivaAvailable && useRivaVoice ? 'Voice (Riva)' : 'Voice input'}
                  >
                    <MicrophoneIcon className="w-4 h-4" />
                  </button>
                )}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask, command, or say..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs font-sans text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 min-w-0"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-colors shrink-0 text-zinc-100"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => speakLastResponse()}
                  className="font-mono text-[10px] text-zinc-500 hover:text-zinc-400 flex items-center gap-1"
                >
                  <SpeakerWaveIcon className="w-3.5 h-3.5" />
                  Speak response
                </button>
                <label className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ttsEnabled}
                    onChange={(e) => setTtsEnabled(e.target.checked)}
                    className="rounded border-zinc-600 bg-zinc-800"
                  />
                  Auto-speak
                </label>
                {rivaAvailable && (
                  <label className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useRivaVoice}
                      onChange={(e) => setUseRivaVoice(e.target.checked)}
                      className="rounded border-zinc-600 bg-zinc-800"
                    />
                    Riva
                  </label>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
})

export default AIAssistant
