import { Controller, Get, Inject } from "@nestjs/common";
import type { TopicOptionsResponse } from "@english-coach/contracts";
import { TopicService } from "./topic.service";

@Controller("topics")
export class TopicController {
  constructor(@Inject(TopicService) private readonly topicService: TopicService) {}

  @Get("options")
  getOptions(): TopicOptionsResponse {
    return this.topicService.getOptions();
  }
}
