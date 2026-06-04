export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("sendEmail: RESEND_API_KEY is not configured in environment variables.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Strange Labs <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error response:", data);
      return { success: false, error: data };
    }

    console.log(`sendEmail: Email sent successfully to ${to}. Message ID: ${data.id}`);
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("sendEmail: Exception while sending email:", error);
    return { success: false, error: error.message || error };
  }
}
