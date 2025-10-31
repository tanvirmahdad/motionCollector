exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const { email, csv, userAgent, collectedAt } = data;

    if(!email || !csv){
      return {
        statusCode: 400,
        body: JSON.stringify({ ok:false, error:"Missing email or csv" })
      };
    }

    // ---- Store choice 1: log it (simple baseline)
    // You can view these in Netlify function logs.
    console.log("New submission:");
    console.log("Email:", email);
    console.log("UserAgent:", userAgent);
    console.log("CollectedAt:", collectedAt);
    console.log("CSV lines:", csv.split("\n").length);

    // ---- Store choice 2 (recommended): write to Netlify Blobs
    // Netlify has a built-in durable KV/blob store (if enabled on your site).
    // We'll try to save "email_timestamp.csv" as a blob.
    //
    // This requires: Netlify Blobs enabled on your site.
    // If Blobs isn't enabled yet, you can comment this block out.

    if (typeof context?.blobs?.set === "function") {
      const safeEmail = email.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const key = `motion_${safeEmail}_${ts}.csv`;

      await context.blobs.set(key, csv, {
        contentType: "text/csv"
      });

      console.log("Saved blob at key:", key);
    }

    // ---- (Optional) email the PI automatically:
    // You can integrate an email provider API (SendGrid, Mailgun, etc.).
    // Pseudocode example:
    //
    // await sendEmail({
    //   to: "your-lab-inbox@ohio.edu",
    //   subject: "New motion capture from " + email,
    //   text: csv
    // });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("Upload error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, error: "Server error" })
    };
  }
};
