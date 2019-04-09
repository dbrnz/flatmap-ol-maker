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

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const sizeOf = require('image-size');
const Jimp = require('jimp');
const puppeteer = require('puppeteer');

//==============================================================================

const cropImage = require('./cropimage');

//==============================================================================

const TILE_PIXEL_SIZE = [256, 256];

//==============================================================================

async function svgToPng(svgBase64, svgExtent, imageSize)
{
    const canvas = document.createElement('canvas');
    canvas.width = imageSize[0];
    canvas.height = imageSize[1];

    const ctx = canvas.getContext('2d');

    // Set transparent background
    ctx.fillStyle = '#00000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    document.body.appendChild(img);

    return new Promise((resolve, reject) =>
    {
        const onLoad = () =>
        {
            ctx.drawImage(img, svgExtent[0], svgExtent[1], svgExtent[2], svgExtent[3],
                               0, 0, imageSize[0], imageSize[1]);
            const dataURI = canvas.toDataURL('image/png');
            document.body.removeChild(img);
            resolve(dataURI);
        }

        const onError = (e) =>
        {
          document.body.removeChild(img);
          reject(`ERROR: ${e}`);
        }

        img.addEventListener("load", onLoad);
        img.addEventListener("error", onError);
        img.src = `data:image/svg+xml;base64,${svgBase64}`;
    });
}


//==============================================================================

/**
 * Add transparency to an image.
 *
 * @param      {Jimp}   image                A Jimp image
 * @param      {String}   transparentColour  The transparent colour as a CSS colour value
 * @return     {boolean}  true if the resulting image is fully transparent
 */
function makeTransparent(image, transparentColour)
{
    let transparent = undefined;
    if (transparentColour !== undefined) {
        transparent = true;
        const colour = Jimp.cssColorToHex(transparentColour);
        const imageBitmapData = image.bitmap.data;
        for (let index = 0; index < imageBitmapData.length; index += 4) {
            if (colour === imageBitmapData.readUInt32BE(index)) {
                imageBitmapData.fill(0, index, index+4);
            } else if (transparent && imageBitmapData[index + 3]) {
                transparent = false;
            }
        }
    }
    return transparent;
}

//==============================================================================

/**
 * Test if an image is transparent.
 *
 * @param      {Jimp}   image   A Jimp image
 * @return     {boolean}  true if the resulting image is fully transparent
 */
function transparent(image)
{
    const imageBitmapData = image.bitmap.data;
    for (let index = 0; index < imageBitmapData.length; index += 4) {
        if (imageBitmapData[index + 3]) {
            return false;
        }
    }
    return true;
}

//==============================================================================

class MapMaker
{
	constructor(map, outputDirectory)
	{
        this._map = map;
		this._tileDims = [Math.ceil(this._map.size[0]/TILE_PIXEL_SIZE[0]),
                          Math.ceil(this._map.size[1]/TILE_PIXEL_SIZE[1])];
        this._tiledSize = [TILE_PIXEL_SIZE[0]*this._tileDims[0],
                           TILE_PIXEL_SIZE[1]*this._tileDims[1]];
        const maxTileDim = Math.max(this._tileDims[0], this._tileDims[1]);
        this._fullZoom = Math.ceil(Math.log2(maxTileDim));
        this._outputDirectory = outputDirectory;
		this._tileDirectory = path.join(outputDirectory, 'tiles');
	}

    /**
     * Read a SVG file.
     *
     * @param      {String}   svgPath  The path of the SVG file.
     * @return     {Promise}  A Promise resolving to a Buffer.
     */
    async readSvgAsBuffer_(svgPath)
    //=============================
    {
        return new Promise((resolve, reject) => {
            fs.readFile(svgPath, (err, data) => {
                if (err) reject(err)
                else resolve(data);
            })
        });
    }

    async tileZoomLevel_(layer, zoomLevel, svgBuffer, svgExtent, imageSize, page)
    //===========================================================================
    {
        const zoomScale = 2**(this._fullZoom - zoomLevel);
        const zoomedSize = [imageSize[0]/zoomScale, imageSize[1]/zoomScale];

        const pngDataURI = await page.evaluate(svgToPng, svgBuffer.toString('base64'), svgExtent, zoomedSize);

        const pngImage = await Jimp.create(Buffer.from(pngDataURI.substr('data:image/png;base64,'.length), 'base64'));

        const origin = layer.origin ? [layer.origin[0]/zoomScale, layer.origin[1]/zoomScale]
                                    : [0, 0];

        const xTileStart = Math.floor(origin[0]/TILE_PIXEL_SIZE[0]);
        const xStart = xTileStart*TILE_PIXEL_SIZE[0] - origin[0];

        const yTileStart = Math.floor(origin[1]/TILE_PIXEL_SIZE[1]);
        const yStart = zoomedSize[1] + origin[1] - yTileStart*TILE_PIXEL_SIZE[1] - TILE_PIXEL_SIZE[1];

        // Create tiles and write them out

        const tilePromises = [];
        for (let x = xTileStart, xOffset = xStart;
             xOffset < zoomedSize[0];
             x +=1, xOffset += TILE_PIXEL_SIZE[0]) {

            const tileDirectory = path.join(this._tileDirectory, layer.id, `${zoomLevel}`, `${x}`);
            let dirExists = fs.existsSync(tileDirectory);

            for (let y = yTileStart, yOffset = yStart;
                 yOffset > -TILE_PIXEL_SIZE[1];
                 y +=1, yOffset -= TILE_PIXEL_SIZE[1]) {

                const tile = await cropImage.cropImage(pngImage, xOffset, yOffset,
                                                       TILE_PIXEL_SIZE[0], TILE_PIXEL_SIZE[1]);
                if (!makeTransparent(tile, layer.transparent) && !transparent(tile)) {
                    if (!dirExists) {
                        fs.mkdirSync(tileDirectory, {recursive: true, mode: 0o755});
                        dirExists = true;
                    }
                    tilePromises.push(tile.writeAsync(path.join(tileDirectory, `${y}.png`)));
                }
            }
        }
        console.log(`Tiled ${layer.id} at zoom level ${zoomLevel}`)

        return Promise.all(tilePromises);
    }

    async tileLayer_(layer, browser)
    //==============================
    {
        const svgBuffer = await this.readSvgAsBuffer_(layer.source);

        let svgExtent = layer.sourceExtent;
        if (!svgExtent) {
            const dimensions = sizeOf(svgBuffer);
            svgExtent = [0, 0, dimensions.width, dimensions.height];
        }

        let imageSize = this._map.size;
        if (layer.resolution) {
            imageSize = [layer.resolution*svgExtent[2], layer.resolution*svgExtent[3]];
        }

        const zoomRange = layer.zoom || [0, this._fullZoom];

        // Only generate tiles if SVG and/or map and/or layer attributes have changed

        let md5Hash = crypto.createHash('md5')
                           .update(layer.id)
                           .update(svgBuffer)
                           .update(JSON.stringify(this._map.size))
                           .update(JSON.stringify(layer.sourceExtent || []))
                           .update(JSON.stringify(layer.resolution || 1))
                           .update(JSON.stringify(layer.transparent || null))
                           .update(JSON.stringify(zoomRange))
                           .digest("hex");
        const md5File = path.join(this._tileDirectory, layer.id, 'layer.md5');
        if (fs.existsSync(md5File) && fs.readFileSync(md5File, 'utf-8') === md5Hash) {
            return;
        }

        const page = await browser.newPage();
        page.on('console', msg => console.log(`Layer ${layer.id}:`, msg.text()));

        // Tile all zoom levels in the layer

        const zoomPromises = [];
        for (let z = zoomRange[0]; z <= zoomRange[1]; z += 1) {
            zoomPromises.push(this.tileZoomLevel_(layer, z, svgBuffer, svgExtent, imageSize, page));
        }
        await Promise.all(zoomPromises);

        // Save md5 hash with layer

        fs.writeFileSync(md5File, md5Hash);
    }

    async makeTiles()
    //===============
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

    copyFeatures()
    //============
    {
        const featuresSourceDir = path.resolve(this._map.inputDirectory, 'features');
        const featuresOutputDir = path.join(this._outputDirectory, 'features');

        if (!fs.existsSync(featuresOutputDir)) {
            fs.mkdirSync(featuresOutputDir, {mode: 0o755});
        }

        for (const layer of this._map.layers) {
            const featureSourceFile = path.join(featuresSourceDir, `${layer.id}.json`);
            if (fs.existsSync(featureSourceFile)) {
                fs.copyFileSync(featureSourceFile, path.join(featuresOutputDir, `${layer.id}.json`))
            }
        }
    }

    writeIndex()
    //==========
    {
        const index = {
             id: this._map.id,
             size: this._map.size,
             layerSwitcher: true,  // via class of containg div ??
             // overviewMap: true,   // Currently ignored, HTML styling class??
             // features: true,      // deprecated
             // editable: true,      // Depends on user level
             layers: []
        };

        for (const layer of this._map.layers) {
            const attributes = {
                id: layer.id,
                source: layer.id
            };
            if (layer.title) {
                attributes.title = layer.title;
            }
            index.layers.push(attributes);
        }

        fs.writeFileSync(path.join(this._outputDirectory, 'index.json'), JSON.stringify(index, null, 2));
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
    const specDir = path.dirname(path.resolve(specification));

	const outputDirectory = process.argv[3];
 	if (!fs.existsSync(path.resolve(outputDirectory))) {
        fs.mkdirSync(outputDirectory, {recursive: true, mode: 0o755});
  	}

	const map = JSON.parse(fs.readFileSync(specification));
    map.inputDirectory = specDir;

	for (const layer of map.layers) {
        // Paths are wrt the specification file's directory
        const sourceFile = path.resolve(map.inputDirectory,
                               (layer.sourceType === 'celldl') ? path.join('celldl', `${layer.id}.xml`)
                             : (layer.sourceType === 'svg') ? path.join('svg', `${layer.id}.svg`)
                             :                                path.join('svg', `${layer.id}.svg`)  // Default to SVG
                           );
	 	if (!fs.existsSync(sourceFile)) {
		  	console.error(`Source file '${sourceFile} does not exist`);
	  		process.exit(-1);
	  	}
        layer.source = sourceFile;
	}

	const mapMaker = new MapMaker(map, outputDirectory);

	try {
        mapMaker.makeTiles();
        mapMaker.copyFeatures();
        mapMaker.writeIndex();
	} catch (e) {
		console.error(e.message);
	}
}

//==============================================================================

module.exports.main = main;

//==============================================================================
