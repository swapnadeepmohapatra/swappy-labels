import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";
import { Anthropic } from "@anthropic-ai/sdk";
import { MAX_EMAILS, validCategories } from "@/app/utils/constants";
import { htmlToText } from "html-to-text";

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
// Initialize Anthropic (Claude)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface EmailData {
  id: string;
  subject: string;
  category: string;
  labeled: boolean;
  model?: string;
  tokens?: number;
  cost?: number;
  error?: string;
}

interface ClassificationResult {
  category: string;
  model: string;
  tokens: number;
  cost: number;
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
    const { accessToken, emailId } = await request.json();

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

    // Fetch the user's email address
    let userEmail = "";
    try {
      const profile = await gmail.users.getProfile({ userId: "me" });
      userEmail = profile.data.emailAddress || "";
    } catch (e) {
      console.error("Failed to fetch user email address", e);
    }

    const customLabelNames = await getCustomLabelNames(gmail);

    let query = "is:unread";
    if (customLabelNames.length > 0) {
      const excludeLabels = customLabelNames
        .map((name: string) => `-label:"${name}"`) // label:<name>, quoted for spaces
        .join(" ");
      query += ` ${excludeLabels}`;
    }

    const emailsResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: MAX_EMAILS,
    });

    const emails = emailsResponse.data.messages || [];

    // If emailId is provided, process only that specific email
    if (emailId) {
      const targetEmail = emails.find((email) => email.id === emailId);
      if (!targetEmail) {
        return NextResponse.json(
          { error: "Email not found or already processed" },
          { status: 404 }
        );
      }

      const result = await processSingleEmail(gmail, targetEmail);
      return NextResponse.json({ results: [result], userEmail });
    }

    // If no emailId provided, process all available emails
    const results: EmailData[] = [];

    for (const email of emails) {
      try {
        const result = await processSingleEmail(gmail, email);
        results.push(result);
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

    return NextResponse.json({ results, userEmail });
  } catch (error) {
    console.error("Error in Gmail processing:", error);
    return NextResponse.json(
      { error: "Failed to process emails" },
      { status: 500 }
    );
  }
}

async function processSingleEmail(
  gmail: ReturnType<typeof google.gmail>,
  email: { id?: string | null }
): Promise<EmailData> {
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

    // Extract email body
    const body = extractEmailBody(emailDetails.data.payload as GmailPayload);

    // Classify email using AI
    const classificationResult = await classifyEmail(subject, from, body);

    // Check if label exists, create if not
    const labelId = await ensureLabelExists(
      gmail,
      classificationResult.category
    );

    // Apply label to email
    await gmail.users.messages.modify({
      userId: "me",
      id: email.id!,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ["UNREAD"],
      },
    });

    return {
      id: email.id!,
      subject,
      category: classificationResult.category,
      labeled: true,
      model: classificationResult.model,
      tokens: classificationResult.tokens,
      cost: classificationResult.cost,
    };
  } catch (error) {
    console.error(`Error processing email ${email.id}:`, error);
    return {
      id: email.id!,
      subject: "Error processing email",
      category: "Error",
      labeled: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
): Promise<ClassificationResult> {
  const prompt = `Analyze this email and classify it into one of the following categories: [${validCategories.join(
    ", "
  )}]. \n\nConsider these factors to determine if it's an important email vs automated/sales:\n1. Sender email domain (personal domains vs corporate vs marketing platforms)\n2. Subject line patterns (urgency indicators, personal names, vs generic marketing)\n3. Email body content (personalized vs generic, action required vs informational)\n4. Language patterns (formal vs casual, specific vs generic)\n\nCategories explanation:\n- "Important": Critical emails requiring immediate attention (work deadlines, personal emergencies)\n- "Urgent": Time-sensitive matters that need quick response\n- "Work": Professional communications from colleagues, clients, or work-related services\n- "Personal": Messages from friends, family, or personal contacts\n- "Finance": Banking, bills, financial statements, investment updates\n- "Sales": Marketing emails trying to sell products/services\n- "Promotions": Discounts, deals, promotional offers\n- "Newsletter": Regular updates from subscribed services\n- "Social": Social media notifications, event invitations\n- "Shopping": Order confirmations, shipping updates, e-commerce\n- "Entertainment": Movies, games, streaming services\n- "Health": Medical appointments, health insurance, fitness\n- "Education": Course updates, academic communications\n- "Automated": System notifications, confirmations, receipts\n- "Spamming": Unwanted, suspicious, or irrelevant emails\n- "Other": Other categories not listed above\n\nEmail Details:\nFrom: ${from}\nSubject: ${subject}\nBody Preview: ${body.substring(
    0,
    500
  )}${
    body.length > 500 ? "..." : ""
  }\n\nReturn only following json format. Don't return anything else, strictly return this json: {"category": "category name"}`;

  // Try Claude (Anthropic)
  try {
    const claudePrompt = prompt + "\nReturn only the category name:";
    const completion = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Use Haiku for speed/cost, or Opus/Sonnet if desired
      max_tokens: 20,
      messages: [{ role: "user", content: claudePrompt }],
    });

    const claudeCategory = JSON.parse(
      completion.content[0].type === "text" ? completion.content[0].text : ""
    ).category;

    if (claudeCategory && validCategories.includes(claudeCategory)) {
      const estimatedTokens =
        completion.usage.input_tokens + completion.usage.output_tokens;
      const cost =
        (completion.usage.input_tokens * 0.8) / 1000000 +
        (completion.usage.output_tokens * 4) / 1000000;
      return {
        category: claudeCategory,
        model: "anthropic",
        tokens: estimatedTokens,
        cost,
      };
    }
  } catch (error) {
    console.error("Claude API error:", error);
  }

  // Then try Gemini
  try {
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
      },
    });
    const category = result.text?.trim() || "";
    if (category && validCategories.includes(category)) {
      // Estimate tokens for Gemini (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = result.usageMetadata?.totalTokenCount || 0;
      const cost = estimatedTokens * 1.25;

      return {
        category,
        model: "gemini",
        tokens: estimatedTokens,
        cost,
      };
    }
  } catch (error) {
    console.error("Gemini API error:", error);
  }

  return { category: "Other", model: "fallback", tokens: 0, cost: 0 }; // Final fallback
}
async function getCustomLabelNames(
  gmail: ReturnType<typeof google.gmail>
): Promise<string[]> {
  try {
    const labelsResponse = await gmail.users.labels.list({ userId: "me" });
    const allLabels = labelsResponse.data.labels || [];

    const customLabelNames = validCategories;

    const matchingLabelNames: string[] = [];
    for (const label of allLabels) {
      if (label.name && customLabelNames.includes(label.name)) {
        matchingLabelNames.push(label.name); // Use name, not ID
      }
    }

    return matchingLabelNames;
  } catch (error) {
    console.error("Error getting custom label names:", error);
    return [];
  }
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
