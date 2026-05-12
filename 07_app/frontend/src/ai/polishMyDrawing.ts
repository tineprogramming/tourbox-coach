import type { AiPlugin } from "./types";

// STUB plugin. The real implementation will POST the canvas snapshot to a
// scribble-conditioned image-gen API (fal.ai / Replicate / Azure OpenAI Image)
// and return the polished variants.
//
// In the lab build we just acknowledge the request so the UI wiring can be
// developed and tested without burning API credits.

export const polishMyDrawingPlugin: AiPlugin = {
  id: "polish-my-drawing",
  name: "Polish My Drawing",
  description:
    "Sends the current canvas to a sketch-to-image model and returns 4 polished variants. (Stubbed in lab.)",

  async run(input, ctx) {
    ctx.log(
      `[polishMyDrawing:stub] would polish ${input.strokes.length} strokes — ` +
        `wire to fal.ai / Replicate when ready.`,
    );
    return {
      message:
        "Polish My Drawing is stubbed in the lab build. Wire to a real image API in src/ai/polishMyDrawing.ts.",
      images: [],
    };
  },
};
