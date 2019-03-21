#!/bin/sh
rm -rf ./$1/tiles/$2/
#
#svgexport ./$1/images/$2.svg ./$1/tiles/tile.png 200:0:400:720 25x
#convert ./$1/tiles/tile.png -transparent white ./$1/tiles/alpha.png
#~/build/flatmaps/gdal2tiles.py -p raster -w none -r average -t $1 -x ./$1/tiles/alpha.png ./$1/tiles/$2/
svgexport $1/images/$2.svg $1/images/$2.png 100% 10x
echo ~/build/flatmaps/gdal2tiles.py -p raster -w none -r cubic -t $1 -x $1/images/$2.png $1/tiles/$2/
~/build/flatmaps/gdal2tiles.py -p raster -w none -r cubic -t $1 -x $1/images/$2.png $1/tiles/$2/
#
