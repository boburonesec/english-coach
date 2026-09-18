import OpenAI from "openai";

export interface CreateLiveSessionInput {
  sdp: string;
  instructions: string;
}

export interface CreatedLiveSession {
  sessionId: string;
  sdp: string;
}

export interface LiveSessionProvider {
  createSession(input: CreateLiveSessionInput): Promise<CreatedLiveSession>;
}

export interface OpenAILiveSessionProviderOptions {
  apiKey?: string;
  model: string;
}

export class OpenAILiveConfigurationError extends Error {
  constructor() {
    super("OpenAI Live is not configured.");
    this.name = "OpenAILiveConfigurationError";
  }
}

export class OpenAILiveSessionError extends Error {
  constructor() {
    super("OpenAI Live session creation failed.");
    this.name = "OpenAILiveSessionError";
  }
}

export class OpenAILiveSessionProvider implements LiveSessionProvider {
  constructor(private readonly options: OpenAILiveSessionProviderOptions) {}

  async createSession(input: CreateLiveSessionInput): Promise<CreatedLiveSession> {
    const apiKey = this.options.apiKey?.trim();
    if (!apiKey) {
      throw new OpenAILiveConfigurationError();
    }

    try {
      const client = new OpenAI({ apiKey, maxRetries: 0 });
      const live = await client.live.create({
        session: {
          model: this.options.model,
          instructions: input.instructions,
          client: {
            data_channel: {
              allowed_client_events: [
                "session.commentary.append",
                "session.close",
              ],
              allowed_server_events: [
                { type: "session.started" },
                { type: "session.commentary.appended" },
                { type: "session.output_transcript.delta" },
                { type: "session.closed" },
                { type: "error" },
              ],
            },
          },
        },
        transport: {
          type: "webrtc",
          sdp: input.sdp,
        },
      });

      return {
        sessionId: live.session.id,
        sdp: live.transport.sdp,
      };
    } catch (error) {
      if (error instanceof OpenAILiveConfigurationError) {
        throw error;
      }

      throw new OpenAILiveSessionError();
    }
  }
}
