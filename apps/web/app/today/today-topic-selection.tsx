"use client";

import type {
  ConversationTopic,
  TopicCategory,
  TopicOptionsResponse,
} from "@english-coach/contracts";
import { useEffect, useState } from "react";
import { useRealtimeSession } from "./use-realtime-session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const REQUIRED_CATEGORIES: readonly TopicCategory[] = ["work", "opinion", "personal_story"];

const categoryLabels: Record<TopicCategory, string> = {
  work: "Work",
  opinion: "Opinion",
  personal_story: "Personal story",
};

function isTopic(value: unknown): value is ConversationTopic {
  if (!value || typeof value !== "object") {
    return false;
  }

  const topic = value as Record<string, unknown>;
  return (
    typeof topic.id === "string" &&
    topic.id.trim().length > 0 &&
    REQUIRED_CATEGORIES.includes(topic.category as TopicCategory) &&
    typeof topic.title === "string" &&
    topic.title.trim().length > 0 &&
    typeof topic.context === "string" &&
    topic.context.trim().length > 0 &&
    typeof topic.openingQuestion === "string" &&
    topic.openingQuestion.trim().length > 0
  );
}

function parseTopicOptions(value: unknown): TopicOptionsResponse {
  if (!Array.isArray(value) || value.length !== REQUIRED_CATEGORIES.length || !value.every(isTopic)) {
    throw new Error("The API returned invalid topic options.");
  }

  const ids = new Set(value.map((topic) => topic.id));
  const categories = new Set(value.map((topic) => topic.category));
  if (
    ids.size !== REQUIRED_CATEGORIES.length ||
    REQUIRED_CATEGORIES.some((category) => !categories.has(category))
  ) {
    throw new Error("The API returned invalid topic options.");
  }

  return value;
}

export function TodayTopicSelection() {
  const [topics, setTopics] = useState<TopicOptionsResponse | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const realtimeSession = useRealtimeSession();
  const sessionIsBusy = !["idle", "error"].includes(realtimeSession.status);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTopics(): Promise<void> {
      setTopics(null);
      setSelectedTopic(null);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/topics/options`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Topic request failed with status ${response.status}.`);
        }

        setTopics(parseTopicOptions(await response.json()));
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError("We could not load today's conversations. Please try again.");
        }
      }
    }

    void loadTopics();
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="today-page">
      <header className="today-header">
        <p className="eyebrow">English Coach</p>
        <h1>Which conversation sounds interesting today?</h1>
        <p>Choose one. There is no perfect answer—just bring your point of view.</p>
      </header>

      {error ? (
        <section className="state-panel" aria-live="polite">
          <h2>Conversations are unavailable</h2>
          <p>{error}</p>
          <button className="secondary-action" type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </section>
      ) : !topics ? (
        <p className="loading-state" aria-live="polite">Loading today&apos;s conversations…</p>
      ) : (
        <>
          <section className="topic-grid" aria-label="Conversation choices">
            {topics.map((topic) => (
              <button
                className="topic-card"
                data-selected={selectedTopic?.id === topic.id}
                disabled={sessionIsBusy}
                key={topic.id}
                type="button"
                aria-pressed={selectedTopic?.id === topic.id}
                onClick={() => {
                  if (realtimeSession.status === "error") {
                    realtimeSession.reset();
                  }
                  setSelectedTopic(topic);
                }}
              >
                <span className="category-label">{categoryLabels[topic.category]}</span>
                <strong>{topic.title}</strong>
                <span>Choose this conversation</span>
              </button>
            ))}
          </section>

          {selectedTopic ? (
            <section className="selected-topic" aria-live="polite">
              <p className="category-label">{categoryLabels[selectedTopic.category]}</p>
              <h2>{selectedTopic.title}</h2>
              <p>{selectedTopic.context}</p>
              <div className="opening-question">
                <span>Your opening question</span>
                <strong>{selectedTopic.openingQuestion}</strong>
              </div>
              <div className="session-controls" aria-live="polite">
                {realtimeSession.status === "connected" ? (
                  <>
                    <p className="connection-status">
                      Connected. Your microphone is muted for this setup check.
                    </p>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={realtimeSession.disconnect}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    {realtimeSession.status === "requesting_microphone" ? (
                      <p className="connection-status">Requesting microphone access…</p>
                    ) : null}
                    {realtimeSession.status === "connecting" ? (
                      <p className="connection-status">
                        Connecting securely to the realtime provider…
                      </p>
                    ) : null}
                    {realtimeSession.error ? (
                      <p className="connection-error" role="alert">{realtimeSession.error}</p>
                    ) : null}
                    <button
                      className="primary-action"
                      type="button"
                      disabled={sessionIsBusy}
                      onClick={() => void realtimeSession.start(selectedTopic.id)}
                    >
                      {realtimeSession.status === "requesting_microphone"
                        ? "Requesting microphone…"
                        : realtimeSession.status === "connecting"
                          ? "Connecting…"
                          : realtimeSession.status === "disconnecting"
                            ? "Disconnecting…"
                            : realtimeSession.status === "error"
                              ? "Try connection again"
                              : "Start conversation"}
                    </button>
                  </>
                )}
              </div>
            </section>
          ) : (
            <p className="selection-prompt">Select a conversation to see how it begins.</p>
          )}
        </>
      )}
    </main>
  );
}
