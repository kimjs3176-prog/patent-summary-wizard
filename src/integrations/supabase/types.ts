export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      featured_patents: {
        Row: {
          category: string | null
          contact_info: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          patent_number: string
          recommendation_reason: string | null
          thumbnail_url: string | null
          title: string
          transfer_status: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          contact_info?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          patent_number: string
          recommendation_reason?: string | null
          thumbnail_url?: string | null
          title: string
          transfer_status?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          contact_info?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          patent_number?: string
          recommendation_reason?: string | null
          thumbnail_url?: string | null
          title?: string
          transfer_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patent_ai_cache: {
        Row: {
          analysis_mode: string
          created_at: string
          id: string
          patent_number: string
          summary_content: string
        }
        Insert: {
          analysis_mode?: string
          created_at?: string
          id?: string
          patent_number: string
          summary_content: string
        }
        Update: {
          analysis_mode?: string
          created_at?: string
          id?: string
          patent_number?: string
          summary_content?: string
        }
        Relationships: []
      }
      patent_data_cache: {
        Row: {
          created_at: string
          id: string
          patent_data: Json
          patent_number: string
          related_patents: Json
        }
        Insert: {
          created_at?: string
          id?: string
          patent_data?: Json
          patent_number: string
          related_patents?: Json
        }
        Update: {
          created_at?: string
          id?: string
          patent_data?: Json
          patent_number?: string
          related_patents?: Json
        }
        Relationships: []
      }
      patent_score_cache: {
        Row: {
          analysis: string | null
          business_reason: string | null
          business_score: number
          created_at: string
          id: string
          market_reason: string | null
          market_score: number
          patent_number: string
          technology_reason: string | null
          technology_score: number
          total_score: number
          trl: number
          trl_reason: string | null
        }
        Insert: {
          analysis?: string | null
          business_reason?: string | null
          business_score: number
          created_at?: string
          id?: string
          market_reason?: string | null
          market_score: number
          patent_number: string
          technology_reason?: string | null
          technology_score: number
          total_score: number
          trl?: number
          trl_reason?: string | null
        }
        Update: {
          analysis?: string | null
          business_reason?: string | null
          business_score?: number
          created_at?: string
          id?: string
          market_reason?: string | null
          market_score?: number
          patent_number?: string
          technology_reason?: string | null
          technology_score?: number
          total_score?: number
          trl?: number
          trl_reason?: string | null
        }
        Relationships: []
      }
      patent_search_stats: {
        Row: {
          created_at: string
          id: string
          last_searched_at: string
          patent_number: string
          patent_title: string | null
          search_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_searched_at?: string
          patent_number: string
          patent_title?: string | null
          search_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_searched_at?: string
          patent_number?: string
          patent_title?: string | null
          search_count?: number
        }
        Relationships: []
      }
      rda_patents_cache: {
        Row: {
          category: string
          fetched_at: string
          id: string
          patents: Json
        }
        Insert: {
          category: string
          fetched_at?: string
          id?: string
          patents?: Json
        }
        Update: {
          category?: string
          fetched_at?: string
          id?: string
          patents?: Json
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      upsert_search_stat: {
        Args: { p_patent_number: string; p_patent_title?: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
