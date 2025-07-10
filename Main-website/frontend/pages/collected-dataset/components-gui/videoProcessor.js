// videoProcessor.js
import dynamic from 'next/dynamic';

// Load the actual VideoProcessor component client-side only
const VideoProcessor = dynamic(
  () => import('../../../components/collected-dataset/VideoProcessor'),
  { ssr: false }
);

// Create the actual page component that will be rendered on the server
export default function VideoProcessorPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Video Processor</h1>
        <VideoProcessor />
      </div>
    </div>
  );
}