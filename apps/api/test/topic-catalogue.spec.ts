import type { ConversationTopic } from "@english-coach/contracts";
import { describe, expect, it } from "vitest";
import { assertValidTopicOptions } from "../src/topic/topic.catalogue";

describe("topic catalogue validation", () => {
  it("rejects malformed catalogue entries", () => {
    const invalidTopics: ConversationTopic[] = [
      {
        id: "duplicate",
        category: "work",
        title: "Valid title",
        context: "Valid context",
        openingQuestion: "Valid question?",
      },
      {
        id: "duplicate",
        category: "opinion",
        title: "Valid title",
        context: "Valid context",
        openingQuestion: "Valid question?",
      },
      {
        id: "story",
        category: "personal_story",
        title: " ",
        context: "Valid context",
        openingQuestion: "Valid question?",
      },
    ];

    expect(() => assertValidTopicOptions(invalidTopics)).toThrow();
  });
});
