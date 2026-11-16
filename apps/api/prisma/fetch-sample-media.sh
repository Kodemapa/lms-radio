#!/usr/bin/env bash
# Downloads openly licensed sample videos used by the development seed into
# .storage/seed/ (git-ignored). Run from apps/api: ./prisma/fetch-sample-media.sh
#
#  placenta.webm  "Explaining The Human Body – The Placenta: When a New Organ Grows in the Body"
#                 Deutsche Welle, CC BY-SA 4.0, via Wikimedia Commons
#  radiation.webm "Prenatal Radiation Exposure", US CDC, public domain, via Wikimedia Commons
set -euo pipefail
dir="$(dirname "$0")/../.storage/seed"
mkdir -p "$dir"
ua="obgyn-elms-dev-seed/1.0"
curl -fL -A "$ua" -o "$dir/placenta.webm" \
  "https://upload.wikimedia.org/wikipedia/commons/b/bc/Deutsche_Welle_-_Explaining_The_Human_Body_%28English%29_-_The_Placenta_When_a_New_Organ_Grows_in_the_Body.webm"
curl -fL -A "$ua" -o "$dir/radiation.webm" \
  "https://upload.wikimedia.org/wikipedia/commons/9/9b/Prenatal_Radiation_Exposure.webm" || \
  echo "radiation.webm: download it from https://commons.wikimedia.org/wiki/File:Prenatal_Radiation_Exposure.webm"
echo "Sample media saved in $dir"
