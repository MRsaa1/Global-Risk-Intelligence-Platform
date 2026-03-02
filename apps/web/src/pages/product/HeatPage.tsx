/**
 * HEAT — product module: heat risk and adaptation
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HeatPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/municipal?tab=risk&hazard=heat', { replace: true })
  }, [navigate])
  return null
}
