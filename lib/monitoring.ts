import { logger } from "@/lib/logger";

type CaptureContext = Record<string, unknown>;

export async function captureError(error: unknown, context: CaptureContext = {}) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error(message, context);

  const webhookUrl = process.env.MONITORING_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "bharat-market-focus",
        message,
        stack: error instanceof Error ? error.stack : undefined,
        context,
        timestamp: new Date().toISOString()
      })
    });
  } catch (webhookError) {
    logger.warn("Monitoring webhook delivery failed", {
      originalError: message,
      webhookError: webhookError instanceof Error ? webhookError.message : webhookError
    });
  }
}
