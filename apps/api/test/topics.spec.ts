import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

describe("GET /topics/options", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns one complete topic for each required category", async () => {
    const response = await request(app.getHttpServer()).get("/topics/options").expect(200);
    const topics = response.body as Array<Record<string, unknown>>;

    expect(topics).toHaveLength(3);
    expect(topics.map((topic) => topic.category).sort()).toEqual([
      "opinion",
      "personal_story",
      "work",
    ]);
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(3);

    for (const topic of topics) {
      for (const field of ["id", "title", "context", "openingQuestion"] as const) {
        expect(topic[field]).toEqual(expect.any(String));
        expect((topic[field] as string).trim()).not.toBe("");
      }
    }
  });
});
