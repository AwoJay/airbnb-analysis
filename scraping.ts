import * as fs from "fs";
import FirecrawlApp from "@mendable/firecrawl-js";
import "dotenv/config";
import { z } from "zod";

export async function scrapeAirbnb() {
  try {
    // Initialize the FirecrawlApp with your API key
    const app = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY,
    });

    // Define the URL to crawl
    const listingsUrl = "https://www.airbnb.com/s/San-Francisco--CA--United-States/homes";
    const baseUrl = "https://www.airbnb.com";

    // Define schema to extract pagination links
    const paginationSchema = z.object({
      page_links: z
        .array(
          z.object({
            link: z.string().url(),
          })
        )
        .describe("Pagination links in the bottom of the page."),
    });

    const params2 = {
      pageOptions: {
        onlyMainContent: false,
      },
      extractorOptions: {
        extractionSchema: paginationSchema,
      },
      timeout: 50000, // Timeout for Airbnb's occasional stalling
    };

    // Start crawling to get pagination links
    const linksData = await app.scrapeUrl(listingsUrl, params2);

    // Check if linksData or linksData.data is undefined
    if (!linksData || !linksData.data || !linksData.data["llm_extraction"]) {
      throw new Error("Failed to retrieve pagination links data.");
    }

    const extractedData = linksData.data["llm_extraction"];

    // Validate and process extracted pagination links
    const paginationLinks = extractedData.page_links.map(
      (link) => baseUrl + link.link
    ) || [listingsUrl];  // Fallback to the main URL if no pagination links

    // Define schema to extract listings
    const schema = z.object({
      listings: z
        .array(
          z.object({
            title: z.string(),
            price_per_night: z.number(),
            location: z.string(),
            rating: z.number().optional(),
            reviews: z.number().optional(),
          })
        )
        .describe("Airbnb listings in San Francisco"),
    });

    const params = {
      pageOptions: {
        onlyMainContent: false,
      },
      extractorOptions: {
        extractionSchema: schema,
      },
    };

    // Function to scrape a single URL
    const scrapeListings = async (url: string) => {
      const result = await app.scrapeUrl(url, params);
      
      // Check if result or result.data is undefined
      if (!result || !result.data || !result.data["llm_extraction"]) {
        console.error(`Failed to retrieve data for ${url}`);
        return [];  // Return an empty array in case of error
      }

      return result.data["llm_extraction"].listings || [];
    };

    // Scrape all pagination links in parallel
    const listingsPromises = paginationLinks.map((link) => scrapeListings(link));
    const listingsResults = await Promise.all(listingsPromises);

    // Flatten the results
    const allListings = listingsResults.flat();

    // Save the listings to a file
    fs.writeFileSync(
      "airbnb_listings.json",
      JSON.stringify(allListings, null, 2)
    );

    // Read the listings from the file (optional step)
    const listingsData = fs.readFileSync("airbnb_listings.json", "utf8");
    return listingsData;
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}
