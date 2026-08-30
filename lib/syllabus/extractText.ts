import * as mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export async function extractDocumentText(
  bytes: ArrayBuffer,
  mimeType: string,
  filename: string,
) {
  const extension = filename.toLowerCase().split(".").pop();
  if (mimeType === "application/pdf" || extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractPdfText(pdf, { mergePages: true });
    return Array.isArray(result.text) ? result.text.join("\n") : result.text;
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: bytes });
    return result.value;
  }
  throw new Error("Only PDF and DOCX syllabi are supported.");
}
