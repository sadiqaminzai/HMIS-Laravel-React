import React, { useState, useEffect } from 'react';
import { Mail, Eye, Trash2, MessageSquare, Phone, Calendar, CheckCircle2, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axios';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'responded';
  created_at: string;
}

export function ContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'responded'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMessages();
  }, [filter, searchTerm]);

  const loadMessages = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      if (searchTerm) params.search = searchTerm;

      const { data } = await api.get('/contact-messages', { params });
      const records: ContactMessage[] = data.data ?? data;
      setMessages(records);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load messages';
      toast.error(message);
    }
  };

  const filteredMessages = messages; // filtering handled server-side

  const handleView = async (message: ContactMessage) => {
    setSelectedMessage(message);

    if (message.status === 'unread') {
      try {
        await api.patch(`/contact-messages/${message.id}`, { status: 'read' });
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'read' } : m)));
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Failed to update status';
        toast.error(msg);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.delete(`/contact-messages/${id}`);
      setMessages((prev) => prev.filter((msg) => msg.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
      toast.success('Message deleted successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete message';
      toast.error(msg);
    }
  };

  const markAsResponded = async (id: number) => {
    try {
      await api.patch(`/contact-messages/${id}`, { status: 'responded' });
      setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, status: 'responded' } : msg)));
      toast.success('Marked as responded');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update status';
      toast.error(msg);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-medium">Unread</span>;
      case 'read':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 rounded text-xs font-medium">Read</span>;
      case 'responded':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded text-xs font-medium">Responded</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Contact Messages</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage messages from the contact form</p>
        </div>
        
        {/* Filter Tabs & Search */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 focus:w-48 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All ({messages.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Unread ({messages.filter(m => m.status === 'unread').length})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'read'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Read ({messages.filter(m => m.status === 'read').length})
          </button>
          <button
            onClick={() => setFilter('responded')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'responded'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Responded ({messages.filter(m => m.status === 'responded').length})
          </button>
        </div>
      </div>
    </div>

      {/* Content Grid */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Messages List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Messages ({filteredMessages.length})
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Mail className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages found</p>
              </div>
            ) : (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleView(message)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedMessage?.id === message.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${message.status === 'unread' ? 'font-semibold' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {message.name}
                        </h3>
                        {getStatusBadge(message.status)}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{message.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {new Date(message.created_at).toLocaleDateString()} {new Date(message.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {selectedMessage ? (
            <>
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Message Details</h2>
                <div className="flex items-center gap-1">
                  {selectedMessage.status !== 'responded' && (
                    <button
                      onClick={() => markAsResponded(selectedMessage.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                      title="Mark as Responded"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  {getStatusBadge(selectedMessage.status)}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedMessage.name}</p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" />
                    {selectedMessage.email}
                  </a>
                </div>

                {/* Phone */}
                {selectedMessage.phone && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <a
                      href={`tel:${selectedMessage.phone}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedMessage.phone}
                    </a>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedMessage.subject}</p>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>

                {/* Submitted At */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Submitted At
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
