import { Body, Controller, Inject, Post } from "@nestjs/common";
import type { CreateRealtimeSessionResponse } from "@english-coach/contracts";
import { RealtimeSessionService } from "./realtime-session.service";

@Controller("realtime/sessions")
export class RealtimeSessionController {
  constructor(
    @Inject(RealtimeSessionService)
    private readonly realtimeSessionService: RealtimeSessionService,
  ) {}

  @Post()
  create(@Body() body: unknown): Promise<CreateRealtimeSessionResponse> {
    return this.realtimeSessionService.create(body);
  }
}
