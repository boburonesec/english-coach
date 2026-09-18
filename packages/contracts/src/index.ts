export const TOPIC_CATEGORIES = ["work", "opinion", "personal_story"] as const;

export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export interface ConversationTopic {
  id: string;
  category: TopicCategory;
  title: string;
  context: string;
  openingQuestion: string;
}

export type TopicOptionsResponse = readonly ConversationTopic[];

export interface CreateRealtimeSessionRequest {
  topicId: string;
  sdp: string;
}

export interface CreateRealtimeSessionResponse {
  sessionId: string;
  sdp: string;
}
