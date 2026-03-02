/**
 * DROUGHT — product module: drought risk and adaptation
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DroughtPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/municipal?tab=risk&hazard=drought', { replace: true })
  }, [navigate])
  return null
}
