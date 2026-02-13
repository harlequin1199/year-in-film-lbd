import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

function LoveScoreInfo({ variant = 'icon-only', className = '' }) {
  const [showPopover, setShowPopover] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  const cancelCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      setShowPopover(false)
      closeTimeoutRef.current = null
    }, 150) // Small delay to allow moving cursor to popover
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target)
      ) {
        setShowPopover(false)
        cancelCloseTimeout()
      }
    }

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        cancelCloseTimeout()
      }
    }
  }, [showPopover])

  useEffect(() => {
    if (showPopover && containerRef.current && popoverRef.current) {
      const updatePosition = () => {
        if (!containerRef.current || !popoverRef.current) return
        
        const containerRect = containerRef.current.getBoundingClientRect()
        const popoverRect = popoverRef.current.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        
        // Calculate position: above the icon, centered horizontally
        let top = containerRect.top - popoverRect.height - 8
        let left = containerRect.left + containerRect.width / 2 - popoverRect.width / 2
        
        // Ensure popover stays within viewport
        if (top < 8) {
          // If not enough space above, show below
          top = containerRect.bottom + 8
        }
        if (left < 8) {
          left = 8
        }
        if (left + popoverRect.width > viewportWidth - 8) {
          left = viewportWidth - popoverRect.width - 8
        }
        
        setPopoverPosition({ top, left })
      }
      
      // Update position on mount and when popover becomes visible
      updatePosition()
      
      // Update position on scroll/resize
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [showPopover])

  const handleLearnMore = (e) => {
    e.preventDefault()
    setShowPopover(false)
    const footerElement = document.getElementById('love-score')
    if (footerElement) {
      footerElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    setShowPopover((prev) => !prev)
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

  const popoverContent = showPopover && (
    <div
      ref={popoverRef}
      className="love-score-info-popover"
      style={{
        position: 'fixed',
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`,
      }}
      onMouseEnter={!isMobile ? cancelCloseTimeout : undefined}
      onMouseLeave={!isMobile ? scheduleClose : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="love-score-info-popover-content">
        <strong>Love Score</strong> — единый показатель (0–100) для определения самых любимых жанров, тем, стран, режиссёров, актёров и периодов.
        <br />
        <br />
        Учитывает оценку выше вашей средней (65%), частоту просмотра (35%) с учётом относительной редкости (для жанров, стран и периодов времени — глобальная частота в TMDb), и уверенность в данных.
        <br />
        <br />
        <a
          href="#love-score"
          className="love-score-info-popover-link"
          onClick={handleLearnMore}
        >
          Подробнее →
        </a>
      </div>
    </div>
  )

  return (
    <>
      <span className={`love-score-info love-score-info--${variant} ${className}`} ref={containerRef}>
        <button
          type="button"
          className="love-score-info-icon"
          onClick={isMobile ? handleToggle : undefined}
          onMouseEnter={!isMobile ? () => {
            cancelCloseTimeout()
            setShowPopover(true)
          } : undefined}
          onMouseLeave={!isMobile ? scheduleClose : undefined}
          aria-label="Что такое Love Score?"
          aria-expanded={showPopover}
        >
          i
        </button>
      </span>
      {typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  )
}

export default LoveScoreInfo
