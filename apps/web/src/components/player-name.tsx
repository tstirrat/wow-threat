/**
 * Class-colored player label component.
 */
import type { FC } from 'react'

export type PlayerNameProps = {
  label: string
  color: string
}

export const PlayerName: FC<PlayerNameProps> = ({ label, color }) => {
  return (
    <span className="font-medium" style={{ color }}>
      {label}
    </span>
  )
}
