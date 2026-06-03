import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

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
