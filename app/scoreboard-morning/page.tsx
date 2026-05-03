import SharedScoreboard from '@/components/SharedScoreboard';

export default function MorningPage() {
  return (
    <SharedScoreboard 
      title="Morning Scoreboard"
      subtitle="สรุปอันดับคะแนนเกมช่วงเช้า"
      bgColor="bg-[#9cd4f7]" // Your original purple!
      csvUrlLower="https://docs.google.com/spreadsheets/d/1SwwS8hxhZmAwuMF_WZn8QweKmDY-fv5dJg_gMFA1zfs/export?format=csv&gid=1674201762&range=F4:G15"
      csvUrlUpper="https://docs.google.com/spreadsheets/d/10Z4J30FlnX_iXgGsJfc-v-USho2mSDtKT_9uFLcDEnk/export?format=csv&gid=1674201762&range=F4:G15"
    />
  );
}