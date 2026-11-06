"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="office-help-button">
      Print
    </button>
  );
}
