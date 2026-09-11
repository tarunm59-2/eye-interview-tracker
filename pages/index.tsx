import dynamic from 'next/dynamic';

const InterviewSession = dynamic(() => import('@/components/InterviewSession'), {
  ssr: false,
});

export default function Home() {
  return <InterviewSession />;
}
