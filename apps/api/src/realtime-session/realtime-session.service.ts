import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  OpenAILiveConfigurationError,
  OpenAILiveSessionError,
} from "@english-coach/ai";
import type {
  CreateRealtimeSessionRequest,
  CreateRealtimeSessionResponse,
} from "@english-coach/contracts";
import { TopicService } from "../topic/topic.service";
import {
  LIVE_SESSION_PROVIDER,
  type LiveSessionProvider,
} from "./realtime-session.provider";
import { buildRealtimeConversationInstructions } from "./realtime-conversation.prompt";

const MAX_SDP_LENGTH = 1_000_000;

function parseRequest(value: unknown): CreateRealtimeSessionRequest {
  if (!value || typeof value !== "object") {
    throw new BadRequestException("A topic ID and SDP offer are required.");
  }

  const request = value as Record<string, unknown>;
  const topicId = typeof request.topicId === "string" ? request.topicId.trim() : "";
  const sdp = typeof request.sdp === "string" ? request.sdp.trim() : "";

  if (!topicId || topicId.length > 128) {
    throw new BadRequestException("A valid topic ID is required.");
  }

  if (!sdp.startsWith("v=0") || sdp.length > MAX_SDP_LENGTH) {
    throw new BadRequestException("A valid WebRTC SDP offer is required.");
  }

  return { topicId, sdp };
}

@Injectable()
export class RealtimeSessionService {
  constructor(
    @Inject(TopicService) private readonly topicService: TopicService,
    @Inject(LIVE_SESSION_PROVIDER) private readonly liveSessionProvider: LiveSessionProvider,
  ) {}

  async create(requestBody: unknown): Promise<CreateRealtimeSessionResponse> {
    const request = parseRequest(requestBody);
    const topic = this.topicService.findById(request.topicId);

    if (!topic) {
      throw new NotFoundException("Conversation topic not found.");
    }

    const instructions = buildRealtimeConversationInstructions(topic);

    try {
      return await this.liveSessionProvider.createSession({
        sdp: request.sdp,
        instructions,
      });
    } catch (error) {
      if (error instanceof OpenAILiveConfigurationError) {
        throw new ServiceUnavailableException("Realtime sessions are not configured.");
      }

      if (error instanceof OpenAILiveSessionError) {
        throw new BadGatewayException("The realtime provider could not create a session.");
      }

      throw new BadGatewayException("The realtime provider could not create a session.");
    }
  }
}
