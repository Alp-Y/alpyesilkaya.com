import type { Metadata } from "next";
import Link from "next/link";

/**
 * The tool was renamed (Automatize Excavation Calculations → Excavation
 * Volume Calculator). The old address stays valid and forwards to the new
 * one, so links already shared keep working on a static host.
 */
const TO = "/tools/excavation-volume-calculator/";

export const metadata: Metadata = {
  title: "Excavation Volume Calculator",
  robots: { index: false },
  alternates: { canonical: TO },
};

export default function Moved() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${TO}`} />
      <div className="container" style={{ paddingBlock: "160px" }}>
        <p>
          This tool is now the <Link href={TO}>Excavation Volume Calculator</Link>.
        </p>
      </div>
    </>
  );
}
