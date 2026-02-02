import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Sample prompts for quick access
const samplePrompts = [
  "What are the main flood risks for Hamburg?",
  "Analyze climate risk for my portfolio",
  "Explain the stress test results",
  "What mitigation strategies do you recommend?",
]

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  // Send message to AI-Q (Generative AI Q&A with context and citations)
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/v1/aiq/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: content.trim(),
          include_overseer_status: true,
          context: {},
        }),
      })

      const data = await response.json()
      const answer = data?.answer ?? (data?.error || 'No answer returned.')
      const sources = data?.sources ?? []
      const sourcesNote = sources.length > 0
        ? `\n\n[Sources: ${sources.slice(0, 3).map((s: { title?: string }) => s?.title || '').filter(Boolean).join(', ')}]`
        : ''

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer + sourcesNote,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }
  
  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-48 right-8 z-50 p-3 rounded-xl bg-gradient-to-br from-amber-500/40 to-amber-600/40 border border-amber-500/30 text-amber-400 shadow-lg hover:border-amber-500/50 hover:bg-amber-500/30 transition-all ${isOpen ? 'hidden' : ''}`}
      >
        <CpuChipIcon className="w-5 h-5" />
      </motion.button>
      
      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-48 right-8 z-50 w-96 h-[600px] bg-dark-card rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-dark-panel border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <CpuChipIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-semibold text-white/90">Risk AI Assistant</h3>
                  <p className="text-[10px] text-white/40">Ask about risks, portfolio, scenarios</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-white/40" />
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto text-white/20 mb-4" />
                  <p className="text-white/60 mb-4">Ask about risks, portfolio, or stress scenarios</p>
                  
                  {/* Sample prompts */}
                  <div className="space-y-2">
                    {samplePrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(prompt)}
                        className="w-full text-left p-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/80"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-amber-500/20 border border-amber-500/20 text-white/90'
                          : 'bg-white/5 border border-white/5 text-white/80'
                      }`}
                    >
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <p className="text-[10px] text-white/30 mt-1.5">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 p-3 rounded-xl">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-white/5 bg-dark-panel">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about risks, portfolio, scenario..."
                  className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/30"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <PaperAirplaneIcon className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
