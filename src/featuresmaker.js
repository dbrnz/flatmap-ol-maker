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
const fs = require('fs');

const et = require('elementtree');

const simplify = require('simplify');

const {SVG, registerWindow, select} = require('@svgdotjs/svg.js');
const svgdom = require('svgdom');
const svgflatten = require('svg-flatten');
const svgpath = require('svgpath');

//==============================================================================

function setChildParents(node) {
    for (const child of node.getchildren()) {
        child.parent = node;
        setChildParents(child);
    }
}

//==============================================================================

function round(x, decimals=2)
{
    const m = Math.pow(10, decimals);
    return Math.floor(m*x + 0.5)/m;
}

//==============================================================================

function differentPaths(path1, path2, tolerance=1)
{
    if (path1.length === path2.length) {
        for (let i = 0; i < path1.length; i++) {
            if (Math.abs(path1[i][0] - path2[i][0]) > tolerance
             || Math.abs(path1[i][1] - path2[i][1]) > tolerance) {
                return true;
            }
        }
        return false;
    }
    return true;
}

//==============================================================================

class LayerFeatures
{
    constructor(layer, mapSize, SVGDrawElement)
    {
        const svg = fs.readFileSync(layer.source, 'utf8');
        const flatSvg = svgflatten(svg).pathify().value();

        this._layer = layer;
        this._xml = et.parse(flatSvg).getroot();
        setChildParents(this._xml);

        this._svgWidth = parseFloat(this._xml.attrib.width);
        this._svgHeight = parseFloat(this._xml.attrib.height);;

        if (layer.sourceExtent) {
            this._svgExtent = layer.sourceExtent;
        } else {
            this._svgExtent = [0, 0, this._svgWidth, this._svgHeight];
        }

        if (layer.resolution) {
            this._mapSize = [layer.resolution*this._svgExtent[2],
                             layer.resolution*this._svgExtent[3]];
        } else {
            this._mapSize = mapSize;
        }

        if (layer.origin) {
            this._layerOrigin = layer.origin;
        } else {
            this._layerOrigin = [0, 0];
        }

        this._tolerance = 0.3;   // A function of svg size??

        this._SVGDrawElement = SVGDrawElement
    }

    pointToMap_(pt)
    //=============
    {
        return [round(this._mapSize[0]*(pt[0] - this._svgExtent[0])/this._svgExtent[2] + this._layerOrigin[0]),
                round(this._mapSize[1]*(this._svgHeight - this._svgExtent[1] - pt[1])/this._svgExtent[3] + this._layerOrigin[1])];
    }

    simplifiedPathPoints_(pathNode)
    //=============================
    {
        let pathDescription = svgpath(pathNode.attrib.d);
        let node = pathNode;
        while (node && node.tag !== 'svg') {
            if (node.attrib.transform) {
                pathDescription = pathDescription.transform(node.attrib.transform);
            }
            node = node.parent;
        }
        const path = this._SVGDrawElement.path(pathDescription.toString());

        let len = 0;
        try {
            len = path.length();
        } catch (e) {
            return { data: [], hash: '0', valid: true };
        }

        const pts = [];
        for (let i = 0; i <= 1000; ++i) {
            const pt = path.pointAt(i*len/1000);
            if (0 < pt.x && pt.x < this._svgWidth
             && 0 < pt.y && pt.y < this._svgHeight) {
                pts.push(pt);
            } else {
                return { data: [], hash: '0', valid: false };
            }
        }

        const result = [];
        for (let pt of simplify(pts, this._tolerance)) {
            result.push([pt.x, pt.y]);
        }
        return {
            data: result,
            hash: `${result.length}/${len.toPrecision(5)}`,
            valid: true
        }
    }

    pathToGeoJsonFeature_(points)
    //===========================
    {
        const coords = [];
        let geometry = 'Polygon';
        const pt0 = points[0];
        coords.push(this.pointToMap_(pt0));
        const lastIndex = points.length - 1;
        for (let i = 1; i < lastIndex; ++i) {
            const pt = points[i];
            coords.push(this.pointToMap_(pt));
        }
        const pt = points[lastIndex];
        if (pt0[0] !== pt[0] || pt0[1] !== pt[1]) {
            coords.push(this.pointToMap_(pt));
            geometry = 'LineString';
        }

        const feature = {
            type: "Feature",
            geometry: {
                type: geometry,
                coordinates: null
            },
            properties: {}
        };
        if (geometry === 'LineString') {
            feature.geometry.coordinates = coords;
        } else {
            feature.geometry.coordinates = [coords];
        }
        return feature;
    }

    extendGeoJson(featureJson=null)
    //=============================
    {
        const geoJson = {
            type: "FeatureCollection",
            features: [],
            id: this._layer.id
        };

        const hashMap = new Map();   // hash --> data

        // Get existing features.
        //
        // We include those with a matching `svgPathId`
        // and those with no path id.
        const featuresMap = new Map();
        if (featureJson) {
            for (const feature of featureJson.features) {
                if (feature.properties && feature.properties.svgPathId) {
                    featuresMap.set(feature.properties.svgPathId, feature);
                } else {
                    if (!feature.properties) {
                        feature.properties = {};
                    }
                    geoJson.features.push(feature);
                }
            }
        }

        for (const path of this._xml.findall('.//path')) {
            if (path.parent.tag !== 'clipPath'
             && (!this._layer.svgExcludes || this._layer.svgExcludes.indexOf(path.attrib.id) < 0)) {
                const points = this.simplifiedPathPoints_(path);
                if (points.valid) {
                    if (points.data.length === 0) {
                        console.warn('No path length:', this._layer.id, path.attrib.id);
                    } else {
                        const newPath = hashMap.has(points.hash)
                                        ? differentPaths(hashMap.get(points.hash), points.data, this._tolerance)
                                        : true;
                        if (newPath) {
                            let feature = null;
                            const newFeature = this.pathToGeoJsonFeature_(points.data);
                            if (featuresMap.has(path.attrib.id)) {
                                feature = featuresMap.get(path.attrib.id);
                                delete feature.properties.svgPathId;
                                // Only update geometry if `force` option...
                                if (!feature.hasOwnProperty('geometry')) {
                                    feature.geometry = newFeature.geometry;
                                }
                            } else {
                                feature = newFeature;
                            }
                            feature.properties.svgPathId = path.attrib.id;

                            geoJson.features.push(feature);
                            hashMap.set(points.hash, points.data);

                            console.log('Layer:', this._layer.id, ' Path:', path.attrib.id);
                        }
                    }
                }
            }
        }
        return geoJson;
    }
}

//==============================================================================

class FeaturesMaker
{
    constructor(map, outputDirectory)
    {
        this._map = map;
        this._outputDirectory = outputDirectory;
    }

    async makeFeatures(layerId=null)
    //==============================
    {
        const document = svgdom.document;
        registerWindow(svgdom, svgdom.document);
        const SVGDrawElement = SVG(document.documentElement);

        const featuresSourceDir = path.resolve(this._map.inputDirectory, 'features');
        const featuresOutputDir = path.join(this._outputDirectory, 'features');

        for (const layer of this._map.layers) {
            if (layerId === null || layerId === layer.id) {
                const featureSourceFile = path.join(featuresSourceDir, `${layer.id}.json`);
                let featureJson = null;
                if (fs.existsSync(featureSourceFile)) {
                    const featureData = fs.readFileSync(featureSourceFile);  // readFile()
                    featureJson = JSON.parse(featureData);
                    if (featureJson.id !== layer.id) {
                        throw new Error(`Layer ${layer.id} has wrong feature ID (expected ${featureJson.id})`);
                    }
                }

                const layerFeatures = new LayerFeatures(layer, this._map.size, SVGDrawElement);
                const geoJson = layerFeatures.extendGeoJson(featureJson);


                if (!fs.existsSync(featuresOutputDir)) {
                    fs.mkdirSync(featuresOutputDir, {mode: 0o755});
                }

                fs.writeFileSync(path.join(featuresOutputDir, `${layer.id}.json`,
                                 JSON.stringify(geoJson, null, 2));
            }
        }
    }
}

//==============================================================================

module.exports.FeaturesMaker = FeaturesMaker;

//==============================================================================
