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
      ai_uso: {
        Row: {
          dia: string
          user_id: string
          usos: number
        }
        Insert: {
          dia?: string
          user_id: string
          usos?: number
        }
        Update: {
          dia?: string
          user_id?: string
          usos?: number
        }
        Relationships: []
      }
      answers: {
        Row: {
          acertou: boolean
          alternativa: number
          created_at: string
          question_id: number
          user_id: string
        }
        Insert: {
          acertou?: boolean
          alternativa: number
          created_at?: string
          question_id: number
          user_id: string
        }
        Update: {
          acertou?: boolean
          alternativa?: number
          created_at?: string
          question_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assuntos: {
        Row: {
          created_at: string
          disciplina_id: number
          id: number
          nome: string
        }
        Insert: {
          created_at?: string
          disciplina_id: number
          id?: number
          nome: string
        }
        Update: {
          created_at?: string
          disciplina_id?: number
          id?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "assuntos_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      bancas: {
        Row: {
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      disciplinas: {
        Row: {
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          conteudo: string
          doc_id: number
          embedding: string
          id: number
          ordem: number
        }
        Insert: {
          conteudo: string
          doc_id: number
          embedding: string
          id?: number
          ordem?: number
        }
        Update: {
          conteudo?: string
          doc_id?: number
          embedding?: string
          id?: number
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_docs: {
        Row: {
          conteudo: string
          created_at: string
          disciplina_id: number | null
          id: number
          titulo: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          disciplina_id?: number | null
          id?: number
          titulo: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          disciplina_id?: number | null
          id?: number
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_docs_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      niveis: {
        Row: {
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          created_at?: string
          id?: never
          nome: string
        }
        Update: {
          created_at?: string
          id?: never
          nome?: string
        }
        Relationships: []
      }
      orgaos: {
        Row: {
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      question_assuntos: {
        Row: {
          assunto_id: number
          question_id: number
        }
        Insert: {
          assunto_id: number
          question_id: number
        }
        Update: {
          assunto_id?: number
          question_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_assuntos_assunto_id_fkey"
            columns: ["assunto_id"]
            isOneToOne: false
            referencedRelation: "assuntos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_assuntos_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          alternativas: string[]
          ano: number
          assunto: string
          assunto_id: number | null
          banca: string
          banca_id: number | null
          busca: unknown
          comentario: string
          correta: number
          created_at: string
          created_by: string | null
          disciplina: string
          disciplina_id: number | null
          enunciado: string
          id: number
          imagem_url: string
          nivel: string
          nivel_id: number | null
          orgao: string
          orgao_id: number | null
          tipo: string
          video_url: string
        }
        Insert: {
          alternativas: string[]
          ano: number
          assunto: string
          assunto_id?: number | null
          banca: string
          banca_id?: number | null
          busca?: never
          comentario?: string
          correta: number
          created_at?: string
          created_by?: string | null
          disciplina: string
          disciplina_id?: number | null
          enunciado: string
          id?: number
          imagem_url?: string
          nivel?: string
          nivel_id?: number | null
          orgao: string
          orgao_id?: number | null
          tipo?: string
          video_url?: string
        }
        Update: {
          alternativas?: string[]
          ano?: number
          assunto?: string
          assunto_id?: number | null
          banca?: string
          banca_id?: number | null
          busca?: never
          comentario?: string
          correta?: number
          created_at?: string
          created_by?: string | null
          disciplina?: string
          disciplina_id?: number | null
          enunciado?: string
          id?: number
          imagem_url?: string
          nivel?: string
          nivel_id?: number | null
          orgao?: string
          orgao_id?: number | null
          tipo?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_assunto_id_fkey"
            columns: ["assunto_id"]
            isOneToOne: false
            referencedRelation: "assuntos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_nivel_id_fkey"
            columns: ["nivel_id"]
            isOneToOne: false
            referencedRelation: "niveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          acertos: number
          resolvidas: number
          user_id: string
        }
        Insert: {
          acertos?: number
          resolvidas?: number
          user_id: string
        }
        Update: {
          acertos?: number
          resolvidas?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_question: {
        Args: { p_id: number }
        Returns: Database["public"]["Tables"]["questions"]["Row"][]
      }
      admin_list_users: {
        Args: never
        Returns: {
          acertos: number
          created_at: string
          email: string
          id: string
          is_admin: boolean
          questoes: number
          resolvidas: number
          username: string
        }[]
      }
      anos_questoes: {
        Args: never
        Returns: number[]
      }
      buscar_questoes: {
        Args: {
          p_ano?: number
          p_assunto_id?: number
          p_banca_id?: number
          p_busca?: string
          p_disciplina_id?: number
          p_nivel_id?: number
          p_orgao_id?: number
          p_situacao?: string
          p_tipo?: string
          p_antes_de?: number
          p_limite?: number
        }
        Returns: {
          acertou: boolean | null
          alternativas: string[]
          ano: number
          assuntos: string[]
          banca: string
          comentario: string | null
          correta: number | null
          disciplina: string
          enunciado: string
          id: number
          imagem_url: string
          nivel: string
          orgao: string
          respondida: number | null
          tipo: string
          video_url: string
        }[]
      }
      consumir_cota_ia: {
        Args: { p_limite: number }
        Returns: boolean
      }
      contar_questoes: {
        Args: {
          p_ano?: number
          p_assunto_id?: number
          p_banca_id?: number
          p_busca?: string
          p_disciplina_id?: number
          p_nivel_id?: number
          p_orgao_id?: number
          p_situacao?: string
          p_tipo?: string
        }
        Returns: number
      }
      get_ranking: {
        Args: never
        Returns: {
          acertos: number
          resolvidas: number
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge: {
        Args: {
          filtro_disciplina?: number
          match_count?: number
          query_embedding: string
        }
        Returns: {
          conteudo: string
          doc_id: number
          id: number
          ordem: number
          similarity: number
          titulo: string
        }[]
      }
      responder_questao: {
        Args: { p_alternativa: number; p_question_id: number }
        Returns: {
          acertou: boolean
          alternativa: number
          comentario: string
          correta: number
        }[]
      }
      sem_acento: {
        Args: { "": string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
