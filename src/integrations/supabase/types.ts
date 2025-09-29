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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      live_orders: {
        Row: {
          created_at: string
          id: string
          live_phase_id: string | null
          live_product_id: string
          live_session_id: string
          order_code: string
          order_date: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          live_phase_id?: string | null
          live_product_id: string
          live_session_id: string
          order_code: string
          order_date?: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          live_phase_id?: string | null
          live_product_id?: string
          live_session_id?: string
          order_code?: string
          order_date?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_orders_live_product_id_fkey"
            columns: ["live_product_id"]
            isOneToOne: false
            referencedRelation: "live_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_orders_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_phases: {
        Row: {
          created_at: string
          id: string
          live_session_id: string
          phase_date: string
          phase_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_session_id: string
          phase_date: string
          phase_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          live_session_id?: string
          phase_date?: string
          phase_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_products: {
        Row: {
          created_at: string
          id: string
          live_phase_id: string | null
          live_session_id: string
          prepared_quantity: number
          product_code: string
          product_name: string
          sold_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_phase_id?: string | null
          live_session_id: string
          prepared_quantity?: number
          product_code: string
          product_name: string
          sold_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          live_phase_id?: string | null
          live_session_id?: string
          prepared_quantity?: number
          product_code?: string
          product_name?: string
          sold_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_products_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          session_date: string
          session_name: string | null
          start_date: string | null
          status: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          session_name?: string | null
          start_date?: string | null
          status?: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          session_name?: string | null
          start_date?: string | null
          status?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      livestream_reports: {
        Row: {
          created_at: string
          evening_ad_cost: number | null
          evening_duration: string | null
          evening_live_orders: number | null
          id: string
          morning_ad_cost: number | null
          morning_duration: string | null
          morning_live_orders: number | null
          report_date: string
          total_inbox_orders: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evening_ad_cost?: number | null
          evening_duration?: string | null
          evening_live_orders?: number | null
          id?: string
          morning_ad_cost?: number | null
          morning_duration?: string | null
          morning_live_orders?: number | null
          report_date: string
          total_inbox_orders?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evening_ad_cost?: number | null
          evening_duration?: string | null
          evening_live_orders?: number | null
          id?: string
          morning_ad_cost?: number | null
          morning_duration?: string | null
          morning_live_orders?: number | null
          report_date?: string
          total_inbox_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          notes: string | null
          product_images: string[] | null
          product_name: string
          purchase_order_id: string
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          product_images?: string[] | null
          product_name: string
          purchase_order_id: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          product_images?: string[] | null
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          discount_amount: number | null
          final_amount: number | null
          id: string
          invoice_date: string | null
          invoice_images: string[] | null
          invoice_number: string | null
          notes: string | null
          order_date: string
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          final_amount?: number | null
          id?: string
          invoice_date?: string | null
          invoice_images?: string[] | null
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          final_amount?: number | null
          id?: string
          invoice_date?: string | null
          invoice_images?: string[] | null
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_live_phases: {
        Args: { session_id: string; start_date: string }
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
