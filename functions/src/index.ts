import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
import {setGlobalOptions} from "firebase-functions";
import {defineSecret, defineString} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const geminiModel = defineString("GEMINI_MODEL", {
  default: "gemini-2.5-flash",
});

interface ParseCalendarRequest {
  text?: unknown;
  users?: unknown;
  sectors?: unknown;
}

interface CalendarEvent {
  title: string;
  description?: string;
  date: string;
  time: string | null;
  type: "event" | "reminder";
  targetMode: "all" | "sector" | "specific";
  targetInfo: string;
}

interface CreateEventsArgs {
  events?: CalendarEvent[];
}

const createEventsTool = {
  name: "create_events",
  description: "Cria eventos e lembretes extraídos do texto informado.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      events: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Título curto do evento ou lembrete.",
            },
            description: {
              type: Type.STRING,
              description: "Descrição opcional.",
            },
            date: {
              type: Type.STRING,
              description: "Data no formato YYYY-MM-DD.",
            },
            time: {
              type: Type.STRING,
              description: "Horário no formato HH:MM ou string vazia.",
              nullable: true,
            },
            type: {
              type: Type.STRING,
              enum: ["event", "reminder"],
            },
            targetMode: {
              type: Type.STRING,
              enum: ["all", "sector", "specific"],
            },
            targetInfo: {
              type: Type.STRING,
              description:
                "Nome do setor, 'todos' ou nomes separados por vírgula.",
            },
          },
          required: [
            "title",
            "date",
            "type",
            "targetMode",
            "targetInfo",
          ],
        },
      },
    },
    required: ["events"],
  },
};

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as {status?: unknown}).status === "number"
  ) {
    return (error as {status: number}).status;
  }

  return undefined;
}

export const parseCalendarEvents = onCall(
  {
    secrets: [geminiApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    const input = (request.data ?? {}) as ParseCalendarRequest;
    const text = input.text;

    if (typeof text !== "string" || !text.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "Texto é obrigatório."
      );
    }

    const users = Array.isArray(input.users) ? input.users : [];
    const sectors = Array.isArray(input.sectors) ? input.sectors : [];

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const dayOfWeek = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      timeZone: "America/Sao_Paulo",
    });

    const systemInstruction = [
      "Você é um assistente que extrai eventos e lembretes de calendário",
      "a partir de texto em português.",
      `Hoje é ${today} (${dayOfWeek}).`,
      "",
      `Usuários disponíveis: ${JSON.stringify(users)}`,
      `Setores disponíveis: ${JSON.stringify(sectors)}`,
      "",
      "Para cada evento encontrado, use a função create_events.",
      "",
      "Regras:",
      '- Se mencionar "todos" ou "empresa toda", targetMode = "all".',
      "- Se mencionar um setor específico, targetMode = \"sector\".",
      "- Em targetInfo, informe o nome do setor.",
      "- Se mencionar pessoas específicas, targetMode = \"specific\".",
      "- Em targetInfo, informe os nomes separados por vírgula.",
      '- Se não especificar destinatário, targetMode = "all".',
      '- Se disser "lembrete", type = "reminder"; senão, "event".',
      "- Interprete datas relativas com base na data de hoje.",
      "- Se não especificar horário, use time = null.",
      "- date deve estar no formato YYYY-MM-DD.",
      "- time deve estar no formato HH:MM quando existir.",
    ].join("\n");

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey.value(),
      });

      const response = await ai.models.generateContent({
        model: geminiModel.value(),
        contents: text.trim(),
        config: {
          systemInstruction,
          tools: [
            {
              functionDeclarations: [createEventsTool],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: ["create_events"],
            },
          },
        },
      });

      const functionCall = response.functionCalls?.find(
        (call) => call.name === "create_events"
      );

      if (!functionCall) {
        logger.error("Gemini não retornou create_events.", {
          text: text.trim(),
        });

        throw new HttpsError(
          "internal",
          "A IA não retornou os eventos esperados."
        );
      }

      const args = (functionCall.args ?? {}) as CreateEventsArgs;
      const events = Array.isArray(args.events) ? args.events : [];

      return {events};
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      const status = getErrorStatus(error);

      logger.error("Erro em parseCalendarEvents.", {
        status,
        error,
      });

      if (status === 429) {
        throw new HttpsError(
          "resource-exhausted",
          "Limite de requisições excedido. Tente novamente em alguns segundos."
        );
      }

      if (status === 402) {
        throw new HttpsError(
          "failed-precondition",
          "Créditos da API de IA insuficientes."
        );
      }

      throw new HttpsError(
        "internal",
        "Não foi possível processar os eventos do calendário."
      );
    }
  }
);
