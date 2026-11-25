import { useEffect, useState } from 'react'

// A link-style button for actions that can't be undone: the first tap asks, the second one acts.
export default function ConfirmButton({ children, onConfirm }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`btn-link ${armed ? 'armed' : ''}`}
      onClick={() => {
        if (armed) onConfirm()
        setArmed(!armed)
      }}
    >
      {armed ? 'Confirmer' : children}
    </button>
  )
}
