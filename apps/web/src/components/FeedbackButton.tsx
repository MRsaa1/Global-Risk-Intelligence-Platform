import { useState } from 'react'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import FeedbackModal from './FeedbackModal'

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = async (feedback: { type: string; message: string; rating?: number }) => {
    // In production, send to backend
    console.log('Feedback submitted:', feedback)
    
    // Could send to API:
    // await axios.post('/api/v1/feedback', feedback)
    
    // Show success message
    alert('Thank you for your feedback!')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-zinc-600 text-zinc-100 rounded-full shadow-lg hover:bg-zinc-500 transition-colors z-40"
        title="Send Feedback"
      >
        <ChatBubbleLeftRightIcon className="w-6 h-6" />
      </button>
      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}
