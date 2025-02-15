import * as fs from "fs";

import { BaseMessage, Role } from "bee-agent-framework/llms/primitives/message";

import { AgentWorkflow } from "bee-agent-framework/experimental/workflows/agent";
// app/api/agent/route.ts
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { GoogleSearchTool } from "bee-agent-framework/tools/search/googleSearch";
import { GroqChatLLM } from "bee-agent-framework/adapters/groq/chat";
import { NextResponse } from "next/server";
import { OpenAPITool } from "bee-agent-framework/tools/openapi";
import { SQLTool } from "bee-agent-framework/tools/database/sql";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { WebCrawlerTool } from "bee-agent-framework/tools/web/webCrawler";
import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";

// Initialize agent
const llm = new GroqChatLLM({
  modelId: "deepseek-r1-distill-llama-70b",
});

// const openApiSchema: any = await fs.promises.readFile(
//   `/Users/emil/Documents/projects/bee-projects/bee-agent-framework-next-js/public/assets/crawler_openapi.json`,
//   "utf-8",
// );

// console.log("Raw OpenAPI Schema:", openApiSchemaString); // Debugging line

// const openApiSchema = JSON.parse(openApiSchemaString);

// console.log("Parsed OpenAPI Schema:", openApiSchema);


const workflow = new AgentWorkflow();


workflow.addAgent({
  name: "QuestionAnalyser",
  instructions:
    `Role: You are an AI agent that analyzes user queries and provides answers. 
    If the question is related to Instana, Datadog, or Dynatrace, delegate the task to CrawlerAgent.
    If the question is not related to these topics, answer it directly.`,
  llm: llm,
});

workflow.addAgent({
  name: "CrawlerAgent",
  instructions: 
  `Role: You are an AI-powered web crawler that extracts relevant information from https://llmtechgen.blogspot.com.
  Instructions:
    You should only crawl when explicitly instructed by SolverAgent with "Use CrawlerAgent".
    Always fetch data from https://llmtechgen.blogspot.com/2025/02/ and ignore any other websites.
    Extract only relevant information related to the user's question.
    Return the crawled content in a structured format. If the extracted content contains any metrics, then the response should be in json format.
    `,
  llm: llm,
  tools: [new WebCrawlerTool()]
});

workflow.addAgent({
  name: "SqlAgent",
  instructions: `Role: You are an AI agent that will check for json data from previous agent response.
  Instructions:
   You should check the existing tables and columns in the database
    If the json response from previous agent contains any data that is not available in the database, then you should add the data to the database
    If the table or column does not exist, then you should create the table or column.
   `,
   llm: llm,
   tools: [new SQLTool({
    provider: 'postgres',
    connection: {
      dialact: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'llmtechgen',
      username: 'postgres',
      password: 'postgres',
      logging: false
    }
   })]
})

// workflow.addAgent({
//   name: "ResponseAgent",
//   instructions:
//     `Role: You are an AI agent that abstracts all the responses of the remaining agents and then respond back with what is considered an approproate response.`,
//   llm: llm,
// });

// workflow.addAgent({
//   name: "GoogleSearch",
//   instructions:
//     "Your task is to provide precise result from web and IBM documentations where questions are related to IBM Instana",
//   llm: llm,
//   tools: [new GoogleSearchTool()]
// });


// workflow.addAgent({
//   name: "CrawlerAgent",
//   instructions: "Your task is to send request and receive the crawled data from the service at http://localhost:5000. The schema is provided as openApiSchema",
//   llm: llm,
//   tools: [new OpenAPITool(
//     { name: 'llmgentech website', 
//       description: 'A blog post related to observability comparison', 
//       openApiSchema: openApiSchema,
//       httpProxyUrl: 'http://localhost:5000'
//     })]
// });

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
