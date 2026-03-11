'use client'

export default function CozyOverlay() {
  return (
    // z-[1] keeps effects behind page content (CozyBody wraps content at z-index: 2)
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">

      {/* Full-screen warm ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 55% at 50% 100%, rgba(255,130,0,0.13), transparent 70%)',
        }}
      />

      {/* Subtle warm screen tint */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,180,80,0.03) 0%, rgba(255,120,30,0.07) 100%)',
        }}
      />
    </div>
  )
}
