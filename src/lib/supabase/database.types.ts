
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "availability_days": {
                  Row: {
                    "group_id": string,"id": string,"local_date": string,"membership_id": string,"mode": string | null,"revision": number,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"local_date": string,"membership_id": string,"mode"?: string | null,"revision"?: number,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"local_date"?: string,"membership_id"?: string,"mode"?: string | null,"revision"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_days_group_id_membership_id_fkey"
      columns: ["group_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"availability_intervals": {
                  Row: {
                    "day_id": string,"ends_at": string,"group_id": string,"id": string,"membership_id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day_id": string,"ends_at": string,"group_id": string,"id"?: string,"membership_id": string,"starts_at": string
                  }
                  Update: {
                    "day_id"?: string,"ends_at"?: string,"group_id"?: string,"id"?: string,"membership_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_intervals_group_id_membership_id_day_id_fkey"
      columns: ["group_id","membership_id","day_id"]
isOneToOne: false
      referencedRelation: "availability_days"
      referencedColumns: ["group_id","membership_id","id"]
    }
                  ]
                },"game_favorites": {
                  Row: {
                    "game_id": string,"group_id": string,"membership_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"group_id": string,"membership_id": string
                  }
                  Update: {
                    "game_id"?: string,"group_id"?: string,"membership_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_favorites_group_id_game_id_fkey"
      columns: ["group_id","game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "game_favorites_group_id_membership_id_fkey"
      columns: ["group_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"games": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string,"description": string,"group_id": string,"id": string,"idempotency_key": string,"name": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by": string,"description"?: string,"group_id": string,"id"?: string,"idempotency_key": string,"name": string,"revision"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string,"group_id"?: string,"id"?: string,"idempotency_key"?: string,"name"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_group_id_created_by_fkey"
      columns: ["group_id","created_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "id": string,"name": string,"quick_end": string,"quick_start": string,"revision": number,"singleton": boolean,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name"?: string,"quick_end"?: string,"quick_start"?: string,"revision"?: number,"singleton"?: boolean,"timezone"?: string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"quick_end"?: string,"quick_start"?: string,"revision"?: number,"singleton"?: boolean,"timezone"?: string
                  }
                  Relationships: [

                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"auth_user_id": string | null,"created_at": string,"delivery_status": string,"expires_at": string,"group_id": string,"id": string,"idempotency_key": string,"invited_by": string,"normalized_email": string,"provisioning_status": string,"revision": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"delivery_status"?: string,"expires_at"?: string,"group_id": string,"id"?: string,"idempotency_key": string,"invited_by": string,"normalized_email": string,"provisioning_status"?: string,"revision"?: number,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"delivery_status"?: string,"expires_at"?: string,"group_id"?: string,"id"?: string,"idempotency_key"?: string,"invited_by"?: string,"normalized_email"?: string,"provisioning_status"?: string,"revision"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "group_id": string,"id": string,"joined_at": string,"revision": number,"revoked_at": string | null,"role": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"joined_at"?: string,"revision"?: number,"revoked_at"?: string | null,"role"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"joined_at"?: string,"revision"?: number,"revoked_at"?: string | null,"role"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "display_name": string,"revision": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"revision"?: number,"user_id": string
                  }
                  Update: {
                    "display_name"?: string,"revision"?: number,"user_id"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "display_name": string }; Returns: string
                           },
"archive_game":
{ Args: { "expected_revision": number,"target_id": string }; Returns: undefined
                           },
"bootstrap_admin":
{ Args: { "account_id": string,"display_name": string }; Returns: undefined
                           },
"change_membership":
{ Args: { "expected_revision": number,"membership_id": string,"new_role": string,"new_status": string }; Returns: undefined
                           },
"consume_auth_limit":
{ Args: { "key_hash": string,"max_attempts": number }; Returns: boolean
                           },
"create_game":
{ Args: { "game_description": string,"game_name": string,"request_id": string }; Returns: string
                           },
"create_invitation":
{ Args: { "email": string,"request_id": string }; Returns: string
                           },
"provisioning_context":
{ Args: { "actor_id": string,"invitation_id": string }; Returns: Json
                           },
"record_invitation_delivery":
{ Args: { "actor_id": string,"delivered": boolean,"invitation_id": string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "expected_revision": number,"invitation_id": string }; Returns: undefined
                           },
"save_availability":
{ Args: { "changes": Json,"sources"?: Json }; Returns: undefined
                           },
"set_game_favorite":
{ Args: { "expected_favorite": boolean,"favorite": boolean,"target_id": string }; Returns: undefined
                           },
"update_game":
{ Args: { "expected_revision": number,"game_description": string,"game_name": string,"target_id": string }; Returns: undefined
                           },
"update_profile":
{ Args: { "display_name": string,"expected_revision": number }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as const
