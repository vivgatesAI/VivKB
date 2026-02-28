import UploadForm from '../components/UploadForm';
import ChatInterface from '../components/ChatInterface';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-2">Venice Knowledge Graph</h1>
        <p className="text-purple-200 mb-8">AI-powered chatbot using Venice embeddings</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold text-white mb-4">Upload Documents</h2>
            <UploadForm />
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold text-white mb-4">Chat</h2>
            <ChatInterface />
          </div>
        </div>
      </div>
    </main>
  );
}