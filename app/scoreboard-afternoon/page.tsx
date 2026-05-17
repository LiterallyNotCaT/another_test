import AuthGuard from '@/components/AuthGuard'
import SharedScoreboard from '@/components/SharedScoreboard'
import { AFTERNOON_SCORE_CSV_URL } from '@/lib/scoreboardSources'

export default function AfternoonScoreboardPage() {
  return (
    <AuthGuard
      pageKey="web2"
      title="Afternoon Scoreboard"
      subtitle="Enter afternoon access code"
      accentColor="#8b5cf6"
    >
      <SharedScoreboard
        title="Afternoon Scoreboard"
        subtitle="สรุปอันดับคะแนนเกมช่วงบ่าย"
        bgColor="bg-[#9cd4f7]"
        csvUrlTotal={AFTERNOON_SCORE_CSV_URL}
        showDetails={false}
      />
    </AuthGuard>
  )
}
