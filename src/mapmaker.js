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

    async readSvg(filePath)
    {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) reject(err)
                else resolve(data);
            })
        });
    }

    async writeTiles(tileData, filePath)
    {
        const image = await Jimp.create(Buffer.from(tileData.substr('data:image/png;base64,'.length), 'base64'));
        image.write(filePath);
    }

    async createTiles(options)
    {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        async function tileZoomLevel(svg, options, scale)
        {
          return new Promise((resolve, reject) =>
          {
            const img = new Image();

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

                this.writeTiles(dataURI, options).then(() => resolve());
            }

            const onError = (e) =>
            {
              document.body.removeChild(img);
              reject(`ERROR: ${e}`);
            }

            img.addEventListener("load", onLoad);
            img.addEventListener("error", onError);

            document.body.appendChild(img);

            img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

          });
        }

        async function tileLayer(options)
        {
            const svg = await this.readSvg(options.svg);

            // For all zoom levels

            const res1 = tileZoomLevel(svg, `s1-${options.png}`, 1);
            const res2 = tileZoomLevel(svg, `s2-${options.png}`, 2);

            return Promise.all([res1, res2]);
        }

        // For all layers
//        for (const layer of this._map.layers) {
//            tileMaker.tile(layer);
//        }

        const layer1 = tileLayer(options);
        return Promise.all([layer1]);
    }

    async makeTiles(options)
    {
        const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-dev-shm-usage']});
        const page = await browser.newPage();

        await page.exposeFunction('readSvg', this.readSvg);
        await page.exposeFunction('writeTiles', this.writeTiles);

        await page.evaluate(this.createTiles, options);

        await browser.close();
    }

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

	const outputDirectory = process.argv[3];
 	if (!fs.existsSync(path.resolve(outputDirectory))) {
	  	console.error(`Directory '${outputDirectory} does not exist`);
  		process.exit(-1);
  	}

	const map = JSON.parse(fs.readFileSync(specification));

	for (const layer of map.layers) {
	 	if (!fs.existsSync(path.resolve(layer.source))) {
		  	console.error(`SVG file '${layer.source} does not exist`);
	  		process.exit(-1);
	  	}
	}

	const mapMaker = new MapMaker(map, outputDirectory);

	try {
        const options = {svg: 'f.svg', png: 'f.png'};
        mapMaker.makeTiles(options);
	} catch (e) {
		console.error(e.message);
	}
}

//==============================================================================

main();

//==============================================================================
