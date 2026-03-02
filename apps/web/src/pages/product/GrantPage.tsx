/**
 * GRANT — product module: grant finder and applications
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function GrantPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/municipal?tab=grants', { replace: true })
  }, [navigate])
  return null
}
