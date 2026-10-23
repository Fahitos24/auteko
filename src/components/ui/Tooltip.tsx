'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  text: string
  label?: string
  children?: React.ReactNode
}

export default function Tooltip({ text, label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const WIDTH = 230

  function show() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceAbove = rect.top
    const placement  = spaceAbove < 100 ? 'bottom' : 'top'

    setCoords({
      top:  placement === 'top'
              ? rect.top + window.scrollY - 8
              : rect.bottom + window.scrollY + 8,
      left: Math.min(
              Math.max(rect.left + rect.width / 2 - WIDTH / 2, 8),
              window.innerWidth - WIDTH - 8
            ),
      placement,
    })
    setVisible(true)
  }

  function hide() { setVisible(false) }

  return (
    <>
      <span
        ref={triggerRef}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {label && <span style={{ fontSize: 'inherit', color: 'inherit' }}>{label}</span>}
        {children}
        {/* Иконка ? */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '13px', height: '13px', flexShrink: 0,
          borderRadius: '50%', border: '1px solid var(--ink-3)',
          color: 'var(--ink-3)', fontSize: '8px', fontWeight: 700,
          cursor: 'default', userSelect: 'none', lineHeight: 1,
        }}>?</span>
      </span>

      {/* Портал — рендерится прямо в body, поверх всего */}
      {visible && typeof document !== 'undefined' && createPortal(
        <span style={{
          position:  'absolute',
          top:       coords.placement === 'top'
                       ? coords.top - 4
                       : coords.top,
          left:      coords.left,
          width:     `${WIDTH}px`,
          transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
          background: '#1A2535',
          color:      '#E8EAF0',
          fontSize:   '11.5px',
          lineHeight: 1.55,
          padding:   '8px 11px',
          borderRadius: '5px',
          whiteSpace: 'pre-wrap',
          zIndex:    99999,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          {text}
          {/* Стрелка */}
          <span style={{
            position: 'absolute',
            left: '50%', transform: 'translateX(-50%)',
            ...(coords.placement === 'top'
              ? { bottom: '-5px', borderTop: '5px solid #1A2535', borderLeft: '5px solid transparent', borderRight: '5px solid transparent' }
              : { top: '-5px',    borderBottom: '5px solid #1A2535', borderLeft: '5px solid transparent', borderRight: '5px solid transparent' }
            ),
            width: 0, height: 0,
          }} />
        </span>,
        document.body
      )}
    </>
  )
}
