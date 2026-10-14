# Minecraft Seven navigation font

Source: [Mojang/web-theme-bootstrap](https://github.com/Mojang/web-theme-bootstrap/tree/92d9913110cf79db5813e6335f97c6dc689854ee/assets/fonts), `Minecraft-Seven_v2.ttf`.

Copyright (c) 2015-2020 Mojang AB. Distributed under the SIL Open Font License 1.1; see `OFL.txt`.

`minecraft-seven-latin.woff` is a printable ASCII subset (U+0020-007E), converted with FontTools. Used only for the navigation wordmark, CSS alias `Fimel Pixel`. This is the open-source Minecraft Seven font, not a copy of Animated Java's `MinecraftFull.ttf` (whose embedded license says “All rights reserved”).

```powershell
pyftsubset Minecraft-Seven_v2.ttf --unicodes=U+0020-007E --flavor=woff --output-file=minecraft-seven-latin.woff --layout-features='' --name-IDs='*' --name-languages='*'
```

The previous Monocraft subset is retained in its own directory but is no longer preloaded or used by the navigation.
