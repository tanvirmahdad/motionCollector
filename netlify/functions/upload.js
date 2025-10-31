const sgMail = require("@sendgrid/mail");

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

    // ---- EMAIL THE CSV USING SENDGRID ----
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY not set");
    sgMail.setApiKey(SENDGRID_API_KEY);
    
    // The participant's email is now the recipient
    const TO_ADDRESS   = email;                                  // user input
    const FROM_ADDRESS = "motion.collector.sender@gmail.com";  // your verified sender
    //const CC_PI        = "YOUR_LAB_INBOX@YOURDOMAIN.edu";        // optional copy to yourself
    
    const subject = `Your Motion Data Submission`;
    const textSummary = [
      `Hello,`,
      ``,
      `Attached is the motion sensor data you just recorded.`,
      ``,
      `Device info: ${userAgent || "N/A"}`,
      `Collected at: ${collectedAt || new Date().toISOString()}`,
      ``,
      `Best,`,
      `Sturdy Lab Motion Data Collector`
    ].join("\n");
    
    const msg = {
      to: TO_ADDRESS,
      from: FROM_ADDRESS,
      subject,
      text: textSummary,
      attachments: [
        {
          content: Buffer.from(csv, "utf8").toString("base64"),
          filename: "motion_data.csv",
          type: "text/csv",
          disposition: "attachment"
        }
      ]
    };
    
    await sgMail.send(msg);
    console.log("Email sent to participant:", TO_ADDRESS);
    

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

