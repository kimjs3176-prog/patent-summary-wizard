import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Lock, Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save, X } from "lucide-react";
import { toast } from "sonner";

interface FeaturedPatent {
  id: string;
  patent_number: string;
  title: string;
  description: string | null;
  recommendation_reason: string | null;
  category: string | null;
  transfer_status: string | null;
  contact_info: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  patent_number: "",
  title: "",
  description: "",
  recommendation_reason: "",
  category: "",
  transfer_status: "기술이전 가능",
  contact_info: "",
  thumbnail_url: "",
  display_order: 0,
  is_active: true,
};

const Admin = () => {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [patents, setPatents] = useState<FeaturedPatent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const apiCall = async (action: string, data?: Record<string, unknown>) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-featured-patents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action, password, data }),
      }
    );
    return res.json();
  };

  const handleLogin = async () => {
    if (!password.trim()) return;
    setIsLoading(true);
    const result = await apiCall("list");
    if (result.success) {
      setIsAuthenticated(true);
      setPatents(result.patents || []);
    } else {
      toast.error("비밀번호가 올바르지 않습니다.");
    }
    setIsLoading(false);
  };

  const loadPatents = async () => {
    const result = await apiCall("list");
    if (result.success) setPatents(result.patents || []);
  };

  const handleSave = async () => {
    if (!form.patent_number.trim() || !form.title.trim()) {
      toast.error("특허번호와 제목은 필수입니다.");
      return;
    }
    setIsLoading(true);
    const action = editingId ? "update" : "create";
    const data = editingId ? { ...form, id: editingId } : form;
    const result = await apiCall(action, data);
    if (result.success) {
      toast.success(editingId ? "수정되었습니다." : "등록되었습니다.");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadPatents();
    } else {
      toast.error(result.error || "오류가 발생했습니다.");
    }
    setIsLoading(false);
  };

  const handleEdit = (patent: FeaturedPatent) => {
    setEditingId(patent.id);
    setForm({
      patent_number: patent.patent_number,
      title: patent.title,
      description: patent.description || "",
      recommendation_reason: patent.recommendation_reason || "",
      category: patent.category || "",
      transfer_status: patent.transfer_status || "기술이전 가능",
      contact_info: patent.contact_info || "",
      thumbnail_url: patent.thumbnail_url || "",
      display_order: patent.display_order,
      is_active: patent.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setIsLoading(true);
    const result = await apiCall("delete", { id });
    if (result.success) {
      toast.success("삭제되었습니다.");
      await loadPatents();
    } else {
      toast.error(result.error || "삭제 실패");
    }
    setIsLoading(false);
  };

  const handleToggleActive = async (patent: FeaturedPatent) => {
    const result = await apiCall("update", { id: patent.id, is_active: !patent.is_active });
    if (result.success) {
      toast.success(patent.is_active ? "비활성화되었습니다." : "활성화되었습니다.");
      await loadPatents();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-semibold">관리자 인증</h1>
            <Input
              type="password"
              placeholder="관리자 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button onClick={handleLogin} disabled={isLoading} className="w-full">
              {isLoading ? "확인 중..." : "로그인"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.location.href = "/"}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-semibold text-sm">이달의 특허 관리</h1>
          </div>
          <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}>
            <Plus className="w-4 h-4 mr-1" /> 추가
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {showForm && (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">{editingId ? "특허 수정" : "특허 등록"}</h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">특허번호 *</label>
                  <Input placeholder="10-1234567" value={form.patent_number} onChange={e => setForm(f => ({ ...f, patent_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">카테고리</label>
                  <Input placeholder="식품·가공" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">제목 *</label>
                <Input placeholder="특허 제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">설명</label>
                <Textarea placeholder="특허 설명" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">추천 이유</label>
                <Textarea placeholder="기술이전 추천 이유" rows={2} value={form.recommendation_reason} onChange={e => setForm(f => ({ ...f, recommendation_reason: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">기술이전 상태</label>
                  <Input placeholder="기술이전 가능" value={form.transfer_status} onChange={e => setForm(f => ({ ...f, transfer_status: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">연락처</label>
                  <Input placeholder="담당자 연락처" value={form.contact_info} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">썸네일 URL</label>
                  <Input placeholder="https://..." value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">표시 순서</label>
                  <Input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="is_active" className="text-xs">활성화 (메인 페이지에 표시)</label>
              </div>
              <Button onClick={handleSave} disabled={isLoading} className="mt-2">
                <Save className="w-4 h-4 mr-1" /> {editingId ? "수정" : "등록"}
              </Button>
            </div>
          </Card>
        )}

        {patents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            등록된 특허가 없습니다. '추가' 버튼으로 특허를 등록하세요.
          </div>
        ) : (
          <div className="space-y-3">
            {patents.map((patent) => (
              <Card key={patent.id} className={`p-4 ${!patent.is_active ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{patent.patent_number}</span>
                      {patent.category && <Badge variant="secondary" className="text-[10px]">{patent.category}</Badge>}
                      <Badge variant={patent.is_active ? "default" : "outline"} className="text-[10px]">
                        {patent.is_active ? "활성" : "비활성"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">순서: {patent.display_order}</span>
                    </div>
                    <h3 className="text-sm font-medium line-clamp-1">{patent.title}</h3>
                    {patent.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{patent.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(patent)}>
                      {patent.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(patent)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(patent.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
