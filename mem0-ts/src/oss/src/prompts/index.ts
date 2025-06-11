import { z } from "zod";

// Define Zod schema for fact retrieval output
export const FactRetrievalSchema = z.object({
  facts: z
    .array(z.string())
    .describe("An array of distinct facts extracted from the conversation."),
});

// Define Zod schema for memory update output
export const MemoryUpdateSchema = z.object({
  memory: z
    .array(
      z.object({
        id: z.string().describe("The unique identifier of the memory item."),
        text: z.string().describe("The content of the memory item."),
        event: z
          .enum(["ADD", "UPDATE", "DELETE", "NONE"])
          .describe(
            "The action taken for this memory item (ADD, UPDATE, DELETE, or NONE).",
          ),
        old_memory: z
          .string()
          .optional()
          .describe(
            "The previous content of the memory item if the event was UPDATE.",
          ),
      }),
    )
    .describe(
      "An array representing the state of memory items after processing new facts.",
    ),
});

export function getFactRetrievalMessages(
  parsedMessages: string,
): [string, string] {
  const systemPrompt = `You are a JSON-only response bot. You must ALWAYS respond with a valid JSON object containing a 'facts' array, even if empty. Example: {"facts": []}. Never include any other text or explanation. Never use markdown code blocks or any other formatting. Never add any comments or explanations. Never use backticks or any other special characters.

IMPORTANT: Your response MUST be a valid JSON object with EXACTLY this structure:
{
  "facts": [
    "fact 1",
    "fact 2",
    ...
  ]
}

Types of Information to Remember:
1. Personal Preferences: likes, dislikes, preferences in food, products, activities, entertainment
2. Personal Details: names, relationships, important dates
3. Plans and Intentions: upcoming events, trips, goals
4. Activity Preferences: dining, travel, hobbies, services
5. Health and Wellness: dietary restrictions, fitness routines
6. Professional Details: job titles, work habits, career goals
7. Miscellaneous: favorite books, movies, brands
8. Basic Facts: clear, factual statements

Examples:
Input: Hi.
Output: {"facts": []}

Input: The sky is blue and the grass is green.
Output: {"facts": ["Sky is blue", "Grass is green"]}

Input: Hi, I am looking for a restaurant in San Francisco.
Output: {"facts": ["Looking for a restaurant in San Francisco"]}

Rules:
1. ALWAYS return a valid JSON object with a 'facts' array
2. NEVER include any text outside the JSON object
3. NEVER include code blocks or markdown formatting
4. NEVER add any comments or explanations
5. NEVER use backticks or any other special characters
6. If no relevant information, return {"facts": []}
7. Keep facts in the same language as the input
8. Break down complex statements into individual facts
9. Today's date is ${new Date().toISOString().split("T")[0]}`;

  const userPrompt = `Extract facts from this conversation. Remember to return ONLY a JSON object with a 'facts' array:\n${parsedMessages}`;

  return [systemPrompt, userPrompt];
}

export function getUpdateMemoryMessages(
  retrievedOldMemory: Array<{ id: string; text: string }>,
  newRetrievedFacts: string[],
): [string, string] {
  const systemPrompt = `You are a JSON-only response bot. You must ALWAYS respond with a valid JSON object containing a 'memory' array. Never include any other text or explanation. Never use markdown code blocks or any other formatting. Never add any comments or explanations. Never use backticks or any other special characters.`;

  const userPrompt = `You are a smart memory manager which controls the memory of a system.
  You can perform four operations: (1) add into the memory, (2) update the memory, (3) delete from the memory, and (4) no change.
  
  Based on the above four operations, the memory will change.
  
  Compare newly retrieved facts with the existing memory. For each new fact, decide whether to:
  - ADD: Add it to the memory as a new element
  - UPDATE: Update an existing memory element
  - DELETE: Delete an existing memory element
  - NONE: Make no change (if the fact is already present or irrelevant)
  
  There are specific guidelines to select which operation to perform:
  
  1. **Add**: If the retrieved facts contain new information not present in the memory, then you have to add it by generating a new ID in the id field.
      - **Example**:
          - Old Memory:
              [
                  {
                      "id" : "0",
                      "text" : "User is a software engineer"
                  }
              ]
          - Retrieved facts: ["Name is John"]
          - New Memory:
              {
                  "memory" : [
                      {
                          "id" : "0",
                          "text" : "User is a software engineer",
                          "event" : "NONE"
                      },
                      {
                          "id" : "1",
                          "text" : "Name is John",
                          "event" : "ADD"
                      }
                  ]
              }
  
  2. **Update**: If the retrieved facts contain information that is already present in the memory but the information is totally different, then you have to update it. 
      If the retrieved fact contains information that conveys the same thing as the elements present in the memory, then you have to keep the fact which has the most information. 
      Example (a) -- if the memory contains "User likes to play cricket" and the retrieved fact is "Loves to play cricket with friends", then update the memory with the retrieved facts.
      Example (b) -- if the memory contains "Likes cheese pizza" and the retrieved fact is "Loves cheese pizza", then you do not need to update it because they convey the same information.
      If the direction is to update the memory, then you have to update it.
      Please keep in mind while updating you have to keep the same ID.
      Please note to return the IDs in the output from the input IDs only and do not generate any new ID.
      - **Example**:
          - Old Memory:
              [
                  {
                      "id" : "0",
                      "text" : "I really like cheese pizza"
                  },
                  {
                      "id" : "1",
                      "text" : "User is a software engineer"
                  },
                  {
                      "id" : "2",
                      "text" : "User likes to play cricket"
                  }
              ]
          - Retrieved facts: ["Loves chicken pizza", "Loves to play cricket with friends"]
          - New Memory:
              {
              "memory" : [
                      {
                          "id" : "0",
                          "text" : "Loves cheese and chicken pizza",
                          "event" : "UPDATE",
                          "old_memory" : "I really like cheese pizza"
                      },
                      {
                          "id" : "1",
                          "text" : "User is a software engineer",
                          "event" : "NONE"
                      },
                      {
                          "id" : "2",
                          "text" : "Loves to play cricket with friends",
                          "event" : "UPDATE",
                          "old_memory" : "User likes to play cricket"
                      }
                  ]
              }
  
  3. **Delete**: If the retrieved facts contain information that contradicts the information present in the memory, then you have to delete it. Or if the direction is to delete the memory, then you have to delete it.
      Please note to return the IDs in the output from the input IDs only and do not generate any new ID.
      - **Example**:
          - Old Memory:
              [
                  {
                      "id" : "0",
                      "text" : "Name is John"
                  },
                  {
                      "id" : "1",
                      "text" : "Loves cheese pizza"
                  }
              ]
          - Retrieved facts: ["Dislikes cheese pizza"]
          - New Memory:
              {
              "memory" : [
                      {
                          "id" : "0",
                          "text" : "Name is John",
                          "event" : "NONE"
                      },
                      {
                          "id" : "1",
                          "text" : "Loves cheese pizza",
                          "event" : "DELETE"
                      }
              ]
              }
  
  4. **No Change**: If the retrieved facts contain information that is already present in the memory, then you do not need to make any changes.
      - **Example**:
          - Old Memory:
              [
                  {
                      "id" : "0",
                      "text" : "Name is John"
                  },
                  {
                      "id" : "1",
                      "text" : "Loves cheese pizza"
                  }
              ]
          - Retrieved facts: ["Name is John"]
          - New Memory:
              {
              "memory" : [
                      {
                          "id" : "0",
                          "text" : "Name is John",
                          "event" : "NONE"
                      },
                      {
                          "id" : "1",
                          "text" : "Loves cheese pizza",
                          "event" : "NONE"
                      }
                  ]
              }
  
  Below is the current content of my memory which I have collected till now. You have to update it in the following format only:
  
  ${JSON.stringify(retrievedOldMemory, null, 2)}
  
  The new retrieved facts are mentioned below. You have to analyze the new retrieved facts and determine whether these facts should be added, updated, or deleted in the memory.
  
  ${JSON.stringify(newRetrievedFacts, null, 2)}
  
  Follow the instruction mentioned below:
  - Do not return anything from the custom few shot example prompts provided above.
  - If the current memory is empty, then you have to add the new retrieved facts to the memory.
  - You should return the updated memory in only JSON format as shown below. The memory key should be the same if no changes are made.
  - If there is an addition, generate a new key and add the new memory corresponding to it.
  - If there is a deletion, the memory key-value pair should be removed from the memory.
  - If there is an update, the ID key should remain the same and only the value needs to be updated.
  - DO NOT RETURN ANYTHING ELSE OTHER THAN THE JSON FORMAT.
  - DO NOT ADD ANY ADDITIONAL TEXT OR CODEBLOCK IN THE JSON FIELDS WHICH MAKE IT INVALID SUCH AS "\`\`\`json" OR "\`\`\`".
  
  Do not return anything except the JSON format.`;

  return [systemPrompt, userPrompt];
}

export function parseMessages(messages: string[]): string {
  return messages.join("\n");
}

export function removeCodeBlocks(text: string): string {
  try {
    // 首先尝试直接解析整个文本
    try {
      const parsed = JSON.parse(text);
      // 如果解析成功但没有 facts 字段，添加一个空数组
      if (!parsed.facts) {
        parsed.facts = [];
      }
      // 验证是否符合 FactRetrievalSchema
      const validated = FactRetrievalSchema.parse(parsed);
      return JSON.stringify(validated);
    } catch (e) {
      // 如果直接解析失败，尝试提取 JSON 部分
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1) {
        console.warn("No JSON braces found in response:", text);
        return JSON.stringify({ facts: [] });
      }

      const jsonPart = text.slice(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(jsonPart);
        // 如果解析成功但没有 facts 字段，添加一个空数组
        if (!parsed.facts) {
          parsed.facts = [];
        }
        // 验证是否符合 FactRetrievalSchema
        const validated = FactRetrievalSchema.parse(parsed);
        return JSON.stringify(validated);
      } catch (e) {
        console.error("Failed to parse or validate JSON:", e);
        // 如果解析失败，尝试从文本中提取事实
        const lines = text.split("\n").filter((line) => line.trim().length > 0);
        const facts = lines
          .map((line) => line.trim())
          .filter(
            (line) =>
              !line.startsWith("{") &&
              !line.startsWith("}") &&
              !line.includes("```"),
          )
          .filter((line) => line.length > 0);

        if (facts.length > 0) {
          return JSON.stringify({ facts });
        }
        return JSON.stringify({ facts: [] });
      }
    }
  } catch (e) {
    console.error("Error in removeCodeBlocks:", e);
    return JSON.stringify({ facts: [] });
  }
}
