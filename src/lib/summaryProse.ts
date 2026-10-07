/** Remove list markers from commercialization prose, including cached AI output. */
export function normalizeCommercializationProse(summary: string): string {
  return summary.replace(
    /(^##\s*[^\n]*(?:상용화|사업화)[^\n]*\n)([\s\S]*?)(?=^##\s|$(?![\s\S]))/gm,
    (_section, heading: string, body: string) => heading + body
      .replace(/^[\t ]*(?:[-+*•·▪◦–—]\s+|\d+[.)]\s+)/gm, "")
      .replace(/([.!?。．！？](?:\*\*)?)[\t ]+(?:[-+•·▪◦–—]|\*(?!\*))[\t ]+/g, "$1 "),
  );
}