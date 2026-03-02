/**
 * FLOOD — product module: flood risk and adaptation
 * Routes to Municipal dashboard with flood context
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function FloodPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/municipal?tab=risk&hazard=flood', { replace: true })
  }, [navigate])
  return null
}
