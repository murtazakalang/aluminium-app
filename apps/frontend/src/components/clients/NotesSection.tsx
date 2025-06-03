import React, { useState } from 'react';
import { ClientNote } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface NotesSectionProps {
  notes: ClientNote[];
  onAddNote: (note: { text: string; reminderDate?: string }) => Promise<void>;
  isLoading?: boolean;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ 
  notes, 
  onAddNote,
  isLoading = false 
}) => {
  const [noteText, setNoteText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!noteText.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onAddNote({ 
        text: noteText,
        reminderDate: reminderDate || undefined
      });
      setNoteText('');
      setReminderDate('');
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Notes</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Add notes and reminders about this client
        </p>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="note-text" className="block text-sm font-medium text-gray-700">
              Add a Note
            </label>
            <textarea
              id="note-text"
              name="note-text"
              rows={3}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md"
              placeholder="Add a note about this client..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label htmlFor="reminder-date" className="block text-sm font-medium text-gray-700">
              Set Reminder Date (Optional)
            </label>
            <input
              type="datetime-local"
              id="reminder-date"
              name="reminder-date"
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isSubmitting || !noteText.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </form>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
        {isLoading ? (
          <div className="py-4 text-center text-gray-500 animate-pulse">Loading notes...</div>
        ) : notes && notes.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {notes.map((note, index) => (
              <li key={note._id || index} className="py-4">
                <div className="flex space-x-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        Added on {formatDate(note.createdAt)}
                      </p>
                      {note.reminderDate && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Reminder: {new Date(note.reminderDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 whitespace-pre-line">{note.text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-4 text-center text-gray-500">No notes available</div>
        )}
      </div>
    </div>
  );
};

export default NotesSection; 