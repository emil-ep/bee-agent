import { BaseMessage, Role } from "bee-agent-framework/llms/primitives/message";

import { AgentWorkflow } from "bee-agent-framework/experimental/workflows/agent";
// app/api/agent/route.ts
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { GoogleSearchTool } from "bee-agent-framework/tools/search/googleSearch";
import { GroqChatLLM } from "bee-agent-framework/adapters/groq/chat";
import { NextResponse } from "next/server";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { WebCrawlerTool } from "bee-agent-framework/tools/web/webCrawler";
import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";

// Initialize agent
const llm = new GroqChatLLM({
  modelId: "llama-3.1-70b-versatile",
});

const workflow = new AgentWorkflow();


workflow.addAgent({
  name: "Solver",
  instructions:
    "Your task is to provide the most useful final answer based on the assistants' responses which all are relevant. Ignore those where assistant do not know.",
  llm: llm,
});

workflow.addAgent({
  name: "WebCrawler",
  instructions: "Your task is to crawl the IBM documentations page returned from Google search result and provide valid data. Provide a limit of 1000 characters for crawling and providing responses",
  llm: llm,
  tools: [new WebCrawlerTool()]
})

workflow.addAgent({
  name: "GoogleSearch",
  instructions:
    "Your task is to provide precise result from web and IBM documentations where questions are related to IBM Instana",
  llm: llm,
  tools: [new GoogleSearchTool()]
});

const memory = new UnconstrainedMemory();


export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    await memory.add(
      BaseMessage.of({
        role: Role.USER,
        text: prompt,
        meta: { createdAt: new Date() },
      }),
    );

    const updates: any[] = [];
    const { result } = await workflow.run(memory.messages).observe((emitter) => {
      emitter.on("success", (data) => {
        updates.push({
          type: data.step,
          content: data.response?.update?.finalAnswer ?? "-"
        })
      });
    });
    
    
    return NextResponse.json({
      result: result.finalAnswer,
      updates,
    });
  } catch (error) {
    console.error("Error during agent execution:", error);
    return NextResponse.json(
      { error: "Failed to process agent request" },
      { status: 500 }
    );
  }
}
