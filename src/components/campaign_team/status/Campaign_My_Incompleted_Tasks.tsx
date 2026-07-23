import MyStatusTable from './CampaignMyStatusTable';

export default function Campaign_My_Incompleted_Tasks() {
    return (
        <MyStatusTable 
        reportType="overdue" 
        title="Incompleted Tasks" 
        subtitle="TASKS YOU MISSED OR ARE OVERDUE ON" />
    );
}