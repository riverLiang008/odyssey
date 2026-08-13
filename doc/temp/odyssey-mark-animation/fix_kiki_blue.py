from PIL import Image

SOURCE = r"doc/temp/odyssey-mark-animation/kiki-source.png"
OUTPUT = r"doc/temp/odyssey-mark-animation/kiki-v6-blue-corrected.png"

# Bounds are measured from the supplied 1505 x 1045 Kiki storyboard.
# Each y1 is the green top (62.5% of the mark); y2 is the canonical
# V6 blue top (75% of the mark). Only blue-dominant pixels are removed.
regions = [
    # Start six pixels below the yellow baseline so its bright core and bloom
    # remain intact. The lower edge (canonical blue top) is unchanged.
    (781, 527, 830, 543),   # Scene 05 — approved standard; do not move
    (1273, 526, 1319, 541), # Scene 06
    (245, 844, 283, 855),   # Scene 07
    (768, 841, 805, 851),   # Scene 08
    (1271, 839, 1307, 849), # Scene 09
]

im = Image.open(SOURCE).convert("RGBA")
px = im.load()

for x1, y1, x2, y2 in regions:
    for y in range(y1, y2):
        for x in range(x1, x2):
            # Copy the adjacent empty field so the removed band inherits the
            # scene's subtle illumination instead of becoming a flat patch.
            px[x, y] = px[x1 - 5, y]

im.convert("RGB").save(OUTPUT, format="PNG", compress_level=6)
print(OUTPUT)
