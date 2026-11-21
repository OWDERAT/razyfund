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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: number
          target_player: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: never
          target_player?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: never
          target_player?: string | null
        }
        Relationships: []
      }
      admin_login_limits: {
        Row: {
          attempts: number
          ip_hash: string
          window_start: string
        }
        Insert: {
          attempts?: number
          ip_hash: string
          window_start?: string
        }
        Update: {
          attempts?: number
          ip_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          expires_at: string
          token_hash: string
        }
        Insert: {
          expires_at: string
          token_hash: string
        }
        Update: {
          expires_at?: string
          token_hash?: string
        }
        Relationships: []
      }
      legacy_wallet_claims: {
        Row: {
          account_id: string
          legacy_id: string
        }
        Insert: {
          account_id: string
          legacy_id: string
        }
        Update: {
          account_id?: string
          legacy_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          username: string
        }
        Insert: {
          id: string
          username: string
        }
        Update: {
          id?: string
          username?: string
        }
        Relationships: []
      }
      scoobert_vote_claims: {
        Row: {
          claimed_at: string
          player_id: string
        }
        Insert: {
          claimed_at?: string
          player_id: string
        }
        Update: {
          claimed_at?: string
          player_id?: string
        }
        Relationships: []
      }
      scoobert_votes: {
        Row: {
          id: number
          total: number
        }
        Insert: {
          id?: number
          total?: number
        }
        Update: {
          id?: number
          total?: number
        }
        Relationships: []
      }
      site_events: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string
          event_type: string
          id: string
          image_url: string | null
          payload: Json
          sound_url: string | null
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at: string
          event_type: string
          id?: string
          image_url?: string | null
          payload?: Json
          sound_url?: string | null
          starts_at?: string
          title?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string
          event_type?: string
          id?: string
          image_url?: string | null
          payload?: Json
          sound_url?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      token_leaderboard: {
        Row: {
          name: string
          player_id: string
          tokens: number
          updated_at: string
        }
        Insert: {
          name: string
          player_id: string
          tokens?: number
          updated_at?: string
        }
        Update: {
          name?: string
          player_id?: string
          tokens?: number
          updated_at?: string
        }
        Relationships: []
      }
      wallet_accounts: {
        Row: {
          balance: number
          player_id: string
          updated_at: string
          votes: number
        }
        Insert: {
          balance?: number
          player_id: string
          updated_at?: string
          votes?: number
        }
        Update: {
          balance?: number
          player_id?: string
          updated_at?: string
          votes?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_leaderboard_tokens: {
        Args: { p_name: string; p_player: string; p_tokens: number }
        Returns: undefined
      }
      add_scoobert_vote: { Args: never; Returns: number }
      admin_adjust_wallet_balance: {
        Args: { p_amount: number; p_mode: string; p_player: string }
        Returns: number
      }
      attach_legacy_wallet: {
        Args: {
          p_balance: number
          p_legacy: string
          p_user: string
          p_voted: boolean
        }
        Returns: undefined
      }
      claim_scoobert_vote: { Args: { p_player: string }; Returns: boolean }
      reserve_admin_login: { Args: { p_ip_hash: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
