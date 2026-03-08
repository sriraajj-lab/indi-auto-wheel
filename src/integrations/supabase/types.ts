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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bot_logs: {
        Row: {
          created_at: string
          id: string
          log_type: string
          message: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          aggressiveness: string
          allocated_capital: number
          approved_stocks: string[]
          bot_enabled: boolean
          broker_access_token: string | null
          broker_access_token_expires_at: string | null
          broker_api_key: string | null
          broker_api_secret: string | null
          broker_request_token: string | null
          created_at: string
          emergency_stop: boolean
          id: string
          max_daily_loss_pct: number
          max_risk_per_trade_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aggressiveness?: string
          allocated_capital?: number
          approved_stocks?: string[]
          bot_enabled?: boolean
          broker_access_token?: string | null
          broker_access_token_expires_at?: string | null
          broker_api_key?: string | null
          broker_api_secret?: string | null
          broker_request_token?: string | null
          created_at?: string
          emergency_stop?: boolean
          id?: string
          max_daily_loss_pct?: number
          max_risk_per_trade_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aggressiveness?: string
          allocated_capital?: number
          approved_stocks?: string[]
          bot_enabled?: boolean
          broker_access_token?: string | null
          broker_access_token_expires_at?: string | null
          broker_api_key?: string | null
          broker_api_secret?: string | null
          broker_request_token?: string | null
          created_at?: string
          emergency_stop?: boolean
          id?: string
          max_daily_loss_pct?: number
          max_risk_per_trade_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_pnl: {
        Row: {
          capital_used: number
          created_at: string
          date: string
          id: string
          max_loss_remaining: number
          realized_pnl: number
          total_pnl: number
          trades_count: number
          unrealized_pnl: number
          user_id: string
        }
        Insert: {
          capital_used?: number
          created_at?: string
          date: string
          id?: string
          max_loss_remaining?: number
          realized_pnl?: number
          total_pnl?: number
          trades_count?: number
          unrealized_pnl?: number
          user_id: string
        }
        Update: {
          capital_used?: number
          created_at?: string
          date?: string
          id?: string
          max_loss_remaining?: number
          realized_pnl?: number
          total_pnl?: number
          trades_count?: number
          unrealized_pnl?: number
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          ai_reasoning: string | null
          broker_order_id: string | null
          created_at: string
          ema_cloud_status: string | null
          entry_price: number
          exit_price: number | null
          expiry_date: string | null
          id: string
          news_sentiment: string | null
          pnl: number | null
          premium: number | null
          quantity: number
          rsi_value: number | null
          status: string
          strike_price: number | null
          symbol: string
          trade_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          broker_order_id?: string | null
          created_at?: string
          ema_cloud_status?: string | null
          entry_price: number
          exit_price?: number | null
          expiry_date?: string | null
          id?: string
          news_sentiment?: string | null
          pnl?: number | null
          premium?: number | null
          quantity?: number
          rsi_value?: number | null
          status?: string
          strike_price?: number | null
          symbol: string
          trade_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          broker_order_id?: string | null
          created_at?: string
          ema_cloud_status?: string | null
          entry_price?: number
          exit_price?: number | null
          expiry_date?: string | null
          id?: string
          news_sentiment?: string | null
          pnl?: number | null
          premium?: number | null
          quantity?: number
          rsi_value?: number | null
          status?: string
          strike_price?: number | null
          symbol?: string
          trade_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
