export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      // Add this GET handler so it doesn't show a blank page
      GET: async () => {
        return new Response("Aman Voice Assistant API is running! Please use the main frontend UI to interact with Aman.", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      },
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        // ... (keep the rest of the POST logic exactly as it is)
