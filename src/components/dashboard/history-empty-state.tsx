import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";

type HistoryEmptyStateProps = {
  title: string;
  description: string;
};

export function HistoryEmptyState({ title, description }: HistoryEmptyStateProps) {
  return (
    <DashboardStatePanel
      eyebrow="Portfolio History пуст"
      title={title}
      description={description}
      className="h-[320px] min-h-[320px]"
    />
  );
}
