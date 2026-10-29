import ProjectDetails from '../../../components/projects/ProjectDetails';
export default function Page({ params }) { return <ProjectDetails key={params.projectId} projectId={params.projectId} />; }
