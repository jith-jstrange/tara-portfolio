import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

export async function POST(request: Request) {
  try {
    const body = await request.text();

    // TODO: Enable signature verification for production
    // const sig = request.headers.get("stripe-signature");
    // if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    //   return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    // }
    // const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    // In test mode, parse the event directly without signature verification
    let event: Stripe.Event;

    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;

        if (!invoiceId) {
          console.warn(
            "Webhook: checkout.session.completed without invoiceId in metadata",
            session.id
          );
          break;
        }

        // Mark the invoice as paid
        const { error: updateError } = await supabaseAdmin
          .from("invoices")
          .update({ status: "paid" })
          .eq("id", invoiceId);

        if (updateError) {
          console.error(
            "Webhook: Failed to update invoice status:",
            updateError
          );
          return NextResponse.json(
            { error: "Failed to update invoice" },
            { status: 500 }
          );
        }

        // Phase 3: Send Payment Receipt Notification
        try {
          const { data: invoiceData } = await supabaseAdmin
            .from("invoices")
            .select("amount, project_id, projects(title, client_id)")
            .eq("id", invoiceId)
            .single();

          if (invoiceData && invoiceData.projects) {
            const projectObj = invoiceData.projects as any;
            const { data: clientProfile } = await supabaseAdmin
              .from("profiles")
              .select("full_name, email")
              .eq("id", projectObj.client_id)
              .single();

            if (clientProfile && clientProfile.email) {
              const amount = Number(invoiceData.amount);
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              const subject = `Strange Labs: Payment Receipt for ${projectObj.title}`;
              const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                  <h2 style="color: #10b981;">Payment Received!</h2>
                  <p>Hi ${clientProfile.full_name || "Client User"},</p>
                  <p>Thank you for your payment. We have successfully processed the payment for your project: <strong>${projectObj.title}</strong>.</p>
                  
                  <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #111827;">Payment Details</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #4b5563;">
                      <tr>
                        <td style="padding: 5px 0;"><strong>Invoice ID:</strong></td>
                        <td style="padding: 5px 0; text-align: right;">#${invoiceId.slice(0, 8)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0;"><strong>Project:</strong></td>
                        <td style="padding: 5px 0; text-align: right;">${projectObj.title}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0;"><strong>Amount Paid:</strong></td>
                        <td style="padding: 5px 0; text-align: right; color: #10b981; font-weight: bold;">₹${amount.toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0;"><strong>Status:</strong></td>
                        <td style="padding: 5px 0; text-align: right; color: #10b981; font-weight: bold;">Paid</td>
                      </tr>
                    </table>
                  </div>

                  <p>Development is currently active. You can log in to your dashboard to monitor developer tasks, logged hours, and track progress.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${appUrl}/dashboard" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Project Dashboard</a>
                  </div>
                  
                  <hr style="border: 0; border-top: 1px solid #eee;" />
                  <p style="font-size: 12px; color: #9ca3af; text-align: center;">Strange Labs &copy; 2026. Built by jstrange.</p>
                </div>
              `;
              await sendEmail({ to: clientProfile.email, subject, html });
            }
          }
        } catch (emailError) {
          console.error("Failed to send payment email notification:", emailError);
        }

        console.log(
          `Webhook: Invoice ${invoiceId} marked as paid (session: ${session.id})`
        );
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt but take no action
        console.log(`Webhook: Unhandled event type ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
