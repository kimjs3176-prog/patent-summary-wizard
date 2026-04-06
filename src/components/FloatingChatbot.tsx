import { useState } from "react";
import { X, Bot } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const CHATBOT_URL = "https://patent-ask-chat.lovable.app";

const DEFAULT_CHATBOT_WIDTH = 440;
const DEFAULT_CHATBOT_HEIGHT = 92; // vh

export const FloatingChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { settings } = useSiteSettings();

  const chatbotWidth = parseInt(settings.chatbot_width || "", 10) || DEFAULT_CHATBOT_WIDTH;
  const chatbotHeight = parseInt(settings.chatbot_height || "", 10) || DEFAULT_CHATBOT_HEIGHT;
  const isVisible = settings.chatbot_visible !== "false";

  if (!isVisible) return null;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-5 z-[9999] max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-7rem)] rounded-2xl overflow-hidden shadow-2xl border border-border/60 animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{ width: `${chatbotWidth}px`, height: `${chatbotHeight}vh` }}
        >
          <iframe
            src={CHATBOT_URL}
            className="w-full h-full bg-background"
            style={{ border: 'none' }}
            title="Patent Chat Aid"
            allow="microphone"
          />
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-5 z-[9999] shadow-lg flex items-center transition-all hover:scale-105 active:scale-95 btn-press"
        style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))', borderRadius: isOpen ? '50%' : '2rem', padding: isOpen ? '0' : '0', width: isOpen ? '3.5rem' : 'auto', height: '3.5rem' }}
        aria-label="챗봇 열기"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white mx-auto" />
        ) : (
          <span className="flex items-center gap-2 px-5 text-white font-semibold text-sm">
            <Bot className="w-5 h-5" />
            챗봇
          </span>
        )}
      </button>
    </>
  );
};
