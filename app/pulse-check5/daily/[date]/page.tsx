import DailyCheckinsViewer from "../DailyCheckinsViewer";

export default function Page({ params }: { params: { date: string } }) {
  const { date } = params;
  return <DailyCheckinsViewer date={date} />;
}
