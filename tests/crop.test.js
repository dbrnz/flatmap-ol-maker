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

const Jimp = require('jimp');

//==============================================================================

const cropImage = require('../src/cropimage');

//==============================================================================

const TEST_IMAGE_DIR = 'tests/data';
const TEST_FAILURE_DIR = 'tests/fails';

//==============================================================================

expect.extend({
    async toBeCroppedImage(cropId, image, imageName, x, y, w, h) {
        const croppedImage = await cropImage.cropImage(image, x, y, w, h);
        const croppedImageFile = `${TEST_IMAGE_DIR}/${imageName}-cropped-${cropId}.png`;
        const expectedImage = await Jimp.read(croppedImageFile);
        const difference = Jimp.diff(croppedImage, expectedImage, 0);
        if (difference.percent === 0) {
            return {
                message: () => `expected ${croppedImageFile} not to be (${x}, ${y}, ${w}, ${h}) crop of ${imageName}`,
                pass: true
            };
        } else {
            croppedImage.write(`${TEST_FAILURE_DIR}/${imageName}-cropped-${cropId}.png`);
            difference.image.write(`${TEST_FAILURE_DIR}/${imageName}-difference-${cropId}.png`);
            return {
                message: () => `expected ${croppedImageFile} to be (${x}, ${y}, ${w}, ${h}) crop of ${imageName}`,
                pass: false
            };
        }

    }
});

//==============================================================================

beforeAll(() => {
    return fs.emptyDir(TEST_FAILURE_DIR);
});

//==============================================================================

test('image cropping test 1', async () => {
    const TEST_IMAGE_1 = 'test-image';           // 345 x 385

    const image = await new Jimp.read(`${TEST_IMAGE_DIR}/${TEST_IMAGE_1}.png`);
    await expect('a').toBeCroppedImage(image, TEST_IMAGE_1, 0, 0, 345, 385);
    await expect('b').toBeCroppedImage(image, TEST_IMAGE_1, 0, 0, 345, 190);
    await expect('c').toBeCroppedImage(image, TEST_IMAGE_1, 0, 190, 345, 195);
    await expect('d').toBeCroppedImage(image, TEST_IMAGE_1, 0, 0, 170, 385);
    await expect('e').toBeCroppedImage(image, TEST_IMAGE_1, 170, 0, 175, 385);
    await expect('f').toBeCroppedImage(image, TEST_IMAGE_1, -100, 100, 70, 70);
    await expect('g').toBeCroppedImage(image, TEST_IMAGE_1, -100, 100, 70, 370);
    await expect('h').toBeCroppedImage(image, TEST_IMAGE_1, -10, -10, 110, 110);
    await expect('i').toBeCroppedImage(image, TEST_IMAGE_1, 300, -100, 100, 270);
    await expect('j').toBeCroppedImage(image, TEST_IMAGE_1, 150, 150, 70, 70);
    await expect('k').toBeCroppedImage(image, TEST_IMAGE_1, 60, 350, 70, 70);
    await expect('l').toBeCroppedImage(image, TEST_IMAGE_1, 60, 400, 70, 70);
});

//==============================================================================

test('image cropping test 2', async () => {
    const TEST_IMAGE_2 = 'circle-125x125';       // 125 x 125

    const image = await new Jimp.read(`${TEST_IMAGE_DIR}/${TEST_IMAGE_2}.png`);
    await expect('125-6').toBeCroppedImage(image, TEST_IMAGE_2, -125, -6, 256, 256);
});

//==============================================================================

test('image cropping test 3', async () => {
    const TEST_IMAGE_3 = 'brainstem-603x763';    // 603 x 763

    const image = await new Jimp.read(`${TEST_IMAGE_DIR}/${TEST_IMAGE_3}.png`);
    await expect('-132-465').toBeCroppedImage(image, TEST_IMAGE_3, -132, 464.75, 256, 256);
});

//==============================================================================
