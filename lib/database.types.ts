export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          automation_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          automation_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          automation_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          actions: Json
          created_at: string | null
          created_by: string | null
          id: string
          instance_id: string | null
          lead_status: string[] | null
          name: string
          source_ids: string[] | null
          status: string | null
          tags: string[] | null
          tenant_id: string | null
          total_executions: number | null
          trigger_config: Json | null
          trigger_type: string
        }
        Insert: {
          actions: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_id?: string | null
          lead_status?: string[] | null
          name: string
          source_ids?: string[] | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          total_executions?: number | null
          trigger_config?: Json | null
          trigger_type: string
        }
        Update: {
          actions?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_id?: string | null
          lead_status?: string[] | null
          name?: string
          source_ids?: string[] | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          total_executions?: number | null
          trigger_config?: Json | null
          trigger_type?: string
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          message_id: string | null
          phone: string | null
          read_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          phone?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          phone?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          actual_cost: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          delivered_count: number | null
          estimated_cost: number | null
          failed_count: number | null
          id: string
          instance_id: string | null
          lead_status: string[] | null
          message_template: string
          name: string
          read_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          settings: Json | null
          source_ids: string[] | null
          started_at: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string | null
          total_recipients: number | null
        }
        Insert: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          estimated_cost?: number | null
          failed_count?: number | null
          id?: string
          instance_id?: string | null
          lead_status?: string[] | null
          message_template: string
          name: string
          read_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          settings?: Json | null
          source_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          total_recipients?: number | null
        }
        Update: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          estimated_cost?: number | null
          failed_count?: number | null
          id?: string
          instance_id?: string | null
          lead_status?: string[] | null
          message_template?: string
          name?: string
          read_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          settings?: Json | null
          source_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          total_recipients?: number | null
        }
        Relationships: []
      }
      chats: {
        Row: {
          archived: boolean | null
          assigned_to: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          instance_id: string | null
          last_message: string | null
          last_message_from_me: boolean | null
          last_message_at: string | null
          lead_id: string | null
          remote_jid: string
          tags: string[] | null
          tenant_id: string | null
          unread_count: number | null
        }
        Insert: {
          archived?: boolean | null
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_at?: string | null
          lead_id?: string | null
          remote_jid: string
          tags?: string[] | null
          tenant_id?: string | null
          unread_count?: number | null
        }
        Update: {
          archived?: boolean | null
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_at?: string | null
          lead_id?: string | null
          remote_jid?: string
          tags?: string[] | null
          tenant_id?: string | null
          unread_count?: number | null
        }
        Relationships: []
      }
      contact_list_members: {
        Row: {
          added_at: string | null
          id: string
          lead_id: string | null
          list_id: string | null
          phone: string | null
        }
        Insert: {
          added_at?: string | null
          id?: string
          lead_id?: string | null
          list_id?: string | null
          phone?: string | null
        }
        Update: {
          added_at?: string | null
          id?: string
          lead_id?: string | null
          list_id?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      contact_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          member_count: number | null
          name: string
          tenant_id: string | null
          total_contacts: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          member_count?: number | null
          name: string
          tenant_id?: string | null
          total_contacts?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          member_count?: number | null
          name?: string
          tenant_id?: string | null
          total_contacts?: number | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string | null
          description: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          type: string
          user_id: string | null
        }
        Insert: {
          activity_type?: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          type?: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lead_id: string | null
          pinned: boolean | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          pinned?: boolean | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          pinned?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          active: boolean | null
          created_at: string | null
          field_mapping: Json | null
          id: string
          is_active: boolean | null
          name: string
          source_type: string | null
          tenant_id: string | null
          total_leads: number | null
          type: string
          webhook_secret: string | null
          webhook_url: string | null
          webhook_verified: boolean | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          field_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          source_type?: string | null
          tenant_id?: string | null
          total_leads?: number | null
          type?: string
          webhook_secret?: string | null
          webhook_url?: string | null
          webhook_verified?: boolean | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          field_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          source_type?: string | null
          tenant_id?: string | null
          total_leads?: number | null
          type?: string
          webhook_secret?: string | null
          webhook_url?: string | null
          webhook_verified?: boolean | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          cpf: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          external_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          score: number | null
          source_id: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          cpf?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          external_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          score?: number | null
          source_id?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          cpf?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          external_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          score?: number | null
          source_id?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string | null
          created_at: string | null
          from_me: boolean | null
          id: string
          media_url: string | null
          message_id: string | null
          message_type: string | null
          remote_jid: string
          status: string | null
          timestamp: string | null
        }
        Insert: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          from_me?: boolean | null
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_type?: string | null
          remote_jid: string
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          from_me?: boolean | null
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_type?: string | null
          remote_jid?: string
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      platform_metrics: {
        Row: {
          active_tenants: number | null
          created_at: string | null
          id: string
          metric_date: string
          mrr: number | null
          total_leads: number | null
          total_messages_sent: number | null
          total_tenants: number | null
        }
        Insert: {
          active_tenants?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          mrr?: number | null
          total_leads?: number | null
          total_messages_sent?: number | null
          total_tenants?: number | null
        }
        Update: {
          active_tenants?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          mrr?: number | null
          total_leads?: number | null
          total_messages_sent?: number | null
          total_tenants?: number | null
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          permissions: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          permissions?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          permissions?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string
          role: string | null
          settings: Json | null
          status: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name: string
          role?: string | null
          settings?: Json | null
          status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string
          role?: string | null
          settings?: Json | null
          status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          max_campaigns_per_month: number | null
          max_leads: number | null
          max_users: number | null
          max_whatsapp_instances: number | null
          monthly_price: number | null
          name: string
          plan: string | null
          primary_color: string | null
          settings: Json | null
          slug: string
          status: string | null
          timezone: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_campaigns_per_month?: number | null
          max_leads?: number | null
          max_users?: number | null
          max_whatsapp_instances?: number | null
          monthly_price?: number | null
          name: string
          plan?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_campaigns_per_month?: number | null
          max_leads?: number | null
          max_users?: number | null
          max_whatsapp_instances?: number | null
          monthly_price?: number | null
          name?: string
          plan?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
          type: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          type: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          type?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          reserved_balance: number | null
          tenant_id: string | null
          total_added: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          reserved_balance?: number | null
          tenant_id?: string | null
          total_added?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          reserved_balance?: number | null
          tenant_id?: string | null
          total_added?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json
          processed: boolean | null
          received_at: string | null
          signature_valid: boolean | null
          source_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          processed?: boolean | null
          received_at?: string | null
          signature_valid?: boolean | null
          source_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean | null
          received_at?: string | null
          signature_valid?: boolean | null
          source_id?: string | null
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          color: string | null
          created_at: string | null
          evolution_api_url: string | null
          id: string
          instance_name: string
          instance_token: string
          last_connected_at: string | null
          name: string
          phone_number: string | null
          qrcode: string | null
          status: string | null
          tenant_id: string | null
          total_messages_sent: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_name: string
          instance_token?: string
          last_connected_at?: string | null
          name: string
          phone_number?: string | null
          qrcode?: string | null
          status?: string | null
          tenant_id?: string | null
          total_messages_sent?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_name?: string
          instance_token?: string
          last_connected_at?: string | null
          name?: string
          phone_number?: string | null
          qrcode?: string | null
          status?: string | null
          tenant_id?: string | null
          total_messages_sent?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_wallet_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_reference_id?: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      deduct_wallet_balance: {
        Args: { p_amount: number; p_description?: string; p_tenant_id: string }
        Returns: boolean
      }
      increment_campaign_failed: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      increment_campaign_sent: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      record_lead_activity: {
        Args: {
          p_activity_type: string
          p_description: string
          p_lead_id: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: string
      }
      update_campaign_send_status: {
        Args: { p_message_id: string; p_status: string }
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
