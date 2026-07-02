import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, CheckCircle, Mail, ChevronDown, ChevronUp, FileText, Trophy } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  progress?: { status: string; message: string; state: 'running' | 'completed' }[];
};

type Report = {
  id: string;
  short_summary: string;
  markdown_report: string;
};

type EmailLog = {
  id: string;
  subject: string;
  summary: string;
  status: 'sent' | 'failed';
  timestamp: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I am your Deep Research AI. Provide me with a topic and I'll plan searches, synthesize a report, and email it to you.",
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [emailLog, setEmailLog] = useState<EmailLog[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', progress: [] }]);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.status === 'chat') {
              setMessages(prev => prev.map(msg => {
                if (msg.id !== assistantId) return msg;
                return { ...msg, progress: [], content: data.message };
              }));
              continue;
            }

            if (data.status === 'complete') {
              // Update final message
              setMessages(prev => prev.map(msg => {
                if (msg.id !== assistantId) return msg;
                const progress = (msg.progress || []).map(p => ({ ...p, state: 'completed' as const }));
                return { ...msg, progress, content: "Research complete! I've generated the report and sent the email." };
              }));

              // Add report
              const reportId = Date.now().toString();
              setReports(prev => [...prev, {
                id: reportId,
                short_summary: data.result.short_summary,
                markdown_report: data.result.markdown_report,
              }]);

              // Add email log (since we know it was sent)
              setEmailLog(prev => [...prev, {
                id: reportId + "_email",
                subject: "Research Report: " + input.substring(0, 30) + (input.length > 30 ? "..." : ""),
                summary: data.result.short_summary,
                status: 'sent',
                timestamp: new Date().toLocaleString(),
              }]);

              continue;
            }

            // Regular status update
            setMessages(prev => prev.map(msg => {
              if (msg.id !== assistantId) return msg;

              const progress = [...(msg.progress || [])];
              // Mark all previous progress as completed
              const updatedProgress = progress.map(p => ({ ...p, state: 'completed' as const }));
              // Add new running progress
              updatedProgress.push({ status: data.status, message: data.message, state: 'running' as const });

              return { ...msg, progress: updatedProgress };
            }));

          } catch (e) {
            console.error("Error parsing NDJSON line:", e);
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId ? { ...msg, content: msg.content + "\n\n[Connection Error]" } : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3 shadow-sm z-10">
        <div className="bg-blue-600 p-2 rounded-lg">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Deep Research Orchestrator</h1>
          <p className="text-sm text-gray-500">AI Agents working together to research and report</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? 'justify-end' : 'justify-start')}>

                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                  )}

                  <div className={cn(
                    "max-w-[80%] rounded-2xl p-4 shadow-sm",
                    msg.role === 'user' ? "bg-blue-600 text-white" : "bg-white border border-gray-100"
                  )}>
                    {msg.progress && msg.progress.length > 0 && (
                      <div className="mb-4 space-y-2 border-b pb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Agent Workflow Progress</p>
                        {msg.progress.map((prog, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-md">
                            {prog.state === 'running' ? (
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            <span className="text-gray-700 font-medium">{prog.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.content ? (
                      <div className={cn("prose prose-sm max-w-none whitespace-pre-wrap", msg.role === 'user' ? "text-white" : "text-gray-800")}>
                        {msg.content}
                      </div>
                    ) : (
                      msg.role === 'assistant' && isStreaming && (
                        <div className="flex items-center gap-2 text-gray-400 py-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </main>

          <footer className="bg-white border-t p-4 md:p-6">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isStreaming}
                  placeholder="Enter a topic to research..."
                  className="w-full bg-gray-100 text-gray-900 rounded-full pl-6 pr-14 py-4 outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                >
                  <Send className="w-5 h-5 ml-[2px]" />
                </button>
              </form>
            </div>
          </footer>
        </div>

        {/* Right Sidebar: Drafts + Email Log */}
        <aside className="w-[440px] border-l bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">

            {/* Generated Reports Section */}
            <div className="border-b">
              <div className="px-5 py-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-800">Generated Reports</h2>
                <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {reports.length}
                </span>
              </div>

              {reports.length === 0 ? (
                <div className="px-5 pb-5 text-sm text-gray-400">
                  {isStreaming ? "Agents are compiling the report..." : "No reports yet. Ask me to research something."}
                </div>
              ) : (
                <div className="px-4 pb-4 space-y-3">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="border-l-4 rounded-lg p-3 transition-colors border-indigo-400 bg-indigo-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700">
                          Writer Agent
                        </span>
                        <button
                          onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {expandedReport === report.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="mt-2 text-sm font-medium text-gray-800">
                        {report.short_summary}
                      </div>

                      {expandedReport === report.id && (
                        <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-indigo-200 pt-2">
                          {report.markdown_report}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent Emails Section */}
            <div>
              <div className="px-5 py-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-800">Sent Emails</h2>
                <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {emailLog.length}
                </span>
              </div>

              {emailLog.length === 0 ? (
                <div className="px-5 pb-5 text-sm text-gray-400">
                  {isStreaming ? "Waiting for email agent..." : "No emails sent yet."}
                </div>
              ) : (
                <div className="divide-y">
                  {emailLog.map((email) => (
                    <div key={email.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{email.subject}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{email.timestamp}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            email.status === 'sent'
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {email.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                          </span>
                          <button
                            onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {expandedEmail === email.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {expandedEmail === email.id && (
                        <div className="mt-3 bg-green-50 rounded-lg p-3 border border-green-200 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {email.summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
