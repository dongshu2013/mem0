import { LLM, LLMResponse } from "./base";
import { LLMConfig, Message } from "../types";
import { logger } from "../utils/logger";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string | null;
      role: string;
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export class OpenRouterLLM implements LLM {
  private config: LLMConfig;
  private model: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.model = config.model || "anthropic/claude-3-opus-20240229";
  }

  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string },
    tools?: any[],
  ): Promise<string | LLMResponse> {
    const bodyData = {
      model: this.model,
      messages: messages.map((msg) => {
        const role = msg.role as "system" | "user" | "assistant";
        return {
          role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        };
      }),
      response_format: responseFormat as { type: "text" | "json_object" },
      ...(tools && { tools, tool_choice: "auto" }),
    };
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://my-staging.mysta.ai",
        "X-Title": "Mysta AI",
      },
      body: JSON.stringify(bodyData),
    });

    logger.debug(`bodyData: ${JSON.stringify(bodyData)}`);
    logger.debug(`baseURL: ${this.config.baseURL}`);
    logger.debug(`model: ${this.model}`);
    logger.debug(`responseFormat: ${JSON.stringify(responseFormat)}`);
    logger.debug(`response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    logger.debug(`response data: ${JSON.stringify(data)}`);
    const message = data.choices[0].message;

    if (message.tool_calls) {
      return {
        content: message.content || "",
        role: message.role,
        toolCalls: message.tool_calls.map((call) => ({
          name: call.function.name,
          arguments: call.function.arguments,
        })),
      };
    }

    let content = message.content || "";

    // 如果期望 JSON 格式但返回的不是有效 JSON，尝试修复
    if (responseFormat?.type === "json_object" && content) {
      content = this.cleanJsonResponse(content);
    }

    return content;
  }

  async generateChat(messages: Message[]): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://my-staging.mysta.ai",
        "X-Title": "Mysta AI",
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((msg) => {
          const role = msg.role as "system" | "user" | "assistant";
          return {
            role,
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          };
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const message = data.choices[0].message;
    return {
      content: message.content || "",
      role: message.role,
    };
  }

  /**
   * 清理和修复 JSON 响应
   */
  private cleanJsonResponse(content: string): string {
    // 移除可能的 markdown 代码块标记
    content = content.replace(/```json\s*/g, "").replace(/```\s*$/g, "");

    // 移除前后的空白字符
    content = content.trim();

    // 如果内容已经是有效的 JSON，直接返回
    try {
      JSON.parse(content);
      return content;
    } catch (e) {
      // 如果不是有效 JSON，尝试修复常见问题
      console.warn(
        "Invalid JSON response from OpenRouter, attempting to fix:",
        content,
      );

      // 尝试提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[0]);
          return jsonMatch[0];
        } catch (e2) {
          console.warn("Failed to extract valid JSON from response");
        }
      }

      // 如果无法修复，返回一个空的 JSON 对象
      console.warn("Returning empty JSON object as fallback");
      return '{"facts": []}';
    }
  }
}
