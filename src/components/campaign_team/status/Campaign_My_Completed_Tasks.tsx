import MyStatusTable from './CampaignMyStatusTable';

export default function Campaign_My_Completed_Tasks() {
    return (
        <MyStatusTable 
        reportType="completed" 
        title="Completed Tasks" 
        subtitle="TASKS YOU HAVE COMPLETED" />
    );
}