import * as fs from "fs";
import FirecrawlApp, { type Params } from "@mendable/firecrawl-js";
import "dotenv/config";

export async function scrapeAirbnb() {
  try {
    // Initialize the FirecrawlApp with your API key
    const app = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY,
    });

    // Define the URL to crawl
    const listingsUrl =
      "https://www.airbnb.com/s/San-Francisco--CA--United-States/homes";
    const baseUrl = "https://www.airbnb.com";

    // Define schema to extract listings (schemas are made with `JSON Schema`)

    const schema = {
      type: "object",
      properties: {
        listings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
              },
              price_per_night: {
                type: "number",
              },
              location: {
                type: "string",
              },
              rating: {
                type: "number",
              },
              reviews: {
                type: "number",
              },
            },
            required: ["title", "price_per_night", "location"],
          },
        },
      },
      required: ["listings"],
    };

    const params: Params = {
      pageOptions: {
        waitFor: 10000,
      },
      extractorOptions: {
        extractionSchema: schema,
        extractionPrompt:
          "For each room listing in the page, add a new entry to the listings array which includes the title of the listing, the price per night, the location, the rating and the reviews (last two if available, but not required).",
      },
      timeout: 50000,
    };

    const allListings = await app.scrapeUrl(listingsUrl, params);

    console.log(allListings.data?.llm_extraction?.listings);

    if (allListings.data?.llm_extraction === undefined) {
      throw new Error("LLM extraction failed");
    }

    // Save the listings to a file
    fs.writeFileSync(
      "airbnb_listings.json",
      JSON.stringify(allListings.data?.llm_extraction.listings, null, 2)
    );

    // Read the listings from the file (optional step)
    const listingsData = fs.readFileSync("airbnb_listings.json", "utf8");
    return listingsData;
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}
