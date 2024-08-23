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
  // This uses the Messages API, given the available means, using completions may require a higher plan and code refactoring
  const msg = await anthropic.messages.create({
    model: MODEL_NAME,
    // prompt: `${SYSTEM_PROMPT}\n\nHuman: ${userMessage}\n\nAssistant:`,
    messages: [
      {
        role: "user",
        content: `${SYSTEM_PROMPT}\n\n ${userMessage}`,
      },
    ],
    max_tokens: 4096,
    // stop_sequences: ["Human:"],
  });

  const responseContent = msg.content[0];

  if (responseContent.type !== "text") return undefined;

  const matchedContent = responseContent.text.match(/```python\n([\s\S]*?)```/);

  if (matchedContent === null) return undefined;

  const code = matchedContent[0].replace("```python\n", "").replace("```", "");

  console.log(`\n${"=".repeat(50)}\nModel response:
  ${code}\n${"=".repeat(50)}`);

  return codeInterpret(codeInterpreter, code);
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
  the distribution of prices with a histogram.
  The title of the histogram must be: "Distribution of Airbnb Prices in San Francisco". The xlabel must be "Price per Night ($)". The ylabel must be: "Number of Listings". Make sure that the ylabel is not float numbers but rather integers.
  Listing data: ${pricesList}
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
