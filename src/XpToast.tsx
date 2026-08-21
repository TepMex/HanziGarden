export function XpToast({
  earnedXp,
  combo = 0,
  comboBonusXp = 0,
}: {
  earnedXp: number
  combo?: number
  comboBonusXp?: number
}) {
  return (
    <div className={`xp-toast ${comboBonusXp > 0 ? 'has-milestone' : ''}`} role="status" aria-live="polite">
      <strong>+{earnedXp} XP</strong>
      {combo > 1 && <span>КОМБО {combo}</span>}
      {comboBonusXp > 0 && <small>+{comboBonusXp} за точность</small>}
    </div>
  )
}
