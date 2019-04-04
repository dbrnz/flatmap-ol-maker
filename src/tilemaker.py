#===============================================================================
#
#  Flatmap viewer and annotation tool
#
#  Copyright (c) 2019  David Brooks
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
#===============================================================================

"""
Generate a Flatmap's tiles from images:

* A Flatmap is reactangular (width, height) and has a coordinate system
  with origin in bottom right corner (??? PIL works with top-left...).
* Measurements are in terms of `flat map units`, abbreviated as `fmu`.
* Output tiles are square, 256 x 256 fmus.
* 1 tile pixel equals 1 fmu
* Input images are provided with a description that specifies:

    * Size of an image pixel in fmus (X and Y).
    * Position, in fmus, of the top left corner of the image in the flatmap.

Algorithm:

* Scale input image to Flatmap coordinates.
* Output tiles spanning image.
* Output overview tiles.
* Actual zoom levels output is determined by program option.

"""
#===============================================================================

import math
import os

#===============================================================================

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

#===============================================================================

COLOUR_WHITE = (255, 255, 255)

TILE_SIZE    = (256, 256)

#===============================================================================

def create_directories(file_name):
    directory = os.path.dirname(file_name)
    if not os.path.exists(directory):
        os.makedirs(directory)

#===============================================================================

# Based on https://stackoverflow.com/a/54148416/2159023

def make_transparent(img, colour):
    x = np.asarray(img.convert('RGBA')).copy()
    if colour == COLOUR_WHITE:
        x[:, :, 3] = (255 * (x[:, :, :3] != 255).any(axis=2)).astype(np.uint8)
    else:
        x[:, :, 3] = (255*(x[:,:,0:3] != tuple(colour)[0:3]).any(axis=2)).astype(np.uint8)
    return Image.fromarray(x)

#===============================================================================

class TileMaker(object):
    def __init__(self, map):
        self._map = map
        self._tiled_size = (int(math.ceil(map.bounds[0]/TILE_SIZE[0])),
                            int(math.ceil(map.bounds[1]/TILE_SIZE[1])))
        self._tiled_image_size = (TILE_SIZE[0]*self._tiled_size[0],
                                  TILE_SIZE[1]*self._tiled_size[1])
        max_tile_dim = max(self._tiled_size[0], self._tiled_size[1])
        self._full_zoom = int(math.ceil(math.log(max_tile_dim, 2)))

    def make_tiles(self, image, scale=None, offset=None, zoom_range=None):
        if scale is None:
            scaled_image = image.image
        else:
            scaled_size = [scale[0]*image.width, scale[1]*image.height]
            scaled_image = image.image.resize(scaled_size, Image.LANCZOS)

        tiled_image = Image.new('RGBA', self._tiled_image_size, (0, 0, 0, 0))

        if offset is None:
            offset = [0, 0]

        # PIL origin is top left, map's is bottom right
        offset[1] = (self._map.bounds[1] - offset[1]) - scaled_image.height

        overview_height = self._map.bounds[1]
        offset[1] += (self._tiled_image_size[1] - overview_height)
        tiled_image.paste(scaled_image, offset, scaled_image)

        # Divide tiled_image into TILE_SIZE tiles, only outputting non-transparent
        # tiles.

        if zoom_range is None:
            zoom_range = range(self._full_zoom+1)

        tiled_size = self._tiled_size
        for z in range(self._full_zoom, -1, -1):
            if z in zoom_range:
                print('Tiling zoom level {} ({} x {} tiles)'.format(z, tiled_size[0], tiled_size[1]))
            overview_image = Image.new('RGBA', (tiled_image.width//2, tiled_image.height//2), (0, 0, 0, 0))
            overview_size = (int(math.ceil(tiled_size[0]/2)), int(math.ceil(tiled_size[1]/2)))
            overview_height //= 2
            left = 0
            for x in range(tiled_size[0]):
                lower = tiled_image.height
                for y in range(tiled_size[1]):   ## y = 0 is lowest tile row
                    tile = tiled_image.crop((left, lower-TILE_SIZE[1], left+TILE_SIZE[0], lower))
                    tile_name = os.path.join(self._map.id, 'tiles', image.layer_name, str(z), str(x), '{}.png'.format(y))
                    if tile.getbbox():
                        if z in zoom_range:
                            create_directories(tile_name)
                            tile.save(tile_name)
                        half_tile = tile.resize((TILE_SIZE[0]//2, TILE_SIZE[1]//2), Image.LANCZOS)
                        overview_image.paste(half_tile, (left//2, (lower-TILE_SIZE[1])//2), half_tile)
                    lower -= TILE_SIZE[1]
                left += TILE_SIZE[0]
            tiled_image = overview_image
            tiled_size = overview_size

#===============================================================================

class Map(object):
    def __init__(self, id, bounds):
        self._id = id
        self._bounds = bounds

    @property
    def bounds(self):
        return self._bounds

    @property
    def id(self):
        return self._id

#===============================================================================

class ImageSource(object):
    def __init__(self, layer_name, file_name, transparent_colour=None):
        self._layer_name = layer_name
        self._image = Image.open(file_name)
        if transparent_colour is not None:
            self._image = make_transparent(self._image, transparent_colour)

    @property
    def image(self):
        return self._image

    @property
    def layer_name(self):
        return self._layer_name

#===============================================================================

def main(args):
    map = Map(args.map[0], [int(a) for a in args.map[1:]])
    tm = TileMaker(map)
    image = ImageSource(args.layer[0], args.layer[1],
                        COLOUR_WHITE if args.transparent else None)
    tm.make_tiles(image,
        scale=[float(s) for s in args.scale] if args.scale else None,
        offset=[int(o) for o in args.offset] if args.offset else None,
        zoom_range=range(int(args.zoom[0]), int(args.zoom[1])+1) if args.zoom else None)

#===============================================================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate tiles for a Flatmap.')
    parser.add_argument('--map', required=True, nargs=3, metavar=('ID', 'WIDTH', 'HEIGHT'),
                        help='REQUIRED: the map to generate tiles for. Size is in map pixel units.')
    parser.add_argument('--layer', required=True, nargs=2, metavar=('ID', 'SOURCE_PNG'),
                        help='REQUIRED: image to tile for a single map layer.')
    parser.add_argument('--offset', nargs=2, metavar=('BOTTOM', 'RIGHT'),
                        help='Bottom right corner of image in map pixel units.')
    parser.add_argument('--scale', nargs=2, metavar=('X-SIZE', 'Y-SIZE'),
                        help='Size of an image pixel in terms of a map pixel unit.')
    parser.add_argument('--transparent', action='store_true', help='Make white in image transparent.')
    parser.add_argument('--zoom', nargs=2, metavar=('MIN-LEVEL', 'MAX-LEVEL'),
                        help='Range of zoom levels to generate tiles for.')

    args = parser.parse_args()
    main(args)

#===============================================================================
