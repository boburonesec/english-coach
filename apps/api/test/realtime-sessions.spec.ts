import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  OpenAILiveConfigurationError,
  OpenAILiveSessionError,
  type LiveSessionProvider,
} from "@english-coach/ai";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { LIVE_SESSION_PROVIDER } from "../src/realtime-session/realtime-session.provider";

describe("POST /realtime/sessions", () => {
  let app: INestApplication;
  const createSession = vi.fn<LiveSessionProvider["createSession"]>();

  beforeEach(async () => {
    createSession.mockReset();
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LIVE_SESSION_PROVIDER)
      .useValue({ createSession } satisfies LiveSessionProvider)
      .compile();

    app = testingModule.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("resolves the topic, delegates, and returns only the normalized response", async () => {
    createSession.mockResolvedValue({
      sessionId: "live_123",
      sdp: "v=0\r\nanswer",
    });

    const response = await request(app.getHttpServer())
      .post("/realtime/sessions")
      .send({ topicId: "release-or-delay", sdp: "v=0\r\noffer" })
      .expect(201);

    expect(response.body).toEqual({
      sessionId: "live_123",
      sdp: "v=0\r\nanswer",
    });
    expect(Object.keys(response.body).sort()).toEqual(["sdp", "sessionId"]);
    expect(createSession).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith({
      sdp: "v=0\r\noffer",
      instructions: expect.stringContaining("What would you recommend, and why?"),
    });
  });

  it("rejects an unknown topic before calling the provider", async () => {
    await request(app.getHttpServer())
      .post("/realtime/sessions")
      .send({ topicId: "unknown", sdp: "v=0\r\noffer" })
      .expect(404);

    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns a controlled provider error", async () => {
    createSession.mockRejectedValue(new OpenAILiveSessionError());

    const response = await request(app.getHttpServer())
      .post("/realtime/sessions")
      .send({ topicId: "ai-and-independence", sdp: "v=0\r\noffer" })
      .expect(502);

    expect(response.body.message).toBe("The realtime provider could not create a session.");
    expect(JSON.stringify(response.body)).not.toContain("OpenAI Live session creation failed");
  });

  it("reports missing provider configuration without exposing credentials", async () => {
    createSession.mockRejectedValue(new OpenAILiveConfigurationError());

    const response = await request(app.getHttpServer())
      .post("/realtime/sessions")
      .send({ topicId: "a-decision-you-changed", sdp: "v=0\r\noffer" })
      .expect(503);

    expect(response.body.message).toBe("Realtime sessions are not configured.");
    expect(JSON.stringify(response.body)).not.toContain("OPENAI_API_KEY");
  });

  it("rejects malformed SDP before calling the provider", async () => {
    await request(app.getHttpServer())
      .post("/realtime/sessions")
      .send({ topicId: "release-or-delay", sdp: "not-an-offer" })
      .expect(400);

    expect(createSession).not.toHaveBeenCalled();
  });
});
