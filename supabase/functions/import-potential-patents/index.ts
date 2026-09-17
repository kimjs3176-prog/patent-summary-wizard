import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: file, error: dlErr } = await admin.storage.from('imports').download('potential_patents.json');
    if (dlErr || !file) throw new Error(dlErr?.message ?? 'download failed');
    const rows = JSON.parse(await file.text()) as Record<string, unknown>[];

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await admin.from('potential_patents').upsert(chunk, { onConflict: 'application_number' });
      if (error) throw new Error(error.message);
      inserted += chunk.length;
    }
    const { count } = await admin.from('potential_patents').select('*', { count: 'exact', head: true });
    return new Response(JSON.stringify({ success: true, inserted, total: count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
