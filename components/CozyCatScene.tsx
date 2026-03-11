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

// Rendered inside the scroll container — only visible when the user scrolls to the bottom.
export default function CozyCatScene() {
  return (
    <div className="relative w-full" style={{ height: 270 }}>

      {/* Cat — behind the fire */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cozy-cat.png"
        alt=""
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 180,
          height: 180,
          objectFit: 'contain',
        }}
      />

      {/* Fire — in front of the cat */}
      <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)' }}>

        {/* Glow pool */}
        <div
          style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 160,
            height: 48,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(255,160,0,0.70), rgba(255,80,0,0.38) 50%, transparent 75%)',
            filter: 'blur(12px)',
            animation: 'cozy-glow 2s ease-in-out infinite',
          }}
        />

        {/* Flames */}
        {FLAMES.map((f, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: 0,
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
            style={{
              position: 'absolute',
              bottom: 12,
              left: `calc(50% + ${e.x}px)`,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #FFD700, #FF6600)',
              animation: `cozy-ember ${e.dur}s ease-out ${e.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
