#!/bin/sh
# 허브다섯메 농장 사이트(herbfive-farm 저장소)의 최신 완성본을 farm/ 폴더로 가져와요.
# 쓰는 법: sh sync_farm.sh   (저장소 맨 위 폴더에서)
set -e
tmp=$(mktemp -d)
git clone -q --depth 1 https://github.com/herb5-i/herbfive-farm "$tmp/farm"
for f in index.html admin.html staff.html logo.gif icon.png; do cp "$tmp/farm/$f" farm/; done
rm -rf "$tmp"
echo "farm/ 폴더를 최신으로 바꿨어요"
# 허브아이 디자인 다시 입히기 (화면 모양만 덮어써요)
python3 tools/farm_theme.py
