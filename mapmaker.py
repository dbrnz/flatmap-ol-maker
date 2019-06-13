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

import subprocess
import tempfile
import multiprocessing
import multiprocessing.connection

#===============================================================================

from src.drawml import GeoJsonExtractor

#===============================================================================

def process_slide(extractor, slide_number, output, result_queue):
    slide = extractor.slide_to_geometry(slide_number, False)
    slide.save(output)
    result_queue.put("Processed layer '{}'".format(slide.description))

#===============================================================================

if __name__ == '__main__':
    import argparse
    import os

    parser = argparse.ArgumentParser(description='Convert Powerpoint slides to a flatmap.')
    parser.add_argument('--debug-xml', action='store_true',
                        help="save a slide's DrawML for debugging")
    parser.add_argument('--slide', type=int, metavar='N',
                        help='only process this slide number (1-origin)')
    parser.add_argument('--version', action='version', version='0.2.1')
    parser.add_argument('map_dir', metavar='MAP_DIRECTORY',
                        help='directory in which to save the map')
    parser.add_argument('powerpoint', metavar='POWERPOINT_FILE',
                        help='the name of a Powerpoint file')

    ## specify range of slides...
    # --force option

    args = parser.parse_args()

    if not os.path.exists(args.map_dir):
        os.makedirs(args.map_dir)

    filenames = []
    processes = []
    extractor = GeoJsonExtractor(args.powerpoint, args)
    result_queue = multiprocessing.Queue()
    for s in range(len(extractor)):
        # We extract slides in parallel...
        (fh, filename) = tempfile.mkstemp(suffix='.json')
        os.close(fh)
        filenames.append(filename)

        process = multiprocessing.Process(target=process_slide, args=(extractor, s + 1, filename, result_queue))
        processes.append(process)
        process.start()

    # Wait for all processes to complete

    num_processes = len(processes)
    while num_processes:
        print(result_queue.get())
        num_processes -= 1
    for process in processes:
        process.join()

    print('Running tippecanoe...')
    tile_dir = os.path.join(args.map_dir, 'mvtiles')
    subprocess.run(['tippecanoe',
                    '--projection=EPSG:4326',
                    '--no-tile-compression',
                    '--force',  ## Set layer names...
                    '--output-to-directory={}'.format(tile_dir)]
                    + filenames)

    # Now finished with temporary files so remove them

    for filename in filenames:
        os.remove(filename)

    # Now read os.path.join(tile_dir, metadata.json)
    # and create style.json

#===============================================================================
