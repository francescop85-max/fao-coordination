'use client';

import { useRef, useState, DragEvent } from 'react';
import { Paperclip, Upload, Download, Trash2, FileText, File, X } from 'lucide-react';
import { MeetingAttachment } from '../types';
import { saveFile, getFile, deleteFile, formatBytes } from '../fileStore';

interface Props {
  meetingId: string;
  attachments: MeetingAttachment[];
  onChange: (updated: MeetingAttachment[]) => void;
}

function fileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileText size={14} className="text-red-500" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={14} className="text-blue-500" />;
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText size={14} className="text-green-500" />;
  return <File size={14} className="text-slate-400" />;
}

export default function Attachments({ meetingId, attachments, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newAttachments: MeetingAttachment[] = [...attachments];
    for (const file of Array.from(files)) {
      const id = `${meetingId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await saveFile(id, file);
      newAttachments.push({
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      });
    }
    onChange(newAttachments);
    setUploading(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDownload = async (att: MeetingAttachment) => {
    const blob = await getFile(att.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    await deleteFile(id);
    onChange(attachments.filter(a => a.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        />
        <Upload size={18} className="mx-auto mb-1 text-slate-400" />
        <p className="text-xs text-slate-500">
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">PDF, Word, Excel, PowerPoint, CSV</p>
      </div>

      {/* File list */}
      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map(att => (
            <li key={att.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="shrink-0">{fileIcon(att.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 truncate">{att.name}</div>
                <div className="text-xs text-slate-400">{formatBytes(att.size)}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDownload(att); }}
                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition-colors"
                title="Download"
              >
                <Download size={13} />
              </button>
              {deletingId === att.id ? (
                <span className="flex items-center gap-1">
                  <button onClick={() => handleDelete(att.id)} className="p-1 hover:bg-red-100 rounded text-red-500 transition-colors" title="Confirm delete">
                    <Trash2 size={13} />
                  </button>
                  <button onClick={() => setDeletingId(null)} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors" title="Cancel">
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setDeletingId(att.id); }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Badge shown in list view */
export function AttachmentBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
      <Paperclip size={11} />
      {count}
    </span>
  );
}
