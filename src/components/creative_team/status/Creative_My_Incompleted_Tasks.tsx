import MyStatusTable from './CreativeMyStatusTable';

export default function My_Incompleted_Tasks() {
    return (
        <MyStatusTable 
        reportType="overdue" 
        title="Incompleted Tasks" 
        subtitle="TASKS YOU MISSED OR ARE OVERDUE ON" />
    );
}