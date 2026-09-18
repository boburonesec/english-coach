import { Injectable } from "@nestjs/common";
import type { ConversationTopic, TopicOptionsResponse } from "@english-coach/contracts";
import { CURATED_TOPIC_OPTIONS } from "./topic.catalogue";

@Injectable()
export class TopicService {
  getOptions(): TopicOptionsResponse {
    return CURATED_TOPIC_OPTIONS;
  }

  findById(topicId: string): ConversationTopic | undefined {
    return CURATED_TOPIC_OPTIONS.find((topic) => topic.id === topicId);
  }
}
