import type { FaceShapeName } from "./shapes";

/**
 * The shape galleries.
 *
 * Images live in public/assets/faceshapes/<shape>/ and are referenced by their
 * actual filenames here so the app serves the current assets directly.
 */

export type GalleryKey = FaceShapeName | "trending";

export interface HaircutGalleryItem {
    slot: string;
    name: string;
    slug: string;
    src: string;
}

const SLOTS = ["01", "02", "03"] as const;

const toName = (file: string): string =>
    file
        .replace(/\.[^.]+$/, "")
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const gallery = (shape: GalleryKey, files: readonly string[]): HaircutGalleryItem[] =>
    files.map((file, index) => {
        const slot = SLOTS[index] ?? String(index + 1).padStart(2, "0");
        const slug = file.replace(/\.[^.]+$/, "");
        return {
            slot,
            name: toName(file),
            slug,
            src: `/assets/faceshapes/${shape}/${file}`,
        };
    });

const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

export const HAIRCUT_CATALOG: Record<GalleryKey, HaircutGalleryItem[]> = {
    oval: gallery("oval", ["buzz-cut.jpg", "crew-cut.jpg", "textured-crop.jpg"]),
    round: gallery("round", [
        "high-volume-blowout.webp",
        "long-slick-back.webp",
        "textured-quiff.webp",
    ]),
    square: gallery("square", [
        "messy-crop.jpg",
        "short-caesar-cut.jpg",
        "textured-fringe.jpg",
    ]),
    heart: gallery("heart", [
        "classic-side-part.webp",
        "long-fringe.webp",
        "side-part-fringe.webp",
    ]),
    diamond: gallery("diamond", [
        "faux-hawk.webp",
        "sweeping-fringe.webp",
        "textured-crop.webp",
    ]),
    long: gallery("long", ["crop-with-bangs.jpg", "shag.jpg", "side-part.jpg"]),
    triangle: gallery("triangle", [
        "french-crop.jpg",
        "modern-pompadour.jpg",
        "textured-quiff.webp",
    ]),
    trending: [],
};

export const galleryItemsFor = (
    shape: FaceShapeName | null,
): HaircutGalleryItem[] => {
    if (shape) return HAIRCUT_CATALOG[shape] ?? [];

    const pool = (Object.keys(HAIRCUT_CATALOG) as GalleryKey[])
        .filter((key): key is FaceShapeName => key !== "trending")
        .flatMap((key) => HAIRCUT_CATALOG[key]);

    return shuffle(pool).slice(0, 10);
};