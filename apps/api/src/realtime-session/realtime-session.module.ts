import { Module } from "@nestjs/common";
import { OpenAILiveSessionProvider } from "@english-coach/ai";
import { TopicModule } from "../topic/topic.module";
import { RealtimeSessionController } from "./realtime-session.controller";
import { LIVE_SESSION_PROVIDER } from "./realtime-session.provider";
import { RealtimeSessionService } from "./realtime-session.service";

@Module({
  imports: [TopicModule],
  controllers: [RealtimeSessionController],
  providers: [
    RealtimeSessionService,
    {
      provide: LIVE_SESSION_PROVIDER,
      useFactory: () =>
        new OpenAILiveSessionProvider({
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1",
        }),
    },
  ],
})
export class RealtimeSessionModule {}
