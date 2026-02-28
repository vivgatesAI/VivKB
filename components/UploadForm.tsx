'use client';

import { useState, useEffect } from 'react';

interface KnowledgeBase {
  id: string;
  name: string;
  chunkCount: number;
  createdAt: string;
}

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const res = await fetch('/api/upload');
      const data = await res.json();
      setKnowledgeBases(data.knowledgeBases || []);
      if (data.knowledgeBases?.length > 0 && !selectedKb) {
        setSelectedKb(data.knowledgeBases[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge bases:', err);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setMessage('');
    
    const formData = new FormData();
    formData.append('file', file);
    if (selectedKb) {
      formData.append('knowledgeBaseId', selectedKb);
    }
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`✓ Uploaded ${data.addedChunks} chunks (${data.charCount} chars) to "${data.knowledgeBase.name}"`);
        setFile(null);
        fetchKnowledgeBases();
        if (!selectedKb) {
          setSelectedKb(data.knowledgeBase.id);
        }
      } else {
        setMessage('Error: ' + data.error);
        if (data.hint) {
          setMessage(prev => prev + '\n' + data.hint);
        }
      }
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Knowledge Base (or leave empty for new)
        </label>
        <select
          value={selectedKb}
          onChange={(e) => setSelectedKb(e.target.value)}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
        >
          <option value="">-- New Knowledge Base --</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name} ({kb.chunkCount} chunks)
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Upload Document
        </label>
        <input
          type="file"
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json,.html,.xml"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
        />
        <p className="text-xs text-gray-400 mt-2">
          Supported: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, JSON, HTML, XML
        </p>
      </div>
      
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
      >
        {uploading ? 'Processing...' : 'Upload & Process'}
      </button>
      
      {message && (
        <p className={`mt-4 text-sm whitespace-pre-line ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}