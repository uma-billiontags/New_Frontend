import StatusReportTable from './StatusReportTable';

export default function Overdue_Users() {
    return (
        <StatusReportTable
            reportType="overdue"
            title="Overdue Users"
            subtitle="MISSED DEADLINES & SKIPPED TASKS, WITH REASON"
        />
    );
}