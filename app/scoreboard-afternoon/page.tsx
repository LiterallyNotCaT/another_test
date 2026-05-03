import SharedScoreboard from '@/components/SharedScoreboard'
import { AFTERNOON_SCORE_CSV_URL } from '@/lib/scoreboardSources'

export default function AfternoonScoreboardPage() {
  return (
    <SharedScoreboard
      title="Afternoon Scoreboard"
      subtitle="สรุปอันดับคะแนนเกมช่วงบ่าย"
      bgColor="bg-[#9cd4f7]"
      csvUrlTotal={AFTERNOON_SCORE_CSV_URL}
      showDetails={false}
    />
  )
}
