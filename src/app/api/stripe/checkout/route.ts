import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

export async function POST(request: Request) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing required fields: invoiceId is required" },
        { status: 400 }
      );
    }

    // Fetch invoice details securely from the database
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*, projects(title)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const amount = Number(invoice.amount);
    const projectTitle = (invoice.projects as any)?.title || "Strange Labs Invoice";

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create a Stripe Checkout Session
    // Amount is in ₹ — convert to paise (smallest INR unit) for Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: projectTitle || "Strange Labs Invoice",
              description: `Invoice #${invoiceId.slice(0, 8)}`,
            },
            unit_amount: Math.round(amount * 100), // ₹ to paise
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?payment=cancelled`,
      metadata: {
        invoiceId,
        projectTitle: projectTitle || "",
      },
    });

    // Update the invoice with the Stripe session ID
    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({ stripe_session_id: session.id })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Invoice update error:", updateError);
      // Don't fail the request — the checkout session was already created
      // The webhook will still handle payment completion via metadata
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout API error:", error);

    // Surface Stripe-specific errors with more detail
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
