export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      super_admins: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          permissions: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email: string
          permissions?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string
          permissions?: Json | null
          created_at?: string | null
        }
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          plan: string | null
          status: string | null
          max_users: number | null
          max_leads: number | null
          max_whatsapp_instances: number | null
          max_campaigns_per_month: number | null
          monthly_price: number | null
          trial_ends_at: string | null
          settings: Json | null
          timezone: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          plan?: string | null
          status?: string | null
          max_users?: number | null
          max_leads?: number | null
          max_whatsapp_instances?: number | null
          max_campaigns_per_month?: number | null
          monthly_price?: number | null
          trial_ends_at?: string | null
          settings?: Json | null
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          plan?: string | null
          status?: string | null
          max_users?: number | null
          max_leads?: number | null
          max_whatsapp_instances?: number | null
          max_campaigns_per_month?: number | null
          monthly_price?: number | null
          trial_ends_at?: string | null
          settings?: Json | null
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tenant_users: {
        Row: {
          id: string
          tenant_id: string | null
          user_id: string | null
          name: string
          email: string
          avatar_url: string | null
          role: string | null
          status: string | null
          last_login_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          name: string
          email: string
          avatar_url?: string | null
          role?: string | null
          status?: string | null
          last_login_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          name?: string
          email?: string
          avatar_url?: string | null
          role?: string | null
          status?: string | null
          last_login_at?: string | null
          created_at?: string | null
        }
      }
      lead_sources: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          type: string
          webhook_url: string | null
          webhook_secret: string | null
          webhook_verified: boolean | null
          field_mapping: Json | null
          total_leads: number | null
          active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          type: string
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_verified?: boolean | null
          field_mapping?: Json | null
          total_leads?: number | null
          active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          type?: string
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_verified?: boolean | null
          field_mapping?: Json | null
          total_leads?: number | null
          active?: boolean | null
          created_at?: string | null
        }
      }
      leads: {
        Row: {
          id: string
          tenant_id: string | null
          source_id: string | null
          external_id: string | null
          name: string
          email: string | null
          phone: string | null
          cpf: string | null
          status: string | null
          score: number | null
          tags: string[] | null
          custom_fields: Json | null
          assigned_to: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          source_id?: string | null
          external_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          cpf?: string | null
          status?: string | null
          score?: number | null
          tags?: string[] | null
          custom_fields?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          source_id?: string | null
          external_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          cpf?: string | null
          status?: string | null
          score?: number | null
          tags?: string[] | null
          custom_fields?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      lead_notes: {
        Row: {
          id: string
          lead_id: string | null
          user_id: string | null
          content: string
          pinned: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          content: string
          pinned?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          content?: string
          pinned?: boolean | null
          created_at?: string | null
        }
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string | null
          user_id: string | null
          type: string
          content: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          type: string
          content?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          type?: string
          content?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      whatsapp_instances: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          instance_name: string
          instance_token: string
          status: string | null
          phone_number: string | null
          qrcode: string | null
          color: string | null
          evolution_api_url: string | null
          total_messages_sent: number | null
          last_connected_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          instance_name: string
          instance_token: string
          status?: string | null
          phone_number?: string | null
          qrcode?: string | null
          color?: string | null
          evolution_api_url?: string | null
          total_messages_sent?: number | null
          last_connected_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          instance_name?: string
          instance_token?: string
          status?: string | null
          phone_number?: string | null
          qrcode?: string | null
          color?: string | null
          evolution_api_url?: string | null
          total_messages_sent?: number | null
          last_connected_at?: string | null
          created_at?: string | null
        }
      }
      chats: {
        Row: {
          id: string
          tenant_id: string | null
          lead_id: string | null
          instance_id: string | null
          remote_jid: string
          contact_name: string | null
          last_message: string | null
          last_message_at: string | null
          unread_count: number | null
          archived: boolean | null
          assigned_to: string | null
          tags: string[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          lead_id?: string | null
          instance_id?: string | null
          remote_jid: string
          contact_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          unread_count?: number | null
          archived?: boolean | null
          assigned_to?: string | null
          tags?: string[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          lead_id?: string | null
          instance_id?: string | null
          remote_jid?: string
          contact_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          unread_count?: number | null
          archived?: boolean | null
          assigned_to?: string | null
          tags?: string[] | null
          created_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string | null
          message_id: string | null
          from_me: boolean | null
          remote_jid: string
          message_type: string | null
          content: string | null
          media_url: string | null
          status: string | null
          timestamp: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          chat_id?: string | null
          message_id?: string | null
          from_me?: boolean | null
          remote_jid: string
          message_type?: string | null
          content?: string | null
          media_url?: string | null
          status?: string | null
          timestamp?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          chat_id?: string | null
          message_id?: string | null
          from_me?: boolean | null
          remote_jid?: string
          message_type?: string | null
          content?: string | null
          media_url?: string | null
          status?: string | null
          timestamp?: string | null
          created_at?: string | null
        }
      }
      campaigns: {
        Row: {
          id: string
          tenant_id: string | null
          instance_id: string | null
          name: string
          message_template: string
          status: string | null
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          source_ids: string[] | null
          lead_status: string[] | null
          tags: string[] | null
          total_recipients: number | null
          sent_count: number | null
          delivered_count: number | null
          read_count: number | null
          failed_count: number | null
          estimated_cost: number | null
          actual_cost: number | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name: string
          message_template: string
          status?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_recipients?: number | null
          sent_count?: number | null
          delivered_count?: number | null
          read_count?: number | null
          failed_count?: number | null
          estimated_cost?: number | null
          actual_cost?: number | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name?: string
          message_template?: string
          status?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_recipients?: number | null
          sent_count?: number | null
          delivered_count?: number | null
          read_count?: number | null
          failed_count?: number | null
          estimated_cost?: number | null
          actual_cost?: number | null
          created_by?: string | null
          created_at?: string | null
        }
      }
      campaign_sends: {
        Row: {
          id: string
          campaign_id: string | null
          lead_id: string | null
          message_id: string | null
          status: string | null
          error_message: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          campaign_id?: string | null
          lead_id?: string | null
          message_id?: string | null
          status?: string | null
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string | null
          lead_id?: string | null
          message_id?: string | null
          status?: string | null
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string | null
        }
      }
      contact_lists: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          description: string | null
          total_contacts: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          description?: string | null
          total_contacts?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          description?: string | null
          total_contacts?: number | null
          created_at?: string | null
        }
      }
      contact_list_members: {
        Row: {
          id: string
          list_id: string | null
          lead_id: string | null
          added_at: string | null
        }
        Insert: {
          id?: string
          list_id?: string | null
          lead_id?: string | null
          added_at?: string | null
        }
        Update: {
          id?: string
          list_id?: string | null
          lead_id?: string | null
          added_at?: string | null
        }
      }
      automations: {
        Row: {
          id: string
          tenant_id: string | null
          instance_id: string | null
          name: string
          status: string | null
          trigger_type: string
          trigger_config: Json | null
          actions: Json
          source_ids: string[] | null
          lead_status: string[] | null
          tags: string[] | null
          total_executions: number | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name: string
          status?: string | null
          trigger_type: string
          trigger_config?: Json | null
          actions: Json
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_executions?: number | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name?: string
          status?: string | null
          trigger_type?: string
          trigger_config?: Json | null
          actions?: Json
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_executions?: number | null
          created_by?: string | null
          created_at?: string | null
        }
      }
      automation_executions: {
        Row: {
          id: string
          automation_id: string | null
          lead_id: string | null
          status: string | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          automation_id?: string | null
          lead_id?: string | null
          status?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          automation_id?: string | null
          lead_id?: string | null
          status?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
      }
      wallets: {
        Row: {
          id: string
          tenant_id: string | null
          balance: number | null
          total_spent: number | null
          total_added: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          balance?: number | null
          total_spent?: number | null
          total_added?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          balance?: number | null
          total_spent?: number | null
          total_added?: number | null
          created_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          wallet_id: string | null
          type: string
          amount: number
          description: string | null
          reference_id: string | null
          reference_type: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          wallet_id?: string | null
          type: string
          amount: number
          description?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          wallet_id?: string | null
          type?: string
          amount?: number
          description?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string | null
        }
      }
      platform_metrics: {
        Row: {
          id: string
          metric_date: string
          total_tenants: number | null
          active_tenants: number | null
          total_leads: number | null
          total_messages_sent: number | null
          mrr: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          metric_date: string
          total_tenants?: number | null
          active_tenants?: number | null
          total_leads?: number | null
          total_messages_sent?: number | null
          mrr?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          metric_date?: string
          total_tenants?: number | null
          active_tenants?: number | null
          total_leads?: number | null
          total_messages_sent?: number | null
          mrr?: number | null
          created_at?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string | null
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string | null
        }
      }
      webhook_events: {
        Row: {
          id: string
          source_id: string | null
          event_type: string | null
          payload: Json
          signature_valid: boolean | null
          processed: boolean | null
          error_message: string | null
          received_at: string | null
        }
        Insert: {
          id?: string
          source_id?: string | null
          event_type?: string | null
          payload: Json
          signature_valid?: boolean | null
          processed?: boolean | null
          error_message?: string | null
          received_at?: string | null
        }
        Update: {
          id?: string
          source_id?: string | null
          event_type?: string | null
          payload?: Json
          signature_valid?: boolean | null
          processed?: boolean | null
          error_message?: string | null
          received_at?: string | null
        }
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
  }
}
