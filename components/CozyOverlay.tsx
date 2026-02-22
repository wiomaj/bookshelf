'use client'

const FLAMES = [
  { w: 14, h: 38, x: -30, delay: 0,    dur: 1.8, color: '#FF4500' },
  { w: 22, h: 58, x: -15, delay: 0.25, dur: 2.1, color: '#FF6B2B' },
  { w: 28, h: 78, x:   0, delay: 0.1,  dur: 1.9, color: '#FF8C00' },
  { w: 22, h: 62, x:  15, delay: 0.4,  dur: 2.2, color: '#FF6B2B' },
  { w: 14, h: 42, x:  30, delay: 0.15, dur: 1.7, color: '#FF4500' },
]

const EMBERS = [
  { x: -18, delay: 0,    dur: 2.6 },
  { x:   8, delay: 0.9,  dur: 3.1 },
  { x:  -4, delay: 1.6,  dur: 2.3 },
  { x:  22, delay: 0.4,  dur: 2.9 },
  { x: -12, delay: 1.2,  dur: 2.5 },
]

export default function CozyOverlay() {
  return (
    // z-[1] keeps fire behind page content (CozyBody wraps content at z-index: 2)
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

      {/* Fire at bottom-center */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">

        {/* Glow pool behind flames */}
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[140px] h-[40px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse, rgba(255,160,0,0.65), rgba(255,80,0,0.35) 50%, transparent 75%)',
            filter: 'blur(10px)',
            animation: 'cozy-glow 2s ease-in-out infinite',
          }}
        />

        {/* Flames */}
        {FLAMES.map((f, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `calc(50% + ${f.x}px - ${f.w / 2}px)`,
              width: f.w,
              height: f.h,
              borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%',
              background: `radial-gradient(ellipse at 50% 85%, white 0%, ${f.color} 35%, rgba(255,50,0,0.45) 75%, transparent 100%)`,
              filter: 'blur(1.5px)',
              transformOrigin: 'bottom center',
              animation: `cozy-flicker ${f.dur}s ease-in-out ${f.delay}s infinite`,
            }}
          />
        ))}

        {/* Floating embers */}
        {EMBERS.map((e, i) => (
          <div
            key={i}
            className="absolute bottom-3 w-1.5 h-1.5 rounded-full"
            style={{
              left: `calc(50% + ${e.x}px)`,
              background: 'radial-gradient(circle, #FFD700, #FF6600)',
              animation: `cozy-ember ${e.dur}s ease-out ${e.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
