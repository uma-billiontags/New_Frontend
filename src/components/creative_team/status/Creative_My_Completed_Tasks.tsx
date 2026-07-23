import MyStatusTable from './CreativeMyStatusTable';

export default function My_Completed_Tasks() {
    return (
        <MyStatusTable 
        reportType="completed" 
        title="Completed Tasks" 
        subtitle="TASKS YOU HAVE COMPLETED" />
    );
}