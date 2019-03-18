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

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

#===============================================================================

TILE_SIZE = (256, 256)

#===============================================================================

def create_directories(file_name):
    directory = os.path.dirname(file_name)
    if not os.path.exists(directory):
        os.makedirs(directory)

#===============================================================================

class TileMaker(object):
    def __init__(self, map, tile_path, zoom_range=None):
        self._map = map
        self._tiled_size = (int(math.ceil(map.bounds[0]/TILE_SIZE[0])),
                            int(math.ceil(map.bounds[1]/TILE_SIZE[1])))
        self._tiled_image_size = (TILE_SIZE[0]*self._tiled_size[0],
                                  TILE_SIZE[1]*self._tiled_size[1])


        max_tile_dim = max(self._tiled_size[0], self._tiled_size[1])
        self._full_zoom = int(math.ceil(math.log(max_tile_dim, 2)))
        self._tile_path = tile_path
        self._zoom_range = zoom_range


    def make_tiles(self, image, scale=None, offset=None):
        if scale is None:
            scaled_image = image.image
        else:
            scaled_size = [scale[0]*image.width, scale[1]*image.height]
            scaled_image = image.image.resize(scaled_size, Image.LANCZOS)

        tiled_image = Image.new('RGBA', self._tiled_image_size, (0, 0, 0, 0))

        overview_height = self._map.bounds[1]
        y_offset = self._tiled_image_size[1] - overview_height
        if offset is None:
            offset = [0, y_offset]   ##  Y offset to drop image down
        tiled_image.paste(scaled_image, offset, scaled_image)

        tiled_size = self._tiled_size

        # Divide tiled_image into TILE_SIZE tiles, only outputting non-transparent
        # tiles.

        for z in range(self._full_zoom, -1, -1):
            print('Tiling', z, tiled_size, tiled_image.size)
            overview_image = Image.new('RGBA', (tiled_image.width//2, tiled_image.height//2), (0, 0, 0, 0))
            overview_size = (int(math.ceil(tiled_size[0]/2)), int(math.ceil(tiled_size[1]/2)))
            overview_height //= 2
            overview_offset = TILE_SIZE[1]*overview_size[1] - overview_height
            left = 0
            for x in range(tiled_size[0]):
                lower = tiled_image.height
                for y in range(tiled_size[1]):   ## y = 0 is lowest tile row
                    tile = tiled_image.crop((left, lower-TILE_SIZE[1], left+TILE_SIZE[0], lower))
                    tile_name = os.path.join(self._tile_path, image.layer_name, str(z), str(x), '{}.png'.format(y))
#                    if x in [11, 12] and y in [60, 61, 62]:
#                        print(tile_name, left, lower, tile.getbbox())
#                        if x == 12:
#                            tile.save('head-{}.png'.format(y))
                    if tile.getbbox():     ## and z in self._zoom_range
                        create_directories(tile_name)
                        tile.save(tile_name)
                        # Only need to paste if not empty...
                        half_tile = tile.resize((TILE_SIZE[0]//2, TILE_SIZE[1]//2), Image.LANCZOS)
                        overview_image.paste(half_tile, (left//2, (lower-TILE_SIZE[1])//2), half_tile)
                    lower -= TILE_SIZE[1]
                left += TILE_SIZE[0]
            tiled_image = overview_image
            tiled_size = overview_size


#===============================================================================

class Map(object):
    def __init__(self, bounds):
        self._bounds = bounds

    @property
    def bounds(self):
        return self._bounds


#===============================================================================

class ImageSource(object):
    def __init__(self, file_name, layer_name):
        self._image = Image.open(file_name)
        self._layer_name = layer_name

    @property
    def image(self):
        return self._image

    @property
    def layer_name(self):
        return self._layer_name


#===============================================================================

def main(options):
    map = Map((10000, 18000))
    tm = TileMaker(map, 'tiles')

    image = ImageSource('./head-alpha.png', 'head')

    # Check for a `world` file to get image scale and offset
    # But these are properties specifying how an image is embedded into a map,
    # so are to do with the map, not the image (the same image might be
    # embedded differently in different maps).

    tm.make_tiles(image)

#===============================================================================

if __name__ == '__main__':
    # Get options

    # Option to make colour value transparent

    options = {}
    main(options)

#===============================================================================
