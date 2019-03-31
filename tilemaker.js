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

//==============================================================================

const TILE_PIXELS = [256, 256];

//==============================================================================

class TileMaker
{
	constructor(id, size, outputDirectory)
	{
		this._id = id;
		this._size = size;
		this._tileDims = [Math.ceil(size[0]/TILE_PIXELS[0]),
                          Math.ceil(size[1]/TILE_PIXELS[1])];
        this._tiledSize = [TILE_PIXELS[0]*this._tileDims[0],
                           TILE_PIXELS[1]*this._tileDims[1]];
        const maxTileDim = Math.max(this._tileDims[0], this._tileDims[1]);
        this._fullZoom = Math.ceil(Math.log2(maxTileDim));
		this._outputDirectory = outputDirectory;
	}

	tile(layer)
	{
		console.log(layer.id);
	}
}

//==============================================================================

async function main()
{
	if (process.argv.length < 4) {
	  	console.error('Usage: tilemaker SPECIFICATION OUTPUT_DIRECTORY');
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

	const tileMaker = new TileMaker(map.id, map.size, outputDirectory);

	for (const layer of map.layers) {
		tileMaker.tile(layer);
	}
}

//==============================================================================

main();

//==============================================================================
