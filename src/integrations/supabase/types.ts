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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_popup_acks: {
        Row: {
          acknowledged_at: string
          id: string
          popup_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          popup_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          popup_id?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_popups: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          created_by: string
          id: string
          target_mode: string
          target_sectors: Json
          target_users: Json
          title: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string
          created_by: string
          id?: string
          target_mode?: string
          target_sectors?: Json
          target_users?: Json
          title: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          target_mode?: string
          target_sectors?: Json
          target_users?: Json
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      app_users: {
        Row: {
          avatar: string | null
          background_color: string | null
          created_at: string
          function: string | null
          id: string
          name: string
          password: string
          role: string
          sectors: Json
          updated_at: string
          username: string
        }
        Insert: {
          avatar?: string | null
          background_color?: string | null
          created_at?: string
          function?: string | null
          id: string
          name: string
          password: string
          role?: string
          sectors?: Json
          updated_at?: string
          username: string
        }
        Update: {
          avatar?: string | null
          background_color?: string | null
          created_at?: string
          function?: string | null
          id?: string
          name?: string
          password?: string
          role?: string
          sectors?: Json
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      awards: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string
          document_name: string | null
          document_url: string | null
          id: string
          notes: string | null
          period: string | null
          target_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          period?: string | null
          target_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          period?: string | null
          target_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bulletin_acks: {
        Row: {
          acknowledged_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      bulletin_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: []
      }
      bulletin_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          target_mode: string
          target_users: Json
          time: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description?: string
          id?: string
          target_mode?: string
          target_users?: Json
          time?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          target_mode?: string
          target_users?: Json
          time?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      card_due_dates: {
        Row: {
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          due_date: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
        }
        Relationships: []
      }
      carriers: {
        Row: {
          blocked: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_read_status: {
        Row: {
          id: string
          last_read_at: string
          partner_username: string
          username: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          partner_username: string
          username: string
        }
        Update: {
          id?: string
          last_read_at?: string
          partner_username?: string
          username?: string
        }
        Relationships: []
      }
      counter_orders: {
        Row: {
          application: string | null
          brand: string | null
          client_id: string | null
          code: string | null
          created_at: string
          created_by_id: string | null
          created_by_name: string | null
          deadline: string | null
          id: string
          item_name: string
          link: string | null
          notes: string | null
          ordered_at: string | null
          purchase_value: number | null
          quantity: number
          sold_value: number | null
          status: string
          status_history: Json
          supplier: string | null
          updated_at: string
        }
        Insert: {
          application?: string | null
          brand?: string | null
          client_id?: string | null
          code?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          deadline?: string | null
          id?: string
          item_name: string
          link?: string | null
          notes?: string | null
          ordered_at?: string | null
          purchase_value?: number | null
          quantity?: number
          sold_value?: number | null
          status?: string
          status_history?: Json
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          application?: string | null
          brand?: string | null
          client_id?: string | null
          code?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          deadline?: string | null
          id?: string
          item_name?: string
          link?: string | null
          notes?: string | null
          ordered_at?: string | null
          purchase_value?: number | null
          quantity?: number
          sold_value?: number | null
          status?: string
          status_history?: Json
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      counter_quotes: {
        Row: {
          claimed_by: string | null
          created_at: string
          description: string
          id: string
          product_name: string
          quantity: number
          requested_by: string
          responded_by: string | null
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          description?: string
          id?: string
          product_name: string
          quantity?: number
          requested_by: string
          responded_by?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          description?: string
          id?: string
          product_name?: string
          quantity?: number
          requested_by?: string
          responded_by?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          participants: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          participants?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          participants?: Json
        }
        Relationships: []
      }
      financial_forecasts: {
        Row: {
          created_at: string
          created_by: string
          day_date: string
          day_label: string
          id: string
          predicted_cash: number
          predicted_expenses: number
          updated_at: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_date: string
          day_label: string
          id?: string
          predicted_cash?: number
          predicted_expenses?: number
          updated_at?: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_date?: string
          day_label?: string
          id?: string
          predicted_cash?: number
          predicted_expenses?: number
          updated_at?: string
          week_start_date?: string
        }
        Relationships: []
      }
      freight_destinations: {
        Row: {
          carrier: string
          city_name: string
          city_slug: string
          created_at: string
          deadline: string
          id: string
          notes: string
          per_km_rate: number | null
          price: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          carrier?: string
          city_name: string
          city_slug: string
          created_at?: string
          deadline?: string
          id?: string
          notes?: string
          per_km_rate?: number | null
          price?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          carrier?: string
          city_name?: string
          city_slug?: string
          created_at?: string
          deadline?: string
          id?: string
          notes?: string
          per_km_rate?: number | null
          price?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          deleted: boolean | null
          edited: boolean | null
          group_id: string
          id: string
          sender_username: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          deleted?: boolean | null
          edited?: boolean | null
          group_id: string
          id?: string
          sender_username: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          deleted?: boolean | null
          edited?: boolean | null
          group_id?: string
          id?: string
          sender_username?: string
        }
        Relationships: []
      }
      image_assets: {
        Row: {
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          image_text: string | null
          mime_type: string | null
          preserve: boolean
          processed_at: string | null
          size_bytes: number | null
          source_field: string | null
          source_id: string | null
          source_table: string | null
          storage_path: string
          thumb_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          image_text?: string | null
          mime_type?: string | null
          preserve?: boolean
          processed_at?: string | null
          size_bytes?: number | null
          source_field?: string | null
          source_id?: string | null
          source_table?: string | null
          storage_path: string
          thumb_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          image_text?: string | null
          mime_type?: string | null
          preserve?: boolean
          processed_at?: string | null
          size_bytes?: number | null
          source_field?: string | null
          source_id?: string | null
          source_table?: string | null
          storage_path?: string
          thumb_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      internal_policies: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventories: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          locations: Json
          popup_id: string | null
          shelf_code: string
          started_at: string
          started_by_id: string
          started_by_name: string
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          locations?: Json
          popup_id?: string | null
          shelf_code: string
          started_at?: string
          started_by_id: string
          started_by_name: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          locations?: Json
          popup_id?: string | null
          shelf_code?: string
          started_at?: string
          started_by_id?: string
          started_by_name?: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      low_stock_items: {
        Row: {
          created_at: string
          description: string
          id: string
          photo_url: string | null
          product_name: string
          reported_by: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          photo_url?: string | null
          product_name: string
          reported_by: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          photo_url?: string | null
          product_name?: string
          reported_by?: string
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          deleted: boolean | null
          edited: boolean | null
          id: string
          receiver_username: string
          sender_username: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          deleted?: boolean | null
          edited?: boolean | null
          id?: string
          receiver_username: string
          sender_username: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          deleted?: boolean | null
          edited?: boolean | null
          id?: string
          receiver_username?: string
          sender_username?: string
        }
        Relationships: []
      }
      motoboy_assignments: {
        Row: {
          accepted_at: string | null
          assigned_by: string
          assigned_to: string | null
          client_name: string | null
          completed_at: string | null
          created_at: string
          description: string
          id: string
          location: string | null
          notes: string | null
          ride_value: number | null
          scheduled_for: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_by: string
          assigned_to?: string | null
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          location?: string | null
          notes?: string | null
          ride_value?: number | null
          scheduled_for?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_by?: string
          assigned_to?: string | null
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          notes?: string | null
          ride_value?: number | null
          scheduled_for?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pause_history: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          overtime_seconds: number | null
          pause_type: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          overtime_seconds?: number | null
          pause_type: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          overtime_seconds?: number | null
          pause_type?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_note_shares: {
        Row: {
          created_at: string
          id: string
          note_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "personal_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pickups: {
        Row: {
          carrier_name: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          created_by: string
          delivery_type: string
          details: string | null
          id: string
          order_title: string
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by: string
          delivery_type: string
          details?: string | null
          id?: string
          order_title: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string
          delivery_type?: string
          details?: string | null
          id?: string
          order_title?: string
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          label: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          poll_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          question: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          question: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          question?: string
        }
        Relationships: []
      }
      presence_sessions: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status: string
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          comprador_id: string | null
          comprador_nome: string | null
          created_at: string
          escopo: string | null
          id: string
          items: Json
          order_date: string
          order_number: number
          supplier_id: string | null
          supplier_snapshot: Json | null
          total: number | null
          updated_at: string
        }
        Insert: {
          comprador_id?: string | null
          comprador_nome?: string | null
          created_at?: string
          escopo?: string | null
          id?: string
          items?: Json
          order_date?: string
          order_number?: number
          supplier_id?: string | null
          supplier_snapshot?: Json | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          comprador_id?: string | null
          comprador_nome?: string | null
          created_at?: string
          escopo?: string | null
          id?: string
          items?: Json
          order_date?: string
          order_number?: number
          supplier_id?: string | null
          supplier_snapshot?: Json | null
          total?: number | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          liked_by: Json
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          id?: string
          liked_by?: Json
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          liked_by?: Json
          photo_url?: string | null
        }
        Relationships: []
      }
      reverse_shipments: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_number: string
          item_name: string
          item_value: number
          product_image_url: string | null
          requested_by: string
          responded_by: string | null
          return_reason: string
          sale_date: string | null
          status: string
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_number?: string
          item_name?: string
          item_value?: number
          product_image_url?: string | null
          requested_by: string
          responded_by?: string | null
          return_reason?: string
          sale_date?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_number?: string
          item_name?: string
          item_value?: number
          product_image_url?: string | null
          requested_by?: string
          responded_by?: string | null
          return_reason?: string
          sale_date?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_tasks: {
        Row: {
          active: boolean
          assign_mode: string
          assignee_id: string | null
          created_at: string
          created_by: string
          days_of_week: Json
          description: string
          id: string
          last_created_at: string | null
          priority: string
          recurrence: string
          schedule_time: string
          sector: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assign_mode?: string
          assignee_id?: string | null
          created_at?: string
          created_by: string
          days_of_week?: Json
          description?: string
          id?: string
          last_created_at?: string | null
          priority?: string
          recurrence?: string
          schedule_time?: string
          sector?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assign_mode?: string
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          days_of_week?: Json
          description?: string
          id?: string
          last_created_at?: string | null
          priority?: string
          recurrence?: string
          schedule_time?: string
          sector?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_documents: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          owner_id: string
          owner_name: string | null
          share_all: boolean
          shared_with: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          owner_id: string
          owner_name?: string | null
          share_all?: boolean
          shared_with?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          owner_id?: string
          owner_name?: string | null
          share_all?: boolean
          shared_with?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      storage_audit_log: {
        Row: {
          action: string
          bucket: string
          category: string
          created_at: string
          id: string
          mime_type: string | null
          notes: string | null
          run_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          action?: string
          bucket: string
          category: string
          created_at?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          run_id: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          action?: string
          bucket?: string
          category?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          run_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          admin_response: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          status: string
        }
        Insert: {
          admin_response?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          status?: string
        }
        Update: {
          admin_response?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          celular: string | null
          cep: string | null
          cnpj: string | null
          contato: string | null
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          municipio_uf: string | null
          obs: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          celular?: string | null
          cep?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          municipio_uf?: string | null
          obs?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          celular?: string | null
          cep?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          municipio_uf?: string | null
          obs?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      supply_requests: {
        Row: {
          created_at: string
          description: string
          id: string
          item_name: string
          quantity: number
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          item_name: string
          quantity?: number
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_name?: string
          quantity?: number
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_permissions: {
        Row: {
          created_at: string
          granter_id: string
          id: string
          target_type: string
          target_value: string
        }
        Insert: {
          created_at?: string
          granter_id: string
          id?: string
          target_type: string
          target_value: string
        }
        Update: {
          created_at?: string
          granter_id?: string
          id?: string
          target_type?: string
          target_value?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          deadline: string
          description: string
          id: string
          image_url: string | null
          image_urls: Json
          linked_counter_order_id: string | null
          previous_assignee_id: string | null
          priority: string
          response: string | null
          response_attachments: Json
          response_likes: Json
          sector: string | null
          status: string
          status_history: Json
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          deadline: string
          description?: string
          id?: string
          image_url?: string | null
          image_urls?: Json
          linked_counter_order_id?: string | null
          previous_assignee_id?: string | null
          priority?: string
          response?: string | null
          response_attachments?: Json
          response_likes?: Json
          sector?: string | null
          status?: string
          status_history?: Json
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string
          description?: string
          id?: string
          image_url?: string | null
          image_urls?: Json
          linked_counter_order_id?: string | null
          previous_assignee_id?: string | null
          priority?: string
          response?: string | null
          response_attachments?: Json
          response_likes?: Json
          sector?: string | null
          status?: string
          status_history?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracking_entries: {
        Row: {
          client_name: string
          created_at: string
          created_by: string
          description: string
          id: string
          shipping_method: string
          status: string
          tracking_code: string
          updated_at: string
        }
        Insert: {
          client_name?: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
          shipping_method?: string
          status?: string
          tracking_code: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          shipping_method?: string
          status?: string
          tracking_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_feature_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          id: string
          last_seen_at: string
          pause_started_at: string | null
          pause_type: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_seen_at?: string
          pause_started_at?: string | null
          pause_type?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_seen_at?: string
          pause_started_at?: string | null
          pause_type?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tab_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          tab_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          tab_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          tab_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warranty_claims: {
        Row: {
          bank_details: string | null
          client_name: string
          created_at: string
          current_mileage: string | null
          defect_description: string
          id: string
          identity_document_url: string | null
          installation_mileage: string | null
          invoice_number: string
          item_code: string
          item_name: string
          labor_reimbursement_enabled: boolean
          labor_reimbursement_file_url: string | null
          last_26day_notified: boolean
          last_7day_reminder_at: string | null
          product_brand: string
          product_images: Json
          requested_by: string
          sale_date: string
          status: string
          supplier_name: string
          updated_at: string
          vehicle_document_url: string | null
        }
        Insert: {
          bank_details?: string | null
          client_name: string
          created_at?: string
          current_mileage?: string | null
          defect_description?: string
          id?: string
          identity_document_url?: string | null
          installation_mileage?: string | null
          invoice_number?: string
          item_code?: string
          item_name: string
          labor_reimbursement_enabled?: boolean
          labor_reimbursement_file_url?: string | null
          last_26day_notified?: boolean
          last_7day_reminder_at?: string | null
          product_brand: string
          product_images?: Json
          requested_by: string
          sale_date: string
          status?: string
          supplier_name?: string
          updated_at?: string
          vehicle_document_url?: string | null
        }
        Update: {
          bank_details?: string | null
          client_name?: string
          created_at?: string
          current_mileage?: string | null
          defect_description?: string
          id?: string
          identity_document_url?: string | null
          installation_mileage?: string | null
          invoice_number?: string
          item_code?: string
          item_name?: string
          labor_reimbursement_enabled?: boolean
          labor_reimbursement_file_url?: string | null
          last_26day_notified?: boolean
          last_7day_reminder_at?: string | null
          product_brand?: string
          product_images?: Json
          requested_by?: string
          sale_date?: string
          status?: string
          supplier_name?: string
          updated_at?: string
          vehicle_document_url?: string | null
        }
        Relationships: []
      }
      warranty_updates: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          user_id: string
          warranty_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          user_id: string
          warranty_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_updates_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          days: Json
          id: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days?: Json
          id?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: Json
          id?: string
          updated_at?: string
          user_id?: string
          week_start?: string
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
