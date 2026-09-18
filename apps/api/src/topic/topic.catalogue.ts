import type {
  ConversationTopic,
  TopicCategory,
  TopicOptionsResponse,
} from "@english-coach/contracts";

const REQUIRED_CATEGORIES = ["work", "opinion", "personal_story"] as const satisfies readonly TopicCategory[];

const topicCatalogue = [
  {
    id: "release-or-delay",
    category: "work",
    title: "Release or delay?",
    context:
      "Your team plans to release a feature tomorrow. QA has found several unstable cases, but the project manager wants to keep the deadline.",
    openingQuestion: "What would you recommend, and why?",
  },
  {
    id: "ai-and-independence",
    category: "opinion",
    title: "Does AI make us too dependent?",
    context:
      "AI tools can make people much faster at work, but some people worry that frequent use reduces independent thinking.",
    openingQuestion: "Do you think heavy AI usage makes people less independent?",
  },
  {
    id: "a-decision-you-changed",
    category: "personal_story",
    title: "A decision you changed",
    context:
      "Sometimes we make a decision and later realize that we would choose differently.",
    openingQuestion: "Tell me about a decision you changed your mind about.",
  },
] as const satisfies TopicOptionsResponse;

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function assertValidTopicOptions(
  topics: readonly ConversationTopic[],
): asserts topics is TopicOptionsResponse {
  if (topics.length !== REQUIRED_CATEGORIES.length) {
    throw new Error("The topic catalogue must contain exactly three topics.");
  }

  const ids = new Set<string>();
  const categories = new Set<TopicCategory>();

  for (const topic of topics) {
    if (
      !hasText(topic.id) ||
      !hasText(topic.title) ||
      !hasText(topic.context) ||
      !hasText(topic.openingQuestion)
    ) {
      throw new Error("Every topic field must contain text.");
    }

    if (ids.has(topic.id)) {
      throw new Error(`Duplicate topic id: ${topic.id}`);
    }

    if (categories.has(topic.category)) {
      throw new Error(`Duplicate topic category: ${topic.category}`);
    }

    ids.add(topic.id);
    categories.add(topic.category);
  }

  for (const category of REQUIRED_CATEGORIES) {
    if (!categories.has(category)) {
      throw new Error(`Missing topic category: ${category}`);
    }
  }
}

assertValidTopicOptions(topicCatalogue);

export const CURATED_TOPIC_OPTIONS: TopicOptionsResponse = topicCatalogue;
