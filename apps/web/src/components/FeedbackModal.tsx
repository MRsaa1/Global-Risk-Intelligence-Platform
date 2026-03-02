import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (feedback: { type: string; message: string; rating?: number }) => void
}

export default function FeedbackModal({ isOpen, onClose, onSubmit }: FeedbackModalProps) {
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(5)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ type, message, rating })
    setMessage('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass rounded-md p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-700 rounded-lg">
                    <ChatBubbleLeftRightIcon className="w-6 h-6 text-zinc-400" />
                  </div>
                  <h2 className="text-xl font-display font-bold">Send Feedback</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-950 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="improvement">Improvement</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none"
                    placeholder="Describe your feedback..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rating: {rating}/5
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-md font-medium hover:bg-zinc-950 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-zinc-600 text-zinc-100 rounded-md font-medium hover:bg-zinc-500 transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
