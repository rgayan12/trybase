import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();

    if (!tenant_id) {
      throw new Error("Missing tenant_id");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Update the workspace status to active
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .update({ 
        status: "active",
        provisioned_at: new Date().toISOString() 
      })
      .eq("tenant_id", tenant_id)
      .select("*")
      .maybeSingle();

    if (wsError) throw wsError;
    if (!workspace) throw new Error(`Workspace with tenant_id "${tenant_id}" not found in database.`);

    // 2. Fetch the user's email
    let userEmail = "";
    let userName = "there";

    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(workspace.user_id);
    if (!authError && user) {
        userEmail = user.email;
        userName = user.user_metadata?.full_name?.split(' ')[0] || "there";
    }

    // 3. Send Email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY && userEmail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "TryBase <hello@trybase.io>",
          to: [userEmail],
          subject: "Your TryBase workload is live! 🚀",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #3b82f6;">Hi ${userName},</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #333;">
                Exciting news! Your dedicated workload is now fully provisioned and ready for action on AWS.
              </p>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">Workspace URL:</p>
                <a href="https://${tenant_id}.trybase.io" style="color: #3b82f6; text-decoration: none; font-size: 18px;">https://${tenant_id}.trybase.io</a>
              </div>
              <p style="font-size: 14px; color: #666;">
                Need help? Just reply to this email and our team will jump in.
              </p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #999; text-align: center;">
                &copy; 2026 TryBase. All rights reserved.
              </p>
            </div>
          `,
        }),
      });
      
      if (!res.ok) {
        console.error("Resend API Error:", await res.text());
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
