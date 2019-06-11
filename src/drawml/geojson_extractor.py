#===============================================================================
#
#  Flatmap viewer and annotation tools
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

from math import pi as PI
import os

#===============================================================================

import pptx.shapes.connector
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.spec import autoshape_types

#===============================================================================

from .extractor import GeometryExtractor, Transform
from .extractor import ellipse_point

from .formula import Geometry, radians

#===============================================================================

'''
For generating GeoJSON...

https://simoncozens.github.io/beziers.py/index.html

b1 = CubicBezier(Point(0, 22361),
            Point(66977, -8289),
            Point(204903, -1762),
            Point(296286, 8739))
b2 = CubicBezier(Point(296286, 8739),
            Point(387669, 19240),
            Point(566463, 131908),
            Point(538083, 126232))
'''

#===============================================================================

class MakeGeoJsonSlide(object):
    def __init__(self, slide, slide_number, slide_size, args):
        pass

#===============================================================================

class GeoJsonExtractor(GeometryExtractor):
    def __init__(self, args):
        super().__init__(args)
        self._slide_maker = MakeGeoJsonSlide

#===============================================================================
