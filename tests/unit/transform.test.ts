
import { beforeAll, describe, expect, test } from "bun:test";
import { transformToGoogleBody, transformGoogleEventToOpenAI } from "../../src/utils/transform";
import { loadProxyConfig } from "../../src/config/manager";

beforeAll(async () => {
  await loadProxyConfig();
});

describe("Unit Tests: transformToGoogleBody", () => {
  test("Basic message transformation", () => {
    const openaiBody = {
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Hello Gemini" }
      ],
      temperature: 0.5
    };

    const result = transformToGoogleBody(openaiBody, "test-project", false, "us-central1");

    expect(result.project).toBe("test-project");
    expect(result.model).toBe("gpt-4o"); // It passes through if no antigravity prefix
    expect(result.request.contents).toHaveLength(1);
    expect(result.request.contents[0].role).toBe("user");
    expect(result.request.contents[0].parts[0].text).toBe("Hello Gemini");
    expect(result.request.generationConfig.temperature).toBe(0.5);
  });

  test("Antigravity model prefix removal", () => {
    const openaiBody = {
      model: "antigravity-gemini-2.0-flash",
      messages: [{ role: "user", content: "Hi" }]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    expect(result.model).toBe("gemini-2.0-flash");
  });

  test("Thinking level extraction for CLI", () => {
    const openaiBody = {
      model: "gemini-3-flash-thinking-medium",
      messages: [{ role: "user", content: "Hi" }]
    };

    const result = transformToGoogleBody(openaiBody, "p", true, "us-central1"); // isCli = true
    expect(result.model).toBe("gemini-3-flash-preview");
    expect(result.request.generationConfig.thinkingConfig.thinkingLevel).toBe("medium");
  });

  for (const tier of ["low", "medium", "high"]) {
    test(`Gemini 3.7 Flash ${tier} alias mapping`, () => {
      const openaiBody = {
        model: `gemini-3.7-flash-${tier}`,
        messages: [{ role: "user", content: "Hi" }]
      };

      for (const isCli of [false, true]) {
        const result = transformToGoogleBody(openaiBody, "p", isCli, "us-central1");
        const thinkingConfig = result.request.generationConfig.thinkingConfig;

        expect(result.model).toBe("gemini-3.7-flash-tiered");
        expect(thinkingConfig.includeThoughts).toBe(true);
        expect(thinkingConfig.thinkingLevel).toBe(tier);
        expect(thinkingConfig.thinkingBudget).toBeUndefined();
      }
    });
  }

  test("Gemini 3.7 Flash defaults to medium thinking", () => {
    const result = transformToGoogleBody({
      model: "gemini-3.7-flash",
      messages: [{ role: "user", content: "Hi" }]
    }, "p", false, "us-central1");

    expect(result.model).toBe("gemini-3.7-flash-tiered");
    expect(result.request.generationConfig.thinkingConfig.thinkingLevel).toBe("medium");
    expect(result.request.generationConfig.thinkingConfig.thinkingBudget).toBeUndefined();
  });

  test("Gemini 3.1 Pro tiers map to their working wire models", () => {
    const aliases = [
      ["gemini-3.1-pro-low", "gemini-3.1-pro-low"],
      ["gemini-3.1-pro-high", "gemini-pro-agent"],
      ["antigravity-gemini-3.1-pro-low", "gemini-3.1-pro-low"],
      ["antigravity-gemini-3.1-pro-high", "gemini-pro-agent"]
    ] as const;

    for (const [model, expectedWireModel] of aliases) {
      const result = transformToGoogleBody({
        model,
        messages: [{ role: "user", content: "Hi" }]
      }, "p", false, "us-central1");

      expect(result.model).toBe(expectedWireModel);
    }
  });

  test("Gemini 3.1 Pro high requests high-level thought summaries", () => {
    const aliases = [
      "gemini-3.1-pro",
      "gemini-3.1-pro-high",
      "antigravity-gemini-3.1-pro-high",
      "gemini-pro-agent"
    ];

    for (const model of aliases) {
      const result = transformToGoogleBody({
        model,
        messages: [{ role: "user", content: "Hi" }]
      }, "p", false, "us-central1");

      expect(result.model).toBe("gemini-pro-agent");
      expect(result.request.generationConfig.thinkingConfig).toEqual({
        includeThoughts: true,
        thinkingLevel: "high"
      });
    }
  });

  test("Gemini 3.5 Flash aliases map to their wire models and request thought summaries", () => {
    const aliases = [
      ["gemini-3.5-flash-extra-low", "gemini-3.5-flash-low", "low"],
      ["gemini-3.5-flash-low", "gemini-3.5-flash-low", "low"],
      ["gemini-3.5-flash-medium", "gemini-3.5-flash-low", "medium"],
      ["gemini-3.5-flash-high", "gemini-3-flash-agent", "high"],
      ["antigravity-gemini-3.5-flash-extra-low", "gemini-3.5-flash-low", "low"],
      ["antigravity-gemini-3.5-flash-low", "gemini-3.5-flash-low", "low"],
      ["antigravity-gemini-3.5-flash-medium", "gemini-3.5-flash-low", "medium"],
      ["antigravity-gemini-3.5-flash-high", "gemini-3-flash-agent", "high"]
    ] as const;

    for (const [model, expectedWireModel, expectedThinkingLevel] of aliases) {
      for (const isCli of [false, true]) {
        const result = transformToGoogleBody({
          model,
          messages: [{ role: "user", content: "Hi" }]
        }, "p", isCli, "us-central1");

        expect(result.model).toBe(expectedWireModel);
        expect(result.request.generationConfig.thinkingConfig).toEqual({
          includeThoughts: true,
          thinkingLevel: expectedThinkingLevel
        });
      }
    }
  });

  test("Multi-turn conversation", () => {
    const openaiBody = {
      model: "gemini-1.5-pro",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" }
      ]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    expect(result.request.contents).toHaveLength(3);
    expect(result.request.contents[0].role).toBe("user");
    expect(result.request.contents[1].role).toBe("model"); // OpenAI assistant -> Google model
    expect(result.request.contents[2].role).toBe("user");
  });

  test("Tool transformation", () => {
    const openaiBody = {
      model: "gemini-1.5-pro",
      messages: [{ role: "user", content: "Check weather" }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" }
              },
              required: ["location"]
            }
          }
        }
      ]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    expect(result.request.tools).toBeDefined();
    expect(result.request.tools[0].functionDeclarations).toHaveLength(1);
    expect(result.request.tools[0].functionDeclarations[0].name).toBe("get_weather");
    expect(result.request.tools[0].functionDeclarations[0].parameters.properties.location).toBeDefined();
  });

  test("Claude Opus 4.6 Thinking mapping and budget", () => {
    const openaiBody = {
      model: "antigravity-claude-opus-4-6-thinking-high",
      messages: [{ role: "user", content: "Hi" }]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    expect(result.model).toBe("claude-opus-4-6-thinking");
    expect(result.request.generationConfig.thinkingConfig.includeThoughts).toBe(true);
    expect(result.request.generationConfig.thinkingConfig.thinkingBudget).toBe(32768);
  });

  test("Claude Opus 4.6 Thinking Low budget", () => {
    const openaiBody = {
      model: "antigravity-claude-opus-4-6-thinking-low",
      messages: [{ role: "user", content: "Hi" }]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    expect(result.request.generationConfig.thinkingConfig.thinkingBudget).toBe(8192);
  });

  test("Claude tool call transformation with ID", () => {
    const openaiBody = {
      model: "antigravity-claude-opus-4-6-thinking-high",
      messages: [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc123",
              type: "function",
              function: { name: "test_tool", arguments: "{}" }
            }
          ]
        }
      ]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    const funcCallPart = result.request.contents[0].parts.find((p: any) => p.functionCall);
    expect(funcCallPart).toBeDefined();
    expect(funcCallPart.functionCall.id).toBe("call_abc123");
  });

  test("Claude tool response transformation with ID", () => {
    const openaiBody = {
      model: "antigravity-claude-opus-4-6-thinking-high",
      messages: [
        {
          role: "tool",
          tool_call_id: "call_abc123",
          name: "test_tool",
          content: '{"result": "ok"}'
        }
      ]
    };

    const result = transformToGoogleBody(openaiBody, "p", false, "us-central1");
    const funcRespPart = result.request.contents[0].parts.find((p: any) => p.functionResponse);
    expect(funcRespPart).toBeDefined();
    expect(funcRespPart.functionResponse.id).toBe("call_abc123");
  });
});

describe("Unit Tests: transformGoogleEventToOpenAI", () => {
  test("Basic text response", () => {
    const googleData = {
      candidates: [{
        content: {
          parts: [{ text: "Hello world" }]
        },
        finishReason: "STOP"
      }]
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-1.5-pro", "req-123");
    expect(result).not.toBeNull();
    expect(result.choices[0].delta.content).toBe("Hello world");
    expect(result.choices[0].finish_reason).toBe("stop");
  });

  test("Tool call response", () => {
    const googleData = {
      candidates: [{
        content: {
          parts: [{
            functionCall: {
              name: "get_weather",
              args: { location: "London" }
            }
          }]
        }
      }]
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-1.5-pro");
    expect(result.choices[0].delta.tool_calls).toHaveLength(1);
    expect(result.choices[0].delta.tool_calls[0].function.name).toBe("get_weather");
    expect(JSON.parse(result.choices[0].delta.tool_calls[0].function.arguments).location).toBe("London");
  });

  test("Empty/Invalid response", () => {
    const googleData = { candidates: [] };
    const result = transformGoogleEventToOpenAI(googleData, "model");
    expect(result).toBeNull();
  });

  test("Prompt-level prohibited content maps to content_filter without candidates", () => {
    const googleData = {
      candidates: [],
      promptFeedback: {
        blockReason: "PROHIBITED_CONTENT",
        blockReasonMessage: "The prompt contains prohibited content."
      },
      usageMetadata: {
        promptTokenCount: 12,
        candidatesTokenCount: 0,
        totalTokenCount: 12
      }
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-3.7-flash-medium", "req-blocked");

    expect(result.choices[0].delta).toEqual({});
    expect(result.choices[0].finish_reason).toBe("content_filter");
    expect(result.provider_finish_reason).toBeNull();
    expect(result.provider_block_reason).toBe("PROHIBITED_CONTENT");
    expect(result.provider_block_message).toBe("The prompt contains prohibited content.");
    expect(result.usage.total_tokens).toBe(12);
  });

  test("Wrapped snake-case prompt block maps to content_filter", () => {
    const googleData = {
      response: {
        candidates: [],
        prompt_feedback: {
          block_reason: "BLOCKLIST"
        }
      }
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-3.7-flash-medium");

    expect(result.choices[0].finish_reason).toBe("content_filter");
    expect(result.provider_block_reason).toBe("BLOCKLIST");
  });

  test("Prompt block overrides a warning candidate with no finish reason", () => {
    const googleData = {
      candidates: [{
        content: {
          parts: [{ text: "The prompt could not be submitted." }]
        }
      }],
      promptFeedback: {
        blockReason: "SAFETY"
      }
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-3.7-flash-medium");

    expect(result.choices[0].delta.content).toBe("The prompt could not be submitted.");
    expect(result.choices[0].finish_reason).toBe("content_filter");
    expect(result.provider_block_reason).toBe("SAFETY");
  });

  test("Explicitly blocked candidate safety rating maps to content_filter", () => {
    const googleData = {
      candidates: [{
        content: {
          parts: [{ text: "Blocked response." }]
        },
        safetyRatings: [{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", blocked: true }]
      }]
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-3.7-flash-medium");

    expect(result.choices[0].finish_reason).toBe("content_filter");
    expect(result.provider_block_reason).toBe("SAFETY_RATING_BLOCKED");
  });

  test("Unspecified prompt feedback is not treated as a block", () => {
    const googleData = {
      candidates: [{
        content: { parts: [{ text: "Still generating" }] }
      }],
      promptFeedback: {
        blockReason: "BLOCK_REASON_UNSPECIFIED"
      }
    };

    const result = transformGoogleEventToOpenAI(googleData, "gemini-3.7-flash-medium");

    expect(result.choices[0].finish_reason).toBeNull();
    expect(result.provider_block_reason).toBeNull();
  });
});
