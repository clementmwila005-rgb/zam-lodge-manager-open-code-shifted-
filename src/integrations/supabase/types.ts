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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          business_id: string | null
          created_at: string
          device: string | null
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          business_id?: string | null
          created_at?: string
          device?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          business_id?: string | null
          created_at?: string
          device?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accommodation_enabled: boolean
          address: string | null
          bar_enabled: boolean
          business_code: string
          created_at: string
          delivery_fee_amount: number | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_name: string
          phone: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          receipt_footer: string | null
          receipt_width: string
          restaurant_enabled: boolean
          room_count: number
          service_fee_amount: number
          subscription_expires_at: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          accommodation_enabled?: boolean
          address?: string | null
          bar_enabled?: boolean
          business_code: string
          created_at?: string
          delivery_fee_amount?: number | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          receipt_footer?: string | null
          receipt_width?: string
          restaurant_enabled?: boolean
          room_count?: number
          service_fee_amount?: number
          subscription_expires_at?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          accommodation_enabled?: boolean
          address?: string | null
          bar_enabled?: boolean
          business_code?: string
          created_at?: string
          delivery_fee_amount?: number | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          receipt_footer?: string | null
          receipt_width?: string
          restaurant_enabled?: boolean
          room_count?: number
          service_fee_amount?: number
          subscription_expires_at?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string
          department: string
          expense_date: string
          id: string
          note: string | null
          payment_method: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string
          department: string
          expense_date?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string
          department?: string
          expense_date?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_lines: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          folio_id: string
          id: string
          source_order_id: string | null
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          folio_id: string
          id?: string
          source_order_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          folio_id?: string
          id?: string
          source_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folio_lines_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_lines_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
        ]
      }
      folios: {
        Row: {
          business_id: string
          closed_at: string | null
          created_at: string
          guest_id: string
          id: string
          opened_at: string
          reservation_id: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["folio_status"]
        }
        Insert: {
          business_id: string
          closed_at?: string | null
          created_at?: string
          guest_id: string
          id?: string
          opened_at?: string
          reservation_id?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["folio_status"]
        }
        Update: {
          business_id?: string
          closed_at?: string | null
          created_at?: string
          guest_id?: string
          id?: string
          opened_at?: string
          reservation_id?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["folio_status"]
        }
        Relationships: [
          {
            foreignKeyName: "folios_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          full_name: string
          id: string
          nrc_passport: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          full_name: string
          id?: string
          nrc_passport?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          full_name?: string
          id?: string
          nrc_passport?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          business_id: string
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          title: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          body: string
          business_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          title: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          title?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          business_id: string
          created_at: string
          id: string
          line_total: number
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          line_total: number
          name: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          line_total?: number
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_id: string
          charged_to_folio_id: string | null
          charged_to_room_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          service_fee: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          business_id: string
          charged_to_folio_id?: string | null
          charged_to_room_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          service_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          charged_to_folio_id?: string | null
          charged_to_room_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          service_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_charged_to_folio_id_fkey"
            columns: ["charged_to_folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_charged_to_room_id_fkey"
            columns: ["charged_to_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          folio_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          created_by?: string | null
          folio_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          folio_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          business_id: string
          cost_price: number
          created_at: string
          id: string
          name: string
          product_id: string
          selling_price: number
          stock_quantity: number
        }
        Insert: {
          barcode?: string | null
          business_id: string
          cost_price?: number
          created_at?: string
          id?: string
          name: string
          product_id: string
          selling_price?: number
          stock_quantity?: number
        }
        Update: {
          barcode?: string | null
          business_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          selling_price?: number
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          business_id: string
          category: Database["public"]["Enums"]["product_category"]
          cost_price: number
          created_at: string
          has_variants: boolean
          id: string
          image_url: string | null
          is_active: boolean
          min_stock_level: number
          name: string
          selling_price: number
          sku: string | null
          sold_in_bar: boolean
          sold_in_restaurant: boolean
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          business_id: string
          category?: Database["public"]["Enums"]["product_category"]
          cost_price?: number
          created_at?: string
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock_level?: number
          name: string
          selling_price?: number
          sku?: string | null
          sold_in_bar?: boolean
          sold_in_restaurant?: boolean
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          business_id?: string
          category?: Database["public"]["Enums"]["product_category"]
          cost_price?: number
          created_at?: string
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock_level?: number
          name?: string
          selling_price?: number
          sku?: string | null
          sold_in_bar?: boolean
          sold_in_restaurant?: boolean
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          business_id: string
          check_in_date: string
          check_out_date: string
          created_at: string
          created_by: string | null
          daily_rate: number
          guest_id: string
          id: string
          notes: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          check_in_date: string
          check_out_date: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          guest_id: string
          id?: string
          notes?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          guest_id?: string
          id?: string
          notes?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          business_id: string
          capacity: number
          created_at: string
          id: string
          status: Database["public"]["Enums"]["table_status"]
          table_number: string
        }
        Insert: {
          business_id: string
          capacity?: number
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["table_status"]
          table_number: string
        }
        Update: {
          business_id?: string
          capacity?: number
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["table_status"]
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          business_id: string
          created_at: string
          daily_rate: number
          description: string | null
          id: string
          image_url: string | null
          notes: string | null
          room_number: string
          room_type: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          daily_rate?: number
          description?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          room_number: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          daily_rate?: number
          description?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          room_number?: string
          room_type?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          business_id: string
          card_total: number | null
          cash_total: number | null
          closed_at: string | null
          expected_total: number | null
          id: string
          mobile_money_total: number | null
          notes: string | null
          opened_at: string
          opening_float: number
          shift_type: Database["public"]["Enums"]["shift_type"]
          status: Database["public"]["Enums"]["shift_status"]
          user_id: string
          variance: number | null
        }
        Insert: {
          business_id: string
          card_total?: number | null
          cash_total?: number | null
          closed_at?: string | null
          expected_total?: number | null
          id?: string
          mobile_money_total?: number | null
          notes?: string | null
          opened_at?: string
          opening_float?: number
          shift_type: Database["public"]["Enums"]["shift_type"]
          status?: Database["public"]["Enums"]["shift_status"]
          user_id: string
          variance?: number | null
        }
        Update: {
          business_id?: string
          card_total?: number | null
          cash_total?: number | null
          closed_at?: string | null
          expected_total?: number | null
          id?: string
          mobile_money_total?: number | null
          notes?: string | null
          opened_at?: string
          opening_float?: number
          shift_type?: Database["public"]["Enums"]["shift_type"]
          status?: Database["public"]["Enums"]["shift_status"]
          user_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_requests: {
        Row: {
          business_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          product_id: string | null
          reason: string
          requested_by: string | null
          requested_change: number
          status: Database["public"]["Enums"]["adjustment_status"]
          variant_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          product_id?: string | null
          reason: string
          requested_by?: string | null
          requested_change: number
          status?: Database["public"]["Enums"]["adjustment_status"]
          variant_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          product_id?: string | null
          reason?: string
          requested_by?: string | null
          requested_change?: number
          status?: Database["public"]["Enums"]["adjustment_status"]
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          business_id: string
          change: number
          created_at: string
          created_by: string | null
          id: string
          new_qty: number
          previous_qty: number
          product_id: string | null
          reason: string | null
          reference: string | null
          variant_id: string | null
        }
        Insert: {
          business_id: string
          change: number
          created_at?: string
          created_by?: string | null
          id?: string
          new_qty: number
          previous_qty: number
          product_id?: string | null
          reason?: string | null
          reference?: string | null
          variant_id?: string | null
        }
        Update: {
          business_id?: string
          change?: number
          created_at?: string
          created_by?: string | null
          id?: string
          new_qty?: number
          previous_qty?: number
          product_id?: string | null
          reason?: string | null
          reference?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_access_log: {
        Row: {
          business_id: string
          granted_at: string
          id: string
          reason: string
          revoked_at: string | null
          super_admin_id: string
        }
        Insert: {
          business_id: string
          granted_at?: string
          id?: string
          reason: string
          revoked_at?: string | null
          super_admin_id: string
        }
        Update: {
          business_id?: string
          granted_at?: string
          id?: string
          reason?: string
          revoked_at?: string | null
          super_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_business_id: { Args: never; Returns: string }
      has_business_access: { Args: { _business_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_owner: { Args: { _business_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      adjustment_status: "pending" | "approved" | "rejected"
      app_role:
        | "super_admin"
        | "owner"
        | "receptionist"
        | "restaurant_staff"
        | "bar_staff"
        | "housekeeping"
      folio_status: "open" | "closed"
      message_type: "preorder"
      order_status:
        | "new"
        | "preparing"
        | "ready"
        | "served"
        | "cancelled"
        | "paid"
      order_type: "restaurant" | "bar"
      payment_method: "cash" | "mobile_money" | "card" | "charge_to_room"
      product_category:
        | "food"
        | "beverages"
        | "alcohol"
        | "cleaning"
        | "toiletries"
        | "laundry"
        | "maintenance"
        | "other"
      reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      room_status:
        | "available"
        | "occupied"
        | "reserved"
        | "cleaning"
        | "maintenance"
      shift_status: "open" | "closed"
      shift_type: "reception" | "restaurant" | "bar"
      subscription_plan: "starter" | "business" | "enterprise" | "trial" | "pro"
      subscription_status: "trial" | "active" | "expired" | "suspended"
      table_status: "available" | "occupied" | "reserved"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      adjustment_status: ["pending", "approved", "rejected"],
      app_role: [
        "super_admin",
        "owner",
        "receptionist",
        "restaurant_staff",
        "bar_staff",
        "housekeeping",
      ],
      folio_status: ["open", "closed"],
      message_type: ["preorder"],
      order_status: [
        "new",
        "preparing",
        "ready",
        "served",
        "cancelled",
        "paid",
      ],
      order_type: ["restaurant", "bar"],
      payment_method: ["cash", "mobile_money", "card", "charge_to_room"],
      product_category: [
        "food",
        "beverages",
        "alcohol",
        "cleaning",
        "toiletries",
        "laundry",
        "maintenance",
        "other",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      room_status: [
        "available",
        "occupied",
        "reserved",
        "cleaning",
        "maintenance",
      ],
      shift_status: ["open", "closed"],
      shift_type: ["reception", "restaurant", "bar"],
      subscription_plan: ["starter", "business", "enterprise", "trial", "pro"],
      subscription_status: ["trial", "active", "expired", "suspended"],
      table_status: ["available", "occupied", "reserved"],
    },
  },
} as const
