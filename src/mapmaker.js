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

const fs = require('fs-extra');
const path = require('path');

const ArgumentParser = require('argparse').ArgumentParser;

//==============================================================================

const tilemaker = require('./tilemaker');
const featuresmaker = require('./featuresmaker');

//==============================================================================

class MapMaker
{
	constructor(map, outputDirectory)
	{
        this._map = map;
        this._outputDirectory = outputDirectory;

        this._tileMaker = new tilemaker.TileMaker(map, outputDirectory);
        this._featuresMaker = new featuresmaker.FeaturesMaker(map, outputDirectory);
	}


    makeFeatures()
    //============
    {
        this._featuresMaker.makeFeatures();
    }

    makeTiles()
    //=========
    {
        this._tileMaker.makeTiles();
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
                id: layer.id
            };
            if (layer.title) {
                attributes.title = layer.title;
            }
            if (layer.zoom) {
                attributes.zoom = layer.zoom;
            }
            index.layers.push(attributes);
        }

        fs.writeFileSync(path.join(this._outputDirectory, 'index.json'), JSON.stringify(index, null, 2));
    }
}

//==============================================================================

function main()
{
    const argumentParser = new ArgumentParser({
          description: 'Create tiled flatmaps', version: '0.4.1'
    });
    argumentParser.addArgument('specification', {
        metavar: 'SPECIFICATION_DIRECTORY',
        help: `Directory containing the map's 'mapmaker.json' specification file
               and image and feature sub-directories.`
    });
    argumentParser.addArgument('output', {
        metavar: 'OUTPUT_DIRECTORY',
        help: 'Directory in which to create the tiled map.'
    });
    const args = argumentParser.parseArgs();

    const specDir = args.specification;
    const specification = path.resolve(specDir, 'mapmaker.json');
 	if (!fs.existsSync(specification)) {
	  	console.error(`File '${specification}' does not exist`);
  		process.exit(-1);
  	}

	const outputDirectory = args.output;
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
