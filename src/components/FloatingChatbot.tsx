import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

const CHATBOT_URL = "https://patent-ask-chat.lovable.app";

export const FloatingChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-5 z-[9999] w-[400px] h-[90vh] max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-7rem)] rounded-2xl overflow-hidden shadow-2xl border border-border/60 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}>
            <span className="text-sm font-semibold">Patent Chat Aid</span>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <iframe
            src={CHATBOT_URL}
            className="w-full bg-background"
            style={{ height: 'calc(100% - 40px)', border: 'none' }}
            title="Patent Chat Aid"
            allow="microphone"
          />
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-5 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 btn-press"
        style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}
        aria-label="챗봇 열기"
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>
    </>
  );
};
