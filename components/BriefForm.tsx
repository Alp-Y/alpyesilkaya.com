"use client";

import { useState } from "react";
import { site } from "@/site.config";
import styles from "./ContactSection.module.css";

/**
 * brief.txt — the three things a useful brief contains, as a form that emails
 * them straight to Alp. The site is static (GitHub Pages), so the message goes
 * through FormSubmit (formsubmit.co), which forwards it to site.email. The very
 * first submission sends a one-time activation email to that address.
 */
const ENDPOINT = `https://formsubmit.co/ajax/${site.email}`;

const FIELDS = [
  { name: "task", title: "The task you repeat", hint: "What you do by hand, step by step.", required: true },
  { name: "files", title: "The files it touches", hint: "DWG, XYZ survey points, Excel sheets…", required: false },
  { name: "frequency", title: "How often it comes round", hint: "Every survey, every week, every progress update.", required: false },
] as const;

type Status = "idle" | "sending" | "sent" | "error";

export default function BriefForm() {
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("_honey")) return; // a bot filled the hidden field
    setStatus("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      const json = (await res.json().catch(() => ({}))) as { success?: string | boolean };
      if (!res.ok || String(json.success) === "false") throw new Error("not sent");
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  };

  return (
    <form className={styles.brief} onSubmit={onSubmit} aria-labelledby="brief-title" data-cursor="text">
      <div className={styles.briefHead}>
        <span id="brief-title" className="mono">
          brief.txt
        </span>
        <span className={`mono ${styles.briefMeta}`}>3 lines is enough</span>
      </div>

      <ol className={styles.briefList}>
        {FIELDS.map((f, i) => (
          <li key={f.name}>
            <span className={`mono ${styles.briefNum}`} aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <label className={styles.briefField}>
              <b>
                {f.title}
                {!f.required && <span className={styles.briefOptional}> · optional</span>}
              </b>
              <textarea name={f.name} rows={2} placeholder={f.hint} required={f.required} maxLength={2000} />
            </label>
          </li>
        ))}
        <li>
          <span className={`mono ${styles.briefNum}`} aria-hidden="true">
            @
          </span>
          <label className={styles.briefField}>
            <b>Your email</b>
            <input type="email" name="email" placeholder="So I can reply" required autoComplete="email" />
          </label>
        </li>
      </ol>

      {/* FormSubmit settings, and a trap only bots fill in */}
      <input type="hidden" name="_subject" value="Workflow brief — alpyesilkaya.com" />
      <input type="hidden" name="_template" value="table" />
      <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className={styles.honey} aria-hidden="true" />

      <div className={styles.briefFoot}>
        <p className={`mono ${styles.briefStatus}`} role="status" data-status={status}>
          {status === "sending" && "Sending…"}
          {status === "sent" && "Sent. Thank you."}
          {status === "error" && (
            <>
              Couldn’t send. Email <a href={`mailto:${site.email}`}>{site.email}</a>
            </>
          )}
        </p>
        <button type="submit" className={styles.briefSend} disabled={status === "sending"}>
          Send brief <span className="arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
