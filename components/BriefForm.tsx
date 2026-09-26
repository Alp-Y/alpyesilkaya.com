"use client";

import { useState } from "react";
import { site } from "@/site.config";
import styles from "./ContactSection.module.css";

/**
 * message.txt — a plain message form (name, email, message) that emails
 * straight to Alp. The site is static (GitHub Pages), so the message goes
 * through FormSubmit (formsubmit.co), which forwards it to site.email. The very
 * first submission sends a one-time activation email to that address.
 */
const ENDPOINT = `https://formsubmit.co/ajax/${site.email}`;


type Status = "idle" | "sending" | "sent" | "activate" | "error";

export default function BriefForm() {
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (data._honey) return; // a bot filled the hidden field
    delete data._honey;
    setStatus("sending");
    try {
      // FormSubmit's AJAX endpoint takes JSON
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
      if (res.ok && String(json.success) !== "false") {
        setStatus("sent");
        form.reset();
        return;
      }
      // The very first submission is held until the inbox owner clicks FormSubmit's activation link
      if (/activat/i.test(json.message ?? "")) {
        setStatus("activate");
        return;
      }
      console.warn("brief.txt: not sent", res.status, json);
      setStatus("error");
    } catch (err) {
      console.warn("brief.txt: not sent", err);
      setStatus("error");
    }
  };

  return (
    <form className={styles.brief} onSubmit={onSubmit} aria-labelledby="brief-title" data-cursor="text">
      <div className={styles.briefHead}>
        <span id="brief-title" className="mono">
          message.txt
        </span>
        <span className={`mono ${styles.briefMeta}`}>To: Alp</span>
      </div>

      <div className={styles.msgPair}>
        <label className={styles.msgField}>
          <span className="mono">Name · optional</span>
          <input type="text" name="name" autoComplete="name" maxLength={120} />
        </label>
        <label className={styles.msgField}>
          <span className="mono">Your email</span>
          <input type="email" name="email" placeholder="So I can reply" required autoComplete="email" />
        </label>
      </div>
      <label className={styles.msgField}>
        <span className="mono">Message</span>
        <textarea
          name="message"
          rows={6}
          required
          maxLength={4000}
          placeholder="What do you do by hand? Which files does it touch (DWG, XYZ, Excel…), and how often does it come round?"
        />
      </label>

      {/* FormSubmit settings, and a trap only bots fill in */}
      <input type="hidden" name="_subject" value="New message — alpyesilkaya.com" />
      <input type="hidden" name="_template" value="table" />
      <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className={styles.honey} aria-hidden="true" />

      <div className={styles.briefFoot}>
        <p className={`mono ${styles.briefStatus}`} role="status" data-status={status}>
          {status === "sending" && "Sending…"}
          {status === "sent" && "Sent. Thank you."}
          {status === "activate" && "Received. The inbox needs a one-time activation first."}
          {status === "error" && (
            <>
              Couldn’t send. Email <a href={`mailto:${site.email}`}>{site.email}</a>
            </>
          )}
        </p>
        <button type="submit" className={styles.briefSend} disabled={status === "sending"}>
          Send message <span className="arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
