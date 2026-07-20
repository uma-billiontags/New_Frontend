import StatusReportTable from './StatusReportTable';

export default function Completed_Users() {
    return (
        <StatusReportTable
            reportType="completed"
            title="Completed Users"
            subtitle="WHO COMPLETED WHICH TASKS, ACROSS ALL DEPARTMENTS"
        />
    );
}