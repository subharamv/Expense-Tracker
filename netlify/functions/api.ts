import serverless from "serverless-http";
import { createExpressApp } from "../../src/server/app.ts";

let cachedHandler;

export const main = async (event, context) => {
  if (!cachedHandler) {
    console.log("INITIALIZING_NETLIFY_FUNCTION_HANDLER");
    const app = await createExpressApp();
    cachedHandler = serverless(app);
  }
  return cachedHandler(event, context);
};

// Also export as default and as 'handler' for different environments
export const handler = main;
export default main;
