import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";
import { validCategories } from "@/app/utils/constants";
import { htmlToText } from "html-to-text";

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface EmailData {
  id: string;
  subject: string;
  category: string;
  labeled: boolean;
  error?: string;
}

interface GmailPayload {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailPayload[];
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token required" },
        { status: 400 }
      );
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch unread emails
    const emailsResponse = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 2,
    });

    const emails = emailsResponse.data.messages || [];
    const results: EmailData[] = [];

    // Process each email
    for (const email of emails) {
      try {
        // Get email details
        const emailDetails = await gmail.users.messages.get({
          userId: "me",
          id: email.id!,
        });

        const headers = emailDetails.data.payload?.headers;
        const subject =
          headers?.find((h) => h.name === "Subject")?.value || "No Subject";
        const from =
          headers?.find((h) => h.name === "From")?.value || "Unknown Sender";
        const to = headers?.find((h) => h.name === "To")?.value || "";
        const date = headers?.find((h) => h.name === "Date")?.value || "";

        // Extract email body
        const body = extractEmailBody(
          emailDetails.data.payload as GmailPayload
        );

        console.log({
          subject,
          from,
          to,
          date,
          body,
        });

        // Classify email using Gemini with comprehensive data
        const category = await classifyEmail(subject, from, body);

        // Check if label exists, create if not
        const labelId = await ensureLabelExists(gmail, category);

        // Apply label to email
        await gmail.users.messages.modify({
          userId: "me",
          id: email.id!,
          requestBody: {
            addLabelIds: [labelId],
            removeLabelIds: ["UNREAD"],
          },
        });

        results.push({
          id: email.id!,
          subject,
          category,
          labeled: true,
        });
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        results.push({
          id: email.id!,
          subject: "Error processing email",
          category: "Error",
          labeled: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error in Gmail processing:", error);
    return NextResponse.json(
      { error: "Failed to process emails" },
      { status: 500 }
    );
  }
}

function extractEmailBody(payload: GmailPayload): string {
  if (!payload) return "";

  // Handle multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    // If no text/plain, try text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const htmlContent = Buffer.from(part.body.data, "base64").toString(
          "utf-8"
        );
        // Use html-to-text for robust HTML to text conversion
        return htmlToText(htmlContent, {
          wordwrap: false,
          selectors: [
            { selector: "style", format: "skip" },
            { selector: "script", format: "skip" },
            { selector: "head", format: "skip" },
            { selector: "title", format: "skip" },
            { selector: "meta", format: "skip" },
            { selector: "link", format: "skip" },
          ],
          preserveNewlines: true,
        })
          .replace(/\s+/g, " ")
          .trim();
      }
    }
  }

  // Handle single part messages
  if (payload.body && payload.body.data) {
    if (payload.mimeType === "text/plain") {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.mimeType === "text/html") {
      const htmlContent = Buffer.from(payload.body.data, "base64").toString(
        "utf-8"
      );
      return htmlToText(htmlContent, {
        wordwrap: false,
        selectors: [
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "head", format: "skip" },
          { selector: "title", format: "skip" },
          { selector: "meta", format: "skip" },
          { selector: "link", format: "skip" },
        ],
        preserveNewlines: true,
      })
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return "";
}

async function classifyEmail(
  subject: string,
  from: string,
  body: string
): Promise<string> {
  const prompt = `Analyze this email and classify it into one of the following categories: [${validCategories.join(
    ", "
  )}]. 

Consider these factors to determine if it's an important email vs automated/sales:
1. Sender email domain (personal domains vs corporate vs marketing platforms)
2. Subject line patterns (urgency indicators, personal names, vs generic marketing)
3. Email body content (personalized vs generic, action required vs informational)
4. Language patterns (formal vs casual, specific vs generic)

Categories explanation:
- "Important": Critical emails requiring immediate attention (work deadlines, personal emergencies)
- "Urgent": Time-sensitive matters that need quick response
- "Work": Professional communications from colleagues, clients, or work-related services
- "Personal": Messages from friends, family, or personal contacts
- "Finance": Banking, bills, financial statements, investment updates
- "Sales": Marketing emails trying to sell products/services
- "Promotions": Discounts, deals, promotional offers
- "Newsletter": Regular updates from subscribed services
- "Social": Social media notifications, event invitations
- "Shopping": Order confirmations, shipping updates, e-commerce
- "Entertainment": Movies, games, streaming services
- "Health": Medical appointments, health insurance, fitness
- "Education": Course updates, academic communications
- "Automated": System notifications, confirmations, receipts
- "Spamming": Unwanted, suspicious, or irrelevant emails
- "Other": Other categories not listed above

Email Details:
From: ${from}
Subject: ${subject}
Body Preview: ${body.substring(0, 500)}${body.length > 500 ? "..." : ""}

Return only the category name:`;

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3, // Lower temperature for more consistent classification
        },
      });
      const category = result.text?.trim() || "";

      // Validate the response is one of our expected categories
      if (category && validCategories.includes(category)) {
        return category;
      } else {
        // If response is not valid, retry
        retries++;
        if (retries > maxRetries) {
          return "Personal"; // Default fallback
        }
      }
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        console.error("Gemini API error after retries:", error);
        return "Personal"; // Default fallback
      }
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return "Personal"; // Final fallback
}

async function ensureLabelExists(
  gmail: ReturnType<typeof google.gmail>,
  labelName: string
): Promise<string> {
  try {
    // First, try to find existing label
    const labelsResponse = await gmail.users.labels.list({ userId: "me" });
    const existingLabel = labelsResponse.data.labels?.find(
      (label) => label.name === labelName
    );

    if (existingLabel?.id) {
      return existingLabel.id;
    }

    // Create new label if it doesn't exist
    const newLabelResponse = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });

    return newLabelResponse.data.id!;
  } catch (error) {
    console.error("Error ensuring label exists:", error);
    throw error;
  }
}
