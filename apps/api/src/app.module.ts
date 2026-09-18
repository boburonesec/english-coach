import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { RealtimeSessionModule } from "./realtime-session/realtime-session.module";
import { TopicModule } from "./topic/topic.module";

@Module({
  imports: [TopicModule, RealtimeSessionModule],
  controllers: [HealthController],
})
export class AppModule {}
