import type { FaceShapeName } from "./shapes";

/**
 * The shape galleries.
 *
 * Images live in public/assets/faceshapes/<shape>/ as 1:1 800px PNGs. Each is
 * named <slot>-<slug>.png, where the slot is its position in the list below, so
 * swapping one for a real photograph is an overwrite: same name, same
 * extension, same dimensions. Nothing here needs to change when that happens.
 *
 * This module is the single place that knows how an image is addressed, so the
 * naming convention is stated once rather than repeated in components. The same
 * list is mirrored as JSON for tooling: public/assets/faceshapes/manifest.json
 * aggregates every shape, and public/assets/faceshapes/<shape>/haircuts.json
 * holds one shape. The app never fetches those files; keep them in step when
 * this list changes.
 */

export type GalleryKey = FaceShapeName | "trending";

export interface HaircutGalleryItem {
    slot: string;
    name: string;
    slug: string;
    src: string;
}

/**
 * Slot prefixes, in display order. A shape's cuts are numbered by position, so
 * this also fixes how many images a gallery holds.
 */
const SLOTS = ["01", "02", "03"] as const;

/** A cut as [display name, slug]. The slug is what the file is named after. */
type Cut = readonly [name: string, slug: string];

const gallery = (shape: GalleryKey, cuts: readonly Cut[]): HaircutGalleryItem[] =>
    cuts.map(([name, slug], index) => {
        const slot = SLOTS[index];

        if (slot === undefined) {
            throw new Error(
                `gallery("${shape}") has ${cuts.length} cuts but only ${SLOTS.length} slots are defined.`,
            );
        }

        return { slot, name, slug, src: `/assets/faceshapes/${shape}/${slot}-${slug}.png` };
    });

export const HAIRCUT_CATALOG: Record<GalleryKey, HaircutGalleryItem[]> = {
    oval: gallery("oval", [
        ["Textured Crop", "textured-crop"],
        ["Low Taper Fade", "low-taper-fade"],
        ["Classic Pompadour", "classic-pompadour"],
    ]),
    round: gallery("round", [
        ["High Fade Pompadour", "high-fade-pompadour"],
        ["Textured Undercut", "textured-undercut"],
        ["Angular Fringe", "angular-fringe"],
    ]),
    square: gallery("square", [
        ["Textured Crop Fade", "textured-crop-fade"],
        ["Mid Fade Messy Top", "mid-fade-messy-top"],
        ["Classic Side Part", "classic-side-part"],
    ]),
    heart: gallery("heart", [
        ["Mid-Length Bro Flow", "mid-length-bro-flow"],
        ["Side-Swept Fringe", "side-swept-fringe"],
        ["Textured Fringe Low Taper", "textured-fringe-low-taper"],
    ]),
    diamond: gallery("diamond", [
        ["Textured Messy Fringe", "textured-messy-fringe"],
        ["Scissor Cut Full Sides", "scissor-cut-full-sides"],
        ["Textured Crop Low Fade", "textured-crop-low-fade"],
    ]),
    long: gallery("long", [
        ["Heavy Side Swept Fringe", "heavy-side-swept-fringe"],
        ["Classic Side Parting", "classic-side-parting"],
        ["Scissor Cut Fuller Sides", "scissor-cut-fuller-sides"],
    ]),
    triangle: gallery("triangle", [
        ["High Volume Quiff", "high-volume-quiff"],
        ["Textured French Crop High Fade", "textured-french-crop-high-fade"],
        ["Modern Pompadour", "modern-pompadour"],
    ]),
    trending: gallery("trending", [
        ["Low Taper Fade", "low-taper-fade"],
        ["Textured Modern Mullet", "textured-modern-mullet"],
        ["Fluffy Edgar Cut", "fluffy-edgar-cut"],
    ]),
};

export const galleryItemsFor = (
    shape: FaceShapeName | null,
): HaircutGalleryItem[] =>
    shape ? (HAIRCUT_CATALOG[shape] ?? []) : HAIRCUT_CATALOG.trending;