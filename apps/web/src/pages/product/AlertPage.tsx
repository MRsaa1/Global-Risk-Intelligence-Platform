/**
 * ALERT — product module: early warning and 48–72h community alerts
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AlertPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/municipal?tab=alerts', { replace: true })
  }, [navigate])
  return null
}
