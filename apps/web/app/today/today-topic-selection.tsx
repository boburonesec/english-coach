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
  const sessionIsBusy = !["idle", "error", "completed"].includes(
    realtimeSession.status,
  );
  const conversationIsLive = ["opening", "conversation_active", "ending"].includes(
    realtimeSession.status,
  );

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
                {conversationIsLive ? (
                  <>
                    <div className="conversation-state">
                      <div>
                        <span>Conversation status</span>
                        <strong>
                          {realtimeSession.status === "opening"
                            ? "AI is opening the conversation"
                            : realtimeSession.status === "ending"
                              ? "Ending conversation"
                              : "Conversation live"}
                        </strong>
                      </div>
                      <div>
                        <span>Microphone</span>
                        <strong>
                          {realtimeSession.microphoneEnabled ? "On" : "Off"}
                        </strong>
                      </div>
                    </div>
                    <p className="connection-status">
                      Speak naturally. Corrections wait until a future post-conversation review.
                    </p>
                    {realtimeSession.audioBlocked ? (
                      <div className="audio-warning" role="alert">
                        <span>Your browser blocked the conversation audio.</span>
                        <button type="button" onClick={() => void realtimeSession.resumeAudio()}>
                          Play audio
                        </button>
                      </div>
                    ) : null}
                    {realtimeSession.error ? (
                      <p className="connection-error" role="alert">
                        {realtimeSession.error}
                      </p>
                    ) : null}
                    <div className="conversation-actions">
                      <button
                        className="secondary-action"
                        type="button"
                        disabled={
                          realtimeSession.status !== "conversation_active" ||
                          realtimeSession.hintPending
                        }
                        onClick={realtimeSession.requestHint}
                      >
                        {realtimeSession.hintPending ? "Hint requested…" : "Hint"}
                      </button>
                      <button
                        className="end-action"
                        type="button"
                        disabled={realtimeSession.status === "ending"}
                        onClick={realtimeSession.endConversation}
                      >
                        {realtimeSession.status === "ending"
                          ? "Finishing…"
                          : "End conversation"}
                      </button>
                    </div>
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
                    {realtimeSession.status === "completed" ? (
                      <p className="connection-status">
                        Conversation finished. You can start another one without refreshing.
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
                          : realtimeSession.status === "completed"
                            ? "Start another conversation"
                            : realtimeSession.status === "error"
                              ? "Try conversation again"
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
