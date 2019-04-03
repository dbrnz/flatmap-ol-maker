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

const Jimp = require('jimp');

//==============================================================================

const cropImage = require('../src/cropimage');

//==============================================================================

const TEST_IMAGE = 'test-image';        // 345 x 385
const TEST_IMAGE_DIR = 'tests/data';

//==============================================================================

expect.extend({
    async toBeCroppedImage(cropId, image, x, y, w, h) {
        const croppedImage = await cropImage.cropImage(image, x, y, w, h);
        const croppedImageFile = `${TEST_IMAGE_DIR}/${TEST_IMAGE}-cropped-${cropId}.png`;
        const expectedImage = await Jimp.read(croppedImageFile);
        const difference = Jimp.diff(croppedImage, expectedImage, 0);
        if (difference.percent === 0) {
            return {
                message: () => `expected ${croppedImageFile} not to be (${x}, ${y}, ${w}, ${h}) crop of ${TEST_IMAGE}`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${croppedImageFile} to be (${x}, ${y}, ${w}, ${h}) crop of ${TEST_IMAGE}`,
                pass: false
            };
        }

    }
});

//==============================================================================

test('image cropping', async () => {
    const image = await new Jimp.read(`${TEST_IMAGE_DIR}/${TEST_IMAGE}.png`);
    await expect('a').toBeCroppedImage(image, 0, 0, 345, 385);
    await expect('b').toBeCroppedImage(image, 0, 0, 345, 190);
    await expect('c').toBeCroppedImage(image, 0, 190, 345, 195);
    await expect('d').toBeCroppedImage(image, 0, 0, 170, 385);
    await expect('e').toBeCroppedImage(image, 170, 0, 175, 385);
    await expect('f').toBeCroppedImage(image, -100, 100, 70, 70);
    await expect('g').toBeCroppedImage(image, -100, 100, 70, 370);
    await expect('h').toBeCroppedImage(image, -10, -10, 110, 110);
    await expect('i').toBeCroppedImage(image, 300, -100, 100, 270);
    await expect('j').toBeCroppedImage(image, 150, 150, 70, 70);
    await expect('k').toBeCroppedImage(image, 60, 350, 70, 70);
    await expect('l').toBeCroppedImage(image, 60, 400, 70, 70);
});

//==============================================================================
