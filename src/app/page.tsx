"use client";

import { useState, useEffect } from "react";

interface EmailResult {
  id: string;
  subject: string;
  category: string;
  labeled: boolean;
  error?: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<EmailResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated by looking for access token
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check");
        const data = await response.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      }
    };

    checkAuth();
  }, []);

  const handleAuthenticate = async () => {
    try {
      const response = await fetch("/api/auth");
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      setError("Failed to start authentication");
    }
  };

  const handleLabelInbox = async () => {
    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      // Get access token from auth check
      const authResponse = await fetch("/api/auth/check");
      const authData = await authResponse.json();

      if (!authData.authenticated) {
        setError("Not authenticated. Please connect your Gmail account first.");
        return;
      }

      const response = await fetch("/api/gmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: authData.accessToken,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        setSuccess(`Successfully processed ${data.results.length} emails`);
      } else {
        setError(data.error || "Failed to process emails");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setIsAuthenticated(false);
        setSuccess("Logged out successfully");
        setResults([]);
      } else {
        setError(data.message || "Failed to log out");
      }
    } catch (error) {
      setError("Network error occurred during logout");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Swappy Labels
          </h1>
          <p className="text-lg text-gray-600">
            Automatically classify and label your Gmail inbox using AI
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {!isAuthenticated ? (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
              <p className="text-gray-600 mb-6">
                Connect your Gmail account to start automatically labeling your
                emails
              </p>
              <button
                onClick={handleAuthenticate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Connect Gmail Account
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Label My Inbox</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleLabelInbox}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    {isProcessing ? "Processing..." : "Label My Inbox"}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-300"
                  >
                    Logout
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                  {success}
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Processing Results</h3>
                  <div className="space-y-2">
                    {results.map((result) => (
                      <div
                        key={result.id}
                        className={`p-4 rounded-lg border ${
                          result.labeled
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 truncate">
                              {result.subject}
                            </p>
                            {result.labeled ? (
                              <p className="text-sm text-gray-600">
                                Labeled as:{" "}
                                <span className="font-semibold text-green-700">
                                  {result.category}
                                </span>
                              </p>
                            ) : (
                              <p className="text-sm text-red-600">
                                Error: {result.error}
                              </p>
                            )}
                          </div>
                          <div className="ml-4">
                            {result.labeled ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Labeled
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Failed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  How it works:
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Fetches your latest 10 unread emails</li>
                  <li>
                    • Uses AI to classify each email subject into categories
                  </li>
                  <li>• Creates Gmail labels if they don&apos;t exist</li>
                  <li>• Applies the appropriate label to each email</li>
                  <li>• Marks emails as read</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
