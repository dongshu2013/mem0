import { LLM, LLMResponse } from "./base";
import { LLMConfig, Message } from "../types";

interface DeepInfraResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export class DeepInfraLLM implements LLM {
  private config: LLMConfig;
  private model: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.model = config.model || "meta-llama/Llama-2-70b-chat-hf";
  }

  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string },
    tools?: any[],
  ): Promise<string | LLMResponse> {
    const url = `${this.config.baseURL || "https://api.deepinfra.com/v1"}/chat/completions`;
    console.log("DeepInfra API Request:", {
      url,
      model: this.model,
      messages,
      responseFormat,
      tools,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        })),
        response_format: responseFormat,
        ...(tools && { tools, tool_choice: "auto" }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepInfra API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url,
        model: this.model,
      });
      throw new Error(`DeepInfra API error: ${errorText}`);
    }

    const data = (await response.json()) as DeepInfraResponse;
    const result = data.choices[0].message;

    if (result.tool_calls) {
      return {
        content: result.content || "",
        role: result.role,
        toolCalls: result.tool_calls.map((call) => ({
          name: call.function.name,
          arguments: call.function.arguments,
        })),
      };
    }

    return result.content || "";
  }

  async generateChat(messages: Message[]): Promise<LLMResponse> {
    const url = `${this.config.baseURL || "https://api.deepinfra.com/v1"}/chat/completions`;
    console.log("DeepInfra API Request:", {
      url,
      model: this.model,
      messages,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepInfra API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url,
        model: this.model,
      });
      throw new Error(`DeepInfra API error: ${errorText}`);
    }

    const data = (await response.json()) as DeepInfraResponse;
    const result = data.choices[0].message;

    return {
      content: result.content || "",
      role: result.role,
    };
  }
}
