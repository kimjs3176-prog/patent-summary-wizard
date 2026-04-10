import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Pin, Eye, EyeOff, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Notice {
  id: string;
  title: string;
  content: string | null;
  is_active: boolean;
  is_pinned: boolean;
  importance: string;
  display_order: number;
  created_at: string;
}

interface NoticeManagerProps {
  apiCall: (action: string, data?: Record<string, unknown>) => Promise<any>;
}

const EMPTY_FORM = {
  title: "",
  content: "",
  is_active: true,
  is_pinned: false,
  importance: "normal" as string,
  display_order: 0,
};

const IMPORTANCE_OPTIONS = [
  { value: "normal", label: "일반", color: "bg-secondary text-muted-foreground" },
  { value: "important", label: "중요", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "urgent", label: "긴급", color: "bg-destructive/10 text-destructive border-destructive/30" },
];

export function NoticeManager({ apiCall }: NoticeManagerProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadNotices = async () => {
    setIsLoading(true);
    const result = await apiCall("list-notices");
    if (result.success) setNotices(result.notices || []);
    setIsLoading(false);
  };

  useEffect(() => { loadNotices(); }, []);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("제목을 입력하세요."); return; }
    setIsLoading(true);
    const action = editingId ? "update-notice" : "create-notice";
    const payload = editingId ? { ...form, id: editingId } : form;
    const result = await apiCall(action, payload as any);
    if (result.success) {
      toast.success(editingId ? "수정 완료" : "등록 완료");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadNotices();
    } else {
      toast.error(result.error || "오류 발생");
    }
    setIsLoading(false);
  };

  const handleEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      content: notice.content || "",
      is_active: notice.is_active,
      is_pinned: notice.is_pinned,
      importance: notice.importance || "normal",
      display_order: notice.display_order,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const result = await apiCall("delete-notice", { id });
    if (result.success) {
      toast.success("삭제 완료");
      await loadNotices();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">공지사항 관리</h3>
        <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 새 공지
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Input placeholder="제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Textarea placeholder="내용 (선택)" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} />
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} />
              <Pin className="w-3 h-3" /> 고정
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              {form.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} 활성
            </label>
            <Input type="number" className="w-20 h-7 text-xs" placeholder="순서" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">중요도:</span>
            {IMPORTANCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setForm(f => ({ ...f, importance: opt.value }))}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  form.importance === opt.value ? opt.color + " border-current" : "bg-secondary/30 text-muted-foreground border-border/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              {editingId ? "수정" : "등록"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}>
              <X className="w-3.5 h-3.5 mr-1" /> 취소
            </Button>
          </div>
        </Card>
      )}

      {isLoading && notices.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">로딩중...</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">등록된 공지사항이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {notices.map(notice => (
            <Card key={notice.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  {notice.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                  {notice.importance === "urgent" && <Badge className="text-[9px] px-1 py-0 bg-destructive/10 text-destructive border-destructive/20">긴급</Badge>}
                  {notice.importance === "important" && <Badge className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">중요</Badge>}
                  <span className="text-xs font-medium truncate">{notice.title}</span>
                  {!notice.is_active && <Badge variant="secondary" className="text-[9px] px-1 py-0">비활성</Badge>}
                </div>
                {notice.content && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{notice.content}</p>
                )}
                <span className="text-[10px] text-muted-foreground/50">{new Date(notice.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(notice)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(notice.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
