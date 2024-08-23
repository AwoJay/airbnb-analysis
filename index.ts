import * as fs from "fs";
import "dotenv/config";
import { Buffer } from "buffer";
import { scrapeAirbnb } from "./scraping";
import { codeInterpret } from "./codeInterpreter";
import { MODEL_NAME, SYSTEM_PROMPT } from "./model";
import { CodeInterpreter, Execution } from "@e2b/code-interpreter";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

/**
 * Chat with Claude to analyze the Airbnb data
 */
async function chat(
  codeInterpreter: CodeInterpreter,
  userMessage: string
): Promise<Execution | undefined> {
  console.log("Waiting for Claude...");

  // Use the appropriate method for creating a completion
  const msg = await anthropic.completions.create({
    model: MODEL_NAME,
    prompt: `${SYSTEM_PROMPT}\n\nHuman: ${userMessage}\n\nAssistant:`,
    max_tokens_to_sample: 4096,
    stop_sequences: ["Human:"],
  });

  const responseContent = msg.completion;

  console.log(`\n${"=".repeat(50)}\nModel response: 
  ${responseContent}\n${"=".repeat(50)}`);

  // Simulate tool use detection
  const toolBlockMatch = responseContent.match(/```(\w+)\n([\s\S]*?)```/);
  if (toolBlockMatch) {
    const toolName = toolBlockMatch[1];
    const toolInput = toolBlockMatch[2];

    console.log(
      `\n${"=".repeat(50)}\nUsing tool: 
      ${toolName}\n${"=".repeat(50)}`
    );

    if (toolName === "python") {
      return codeInterpret(codeInterpreter, toolInput);
    }
  }
  return undefined;
}

/**
 * Main function to run the scraping and analysis
 */
async function run() {
  // Load the Airbnb prices data from the JSON file
  let data;
  const readDataFromFile = () => {
    try {
      return fs.readFileSync("airbnb_listings.json", "utf8");
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("File not found, scraping data...");
        return null;
      } else {
        throw err;
      }
    }
  };

  const fetchData = async () => {
    data = readDataFromFile();
    if (!data || data.trim() === "[]") {
      console.log("File is empty or contains an empty list, scraping data...");
      data = await scrapeAirbnb();
    }
  };

  await fetchData();

  // Parse the JSON data
  const prices = JSON.parse(data);

  // Convert prices array to a string representation of a Python list
  const pricesList = JSON.stringify(prices);

  const userMessage = `
  Load the Airbnb prices data from the airbnb listing below and visualize
  the distribution of prices with a histogram. Listing data: ${pricesList}
  `;

  const codeInterpreter = await CodeInterpreter.create();
  const codeOutput = await chat(codeInterpreter, userMessage);
  if (!codeOutput) {
    console.log("No code output");
    return;
  }

  const logs = codeOutput.logs;
  console.log(logs);

  if (codeOutput.results.length == 0) {
    console.log("No results");
    return;
  }

  const firstResult = codeOutput.results[0];
  console.log(firstResult.text);

  if (firstResult.png) {
    const pngData = Buffer.from(firstResult.png, "base64");
    const filename = "airbnb_prices_chart.png";
    fs.writeFileSync(filename, pngData);
    console.log(`✅ Saved chart to ${filename}`);
  }

  await codeInterpreter.close();
}

run();
