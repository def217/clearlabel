# AI-generated product descriptions and images: what EU law actually requires

If you use AI to write product descriptions or make product images, two different rules can apply — and they point at two different people. Article 50(2) puts the machine-readable marking duty on the provider of the generative system (the tool vendor). The shop using the tool is a deployer, and its duties come mostly from Article 50(4). Here's the split in plain terms, and what a shop should actually do.

## Article 50(2): the provider's machine-readable marking duty

Article 50(2) says providers of AI systems that generate synthetic image, audio, video or text must ensure the output is marked in a machine-readable format and detectable as artificially generated or manipulated, as far as technically feasible. That's the tool maker — the company that built the model or the feature — not the shop that clicks "generate." The marking is carried in the file itself (for example C2PA Content Credentials, or IPTC metadata with `digitalSourceType` set to `trainedAlgorithmicMedia`), not in a visible caption.

## What a shop using AI output must actually do

A shop that uses a generative tool is a deployer — the person under whose authority the system is used. Deployers aren't the addressee of the 50(2) marking duty itself, but two things still land on you:

1. **Don't strip the marking.** Generators increasingly embed provenance metadata, and ordinary publishing pipelines — resizing, compression, CMS uploads — remove it. If the provider marked the file and you strip it, you lose the benefit of their compliance and the file reaches visitors unmarked.
2. **Article 50(4) is yours.** If you publish AI-generated image, audio or video that counts as a deep fake, you must disclose that it was artificially generated or manipulated. And if you publish AI-generated text to inform the public on matters of public interest, you must disclose that too — unless a named person takes editorial responsibility for it.

## When a shop becomes a deployer (and when it might be more)

You're a deployer whenever you operate an AI system under your own authority for your own use — running a copy tool, an image generator, or a Shopify-style AI feature to produce content you publish. That's the normal case for a shop. You'd only become a provider if you put an AI system on the market under your own name or brand, or substantially modify one — for example, rebranding a third-party tool and reselling it. For a shop that just uses AI on its own product copy, that's rare. [CHECK: confirm the provider-by-rebranding threshold as it applies to a shop that resells a white-labelled AI feature.]

## Interplay with Article 50(4): product photos and deep fakes

A deep fake, in Article 3(60), is AI-generated or manipulated image, audio or video content that resembles existing persons, objects, places, entities or events and would falsely appear to a person to be authentic or truthful. That definition is specific: it's about content that could be mistaken for a real record of someone or something that exists.

Ordinary AI-generated product photos are usually not deep fakes, for a practical reason: a render of a jacket or a sofa isn't depicting an existing person, object or event in a way that would falsely read as a truthful record — it's illustrating a product. [CHECK: this is an interpretation, not settled text — a photorealistic AI image of a real, identifiable product or location could arguably fall closer to the definition, and the Commission's Article 50 guidelines may refine the boundary. Have legal review confirm before publishing.]

Two caveats: visible AI labelling is still good practice even where an image isn't a deep fake, and if you use AI to depict a real person (a model, influencer or customer) in a way that could read as authentic, treat it as a deep fake and disclose.

## Practical steps for a shop

1. Choose tools that mark their output, and keep the setting on.
2. Stop your CMS or image CDN from stripping XMP/IPTC/C2PA metadata; check a test upload.
3. Label AI-generated images visibly where it helps customers (for example, "AI-generated image").
4. For AI-written text published as public information, either disclose it or have a named person take editorial responsibility — and record which you did.
5. Put it in writing: a short policy plus supplier terms that forbid removing provenance.

## FAQ

**Q: Am I the "provider" just because I use an AI image tool?**

A: No. The tool's maker is the provider for 50(2). You're a deployer unless you sell or rebrand the system itself.

**Q: Do I have to machine-mark every AI product photo myself?**

A: Not as the 50(2) addressee — that's the provider's job. Your practical duties are not to strip their marking, and to disclose under 50(4) where it applies.

**Q: Is a visible "AI-generated" caption enough?**

A: It's good practice and helps with 50(4), but it's not the machine-readable marking 50(2) describes. That lives in the file's metadata.

**Q: Are my AI product photos deep fakes?**

A: Usually not, because they don't depict existing persons, objects or events in a way that would falsely read as authentic. [CHECK: the boundary is interpreted, not settled.]

**Q: Do I have to label AI-written product descriptions?**

A: The 50(4) text duty applies to text published to inform the public on matters of public interest, and it's satisfied if a named person takes editorial responsibility. Ordinary commercial product copy usually sits outside it — but the boundary deserves a legal check. [CHECK.]

Check your pages free with ClearLabel's scanner at clearlabel.eu — it shows whether your AI content carries machine-readable marking today.
