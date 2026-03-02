/**
 * Language Selector Component
 * 
 * Dropdown to select UI language (en/de/ru)
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlobeAltIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useI18n, Locale } from '../lib/i18n'

interface LanguageSelectorProps {
  variant?: 'default' | 'compact' | 'minimal'
  className?: string
}

export default function LanguageSelector({ 
  variant = 'default',
  className = '' 
}: LanguageSelectorProps) {
  const { locale, setLocale, locales, localeNames } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale)
    setIsOpen(false)
  }

  const getFlag = (l: Locale) => {
    switch (l) {
      case 'en': return '🇬🇧'
      case 'de': return '🇩🇪'
      case 'ru': return '🇷🇺'
      default: return '🌐'
    }
  }

  if (variant === 'minimal') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md hover:bg-zinc-700 transition-colors"
          title="Language"
        >
          <GlobeAltIcon className="w-5 h-5 text-zinc-400" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-2 bg-[#09090b] border border-zinc-700 rounded-md overflow-hidden shadow-xl z-50"
            >
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => handleSelect(l)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2 ${
                    locale === l ? 'text-zinc-300' : 'text-zinc-300'
                  }`}
                >
                  <span>{getFlag(l)}</span>
                  <span>{localeNames[l]}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex gap-1 ${className}`}>
        {locales.map((l) => (
          <button
            key={l}
            onClick={() => handleSelect(l)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              locale === l
                ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    )
  }

  // Default variant
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 transition-colors"
      >
        <GlobeAltIcon className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-200 text-sm">{localeNames[locale]}</span>
        <span className="text-lg">{getFlag(locale)}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-48 bg-[#09090b] border border-zinc-700 rounded-md overflow-hidden shadow-xl z-50"
          >
            <div className="p-2">
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => handleSelect(l)}
                  className={`w-full px-3 py-2 rounded-md text-left text-sm hover:bg-zinc-700 transition-colors flex items-center justify-between ${
                    locale === l ? 'text-zinc-300' : 'text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getFlag(l)}</span>
                    <span>{localeNames[l]}</span>
                  </div>
                  {locale === l && <CheckIcon className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
