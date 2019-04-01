#!/usr/bin/env node
/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

const fs = require('fs');
const path = require('path');

const Jimp = require('jimp');
const puppeteer = require('puppeteer');

//==============================================================================

const TILE_PIXELS = [256, 256];

//==============================================================================

async function svgToPng(layer, svg, zoomLevel)
{
    const scale = 2**zoomLevel;  // some function of zoomLevel...  (map resolution)/2**zoom

    const canvas = document.createElement('canvas');
    canvas.id = `${layer.id}-${zoomLevel}-canvas`;

    const ctx = canvas.getContext('2d');

    const img = new Image();
    document.body.appendChild(img);

    return new Promise((resolve, reject) =>
    {
        const onLoad = () =>
        {
            let imageWidth = scale*img.naturalWidth;
            let imageHeight = scale*img.naturalHeight;
            canvas.width = imageWidth;
            canvas.height = imageHeight;

            // Set background color
            ctx.fillStyle = '#00000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            //const clip = { x: 0, y:0, width: 640, height: 360 };
            //ctx.drawImage(img, clip.x, clip.y, clip.width, clip.height, 0, 0, imageWidth, imageHeight);
            ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

            const dataURI = canvas.toDataURL('image/png');
            document.body.removeChild(img);

            console.log('Len:', dataURI.length);

            resolve(dataURI);
        }

        const onError = (e) =>
        {
          document.body.removeChild(img);
          reject(`ERROR: ${e}`);
        }

        img.addEventListener("load", onLoad);
        img.addEventListener("error", onError);
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    });
}

//==============================================================================

class MapMaker
{
	constructor(map, outputDirectory)
	{
        this._map = map;
		this._id = map.id;
		this._size = map.size;
		this._tileDims = [Math.ceil(this._size[0]/TILE_PIXELS[0]),
                          Math.ceil(this._size[1]/TILE_PIXELS[1])];
        this._tiledSize = [TILE_PIXELS[0]*this._tileDims[0],
                           TILE_PIXELS[1]*this._tileDims[1]];
        const maxTileDim = Math.max(this._tileDims[0], this._tileDims[1]);
        this._fullZoom = Math.ceil(Math.log2(maxTileDim));
		this._outputDirectory = outputDirectory;
	}

    async readSvg_(svgPath)
    {
        return new Promise((resolve, reject) => {
            fs.readFile(svgPath, 'utf-8', (err, data) => {
                if (err) reject(err)
                else resolve(data);
            })
        });
    }

    async writeTiles_(tileData, tilePath)
    {
        //const image = await Jimp.create(Buffer.from(tileData.substr('data:image/png;base64,'.length), 'base64'));
        console.log('writing', tilePath);
    //    image.write(tilePath);
    }

    async tileZoomLevel_(layer, svg, zoomLevel, page)
    {
        const pngDataURI = await page.evaluate(svgToPng, layer, svg, zoomLevel);

        // Now create tiles and write them out...
        // For all x, y tiles... (a Promise for each)
        // this.writeTiles_(pngDataURI, path_resolve(this._outputDirectory, tileName))
        //         .then(() => resolve());
    }

    async tileLayer_(layer, browser)
    {
        console.log('Tiling', layer.id);

        const svg = await this.readSvg_(layer.source);

        const page = await browser.newPage();
        page.on('console', msg => console.log(`Layer ${layer.id}:`, msg.text()));

        // Tile all zoom levels in the layer

        const zoomPromises = [];

        for (const zoomLevel of [0, 1]) {
            zoomPromises.push(this.tileZoomLevel_(layer, svg, zoomLevel, page));
        }

        // Wait for zoom level tiling to complete

        await Promise.all(zoomPromises);
    }

    async makeTiles()
    {
        const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-dev-shm-usage']});

        // Tile all layers

        const layerPromises = [];

        for (const layer of this._map.layers) {
            layerPromises.push(this.tileLayer_(layer, browser));
        }

        // Wait for layer tiling complete

        await Promise.all(layerPromises);

        // Then close the browser

        await browser.close();
    }



/*
		layer.source

        if scale is None {
            scaled_image = image.image
        }
        else {
            scaled_size = [scale[0]*image.width, scale[1]*image.height]
            scaled_image = image.image.resize(scaled_size, Image.LANCZOS)
        }

        tiled_image = Image.new('RGBA', this._tiledSize, (0, 0, 0, 0))

        if offset is None {
            offset = [0, 0]
        }
        else {
            // PIL origin is top left, map's is bottom right
            offset[1] = (this._map.bounds[1] - offset[1]) - scaled_image.height
        }

        overview_height = this._map.bounds[1]
        offset[1] += (this._tiledSize[1] - overview_height)
        tiled_image.paste(scaled_image, offset, scaled_image)

        // Divide tiled_image into TILE_PIXELS tiles, only outputting non-transparent
        // tiles.

        if zoom_range is None {
            zoom_range = range(this._fullZoom+1)
        }

        tiled_size = this._tileDims
        for z in range(this._fullZoom, -1, -1) {
            if z in zoom_range {
                console.log(`Tiling zoom level ${z} (${tiled_size[0]} x ${tiled_size[0]} tiles)`);
            }
            overview_image = Image.new('RGBA', (tiled_image.width//2, tiled_image.height//2), (0, 0, 0, 0))
            overview_size = (int(math.ceil(tiled_size[0]/2)), int(math.ceil(tiled_size[1]/2)))
            overview_height //= 2
            let left = 0;
            for x in range(tiled_size[0]) {
                lower = tiled_image.height
                for y in range(tiled_size[1]) {   // y = 0 is lowest tile row
                    tile = tiled_image.crop((left, lower-TILE_PIXELS[1], left+TILE_PIXELS[0], lower))
                    tile_name = os.path.join(this._map.id, 'tiles', image.layer_name, str(z), str(x), '{}.png'.format(y))
                    if tile.getbbox() {
                        if z in zoom_range {
                            create_directories(tile_name)
                            tile.save(tile_name)
                        }
                        half_tile = tile.resize((TILE_PIXELS[0]/2, TILE_PIXELS[1]/2), Image.LANCZOS)
                        overview_image.paste(half_tile, (left//2, (lower-TILE_PIXELS[1])/2), half_tile)
                    }
                    lower -= TILE_PIXELS[1];
                }
                left += TILE_PIXELS[0];
            }
            tiled_image = overview_image
            tiled_size = overview_size
        }
*/
}

//==============================================================================

function main()
{
	if (process.argv.length < 4) {
	  	console.error('Usage: mapmaker SPECIFICATION OUTPUT_DIRECTORY');
  		process.exit(-1);
	}

	const specification = process.argv[2];
 	if (!fs.existsSync(path.resolve(specification))) {
	  	console.error(`File '${specification} does not exist`);
  		process.exit(-1);
  	}
    const specDir = path.dirname(path.resolve(specification));

	const outputDirectory = process.argv[3];
 	if (!fs.existsSync(path.resolve(outputDirectory))) {
	  	console.error(`Directory '${outputDirectory} does not exist`);
  		process.exit(-1);
  	}

	const map = JSON.parse(fs.readFileSync(specification));

	for (const layer of map.layers) {
        // Relative paths wrt the specification file's directory
        if (!path.isAbsolute(layer.source)) {
            layer.source = path.resolve(specDir, layer.source);
        }
	 	if (!fs.existsSync(path.resolve(layer.source))) {
		  	console.error(`SVG file '${layer.source} does not exist`);
	  		process.exit(-1);
	  	}
	}

	const mapMaker = new MapMaker(map, outputDirectory);

	try {
        mapMaker.makeTiles();
	} catch (e) {
		console.error(e.message);
	}
}

//==============================================================================

main();

//==============================================================================
