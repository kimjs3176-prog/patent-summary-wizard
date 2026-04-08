import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pin, ChevronDown, ChevronUp, Megaphone } from "lucide-react";

interface Notice {
  id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
}

export function NoticeSection() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("notices")
        .select("id, title, content, is_pinned, created_at")
        .eq("is_active", true)
        .order("is_pinned", { ascending: false })
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setNotices(data);
    };
    load();
  }, []);

  if (notices.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto mt-8 md:mt-12 animate-fade-up">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">공지사항</h3>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
        {notices.map((notice) => (
          <div key={notice.id}>
            <button
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === notice.id ? null : notice.id)}
            >
              {notice.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
              <span className="text-xs font-medium text-foreground flex-1 truncate">{notice.title}</span>
              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                {new Date(notice.created_at).toLocaleDateString("ko-KR")}
              </span>
              {notice.content && (
                expandedId === notice.id
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
              )}
            </button>
            {expandedId === notice.id && notice.content && (
              <div className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {notice.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
