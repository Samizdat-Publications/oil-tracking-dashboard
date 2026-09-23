"""Turn the frame folders from shoot-v5.mjs into README GIFs and landing-page animated WebP.

    py scripts/frames-to-media.py ../docs/screens

GIFs are for the README: GitHub renders them inline, but not a video stored in
the repo. They are cut to 720 px wide with one shared palette per clip, which
keeps the navy grounds from banding frame to frame. The landing page gets
animated WebP at full size instead: it autoplays and loops as a plain image,
at a fraction of a GIF's size, and needs nothing beyond Pillow (the ffmpeg
Playwright ships cannot read image sequences). The frame folders are deleted
afterwards.
"""
from __future__ import annotations

import glob
import os
import shutil
import sys

from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "../docs/screens"
FRAMES = os.path.join(OUT, "frames")
FPS = {"globe": 15, "strait": 15, "bill": 15}


def gif(stem: str, files: list[str], fps: int) -> None:
    frames = [Image.open(f).convert("RGB") for f in files]
    w = 720
    frames = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in frames]
    # one palette for the whole clip, taken from a strip of sampled frames
    sample = frames[:: max(1, len(frames) // 8)]
    strip = Image.new("RGB", (w, sample[0].height * len(sample)))
    for i, im in enumerate(sample):
        strip.paste(im, (0, i * im.height))
    pal = strip.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    q = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in frames]
    path = os.path.join(OUT, stem + ".gif")
    # hold the last frame so the end state reads before the loop restarts
    durations = [round(1000 / fps)] * (len(q) - 1) + [2200]
    q[0].save(path, save_all=True, append_images=q[1:], duration=durations, loop=0, optimize=True)
    print(f"  {stem}.gif  {os.path.getsize(path) / 1e6:.1f} MB")


def webp(stem: str, files: list[str], fps: int) -> None:
    frames = [Image.open(f).convert("RGB") for f in files]
    path = os.path.join(OUT, stem + ".webp")
    durations = [round(1000 / fps)] * (len(frames) - 1) + [2200]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=78, method=4)
    print(f"  {stem}.webp {os.path.getsize(path) / 1e6:.1f} MB")


def main() -> None:
    for folder in sorted(glob.glob(os.path.join(FRAMES, "*"))):
        stem = os.path.basename(folder)
        files = sorted(glob.glob(os.path.join(folder, "*.png")))
        if not files:
            continue
        fps = FPS.get(stem, 12)
        gif(stem, files, fps)
        webp(stem, files, fps)
        # the last frame doubles as the video's poster
        Image.open(files[-1]).convert("RGB").save(os.path.join(OUT, stem + "-poster.jpg"), quality=84)
    shutil.rmtree(FRAMES, ignore_errors=True)


if __name__ == "__main__":
    main()
