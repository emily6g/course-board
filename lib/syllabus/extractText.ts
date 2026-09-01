import * as mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export type ExtractedDocument = {
  text: string;
  pages: string[];
  format: "pdf" | "docx" | "text";
};

export async function extractDocument(
  bytes: ArrayBuffer,
  mimeType: string,
  filename: string,
): Promise<ExtractedDocument> {
  const extension = filename.toLowerCase().split(".").pop();
  if (mimeType === "application/pdf" || extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractPdfText(pdf, { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    return { text: pages.join("\n\f\n"), pages, format: "pdf" };
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: bytes });
    return { text: result.value, pages: [result.value], format: "docx" };
  }
  if (mimeType === "text/plain" || extension === "txt") {
    const text = new TextDecoder().decode(bytes);
    return { text, pages: [text], format: "text" };
  }
  throw new Error("Only PDF, DOCX, and TXT syllabi are supported.");
}

export async function extractDocumentText(
  bytes: ArrayBuffer,
  mimeType: string,
  filename: string,
) {
  return (await extractDocument(bytes, mimeType, filename)).text;
}
