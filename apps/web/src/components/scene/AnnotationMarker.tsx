/**
 * AnnotationMarker - minimal 3D marker UI for scene annotations.
 *
 * Phase 6.3-6.4 MVP: rendered as an Html label at a 3D position.
 */
import { Html } from '@react-three/drei'

export default function AnnotationMarker({
  text,
  position,
}: {
  text: string
  position: [number, number, number]
}) {
  return (
    <Html position={position} center>
      <div className="glass px-2 py-1 rounded-lg border border-white/10 text-[10px] text-white/80 max-w-[160px]">
        <span className="text-primary-300">●</span> {text}
      </div>
    </Html>
  )
}

