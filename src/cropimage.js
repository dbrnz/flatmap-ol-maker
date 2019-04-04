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

async function cropImage(image, x, y, w, h)
{
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);

    const imageBitmapData = image.bitmap.data;
    const imageDataLength = imageBitmapData.length;

    const imageWidth = image.bitmap.width;
    const imageRowBytes = imageWidth*4;
    const imageHeight = image.bitmap.height;

    const croppedRowBytes = 4*w;
    const croppedBitmapData = Buffer.allocUnsafe(h*croppedRowBytes);

    if ((x + w) <= 0 || x >= imageWidth
     || (y + h) <= 0 || y >= imageHeight) {
        croppedBitmapData.fill(0, 0, h*croppedRowBytes);
    } else {
        let imageStartRow = y;
        let imageEndRow = imageStartRow + h;
        let cropStartRow = 0;
        let cropEndRow = h;

        if (imageStartRow < 0) {
            croppedBitmapData.fill(0, 0, -imageStartRow*croppedRowBytes);
            cropStartRow = -imageStartRow;
            imageStartRow = 0;
        }

        if (imageEndRow > imageHeight) {
            croppedBitmapData.fill(0, (imageHeight - y)*croppedRowBytes, h*croppedRowBytes);
            cropEndRow -= (imageEndRow - imageHeight);
            imageEndRow = imageHeight;
        }

        if (x === 0 && w === imageWidth) {
            imageBitmapData.copy(croppedBitmapData, cropStartRow*w, imageStartRow*imageRowBytes, imageEndRow*imageRowBytes);
        } else {
/*
            |_____xxx|    lb + d = w, rb = 0          lb at 0, d bytes at lb, lb = w - d
            |xxx_____|    d + rb = w, lb = 0          d bytes at 0, rb at d, rb = w - d
            |xxxxxxxx|    lb = 0, d = w, rb = 0       d bytes at 0
            |__xxx___|    lb + d + rb = w             lb at 0, d bytes at lb, rb at (lb + d)
*/


            let croppedOffset = 0;
            let imageRowOffset = 0;
            let leftBlankStart = 0;
            let rightBlankStart = croppedRowBytes;

            let rightBlanks = null;
            if ((x + w) > imageWidth) {
                const blankBytes = (x + w - imageWidth)*4;
                rightBlanks = Buffer.alloc(blankBytes, 0);
                rightBlankStart -= blankBytes;
            }

            let leftBlanks = null;
            if (x < 0) {
                const blankBytes = -x*4;
                leftBlanks = Buffer.alloc(blankBytes, 0);
                croppedOffset = blankBytes;
                x = 0;
            }

            croppedOffset += (cropStartRow*croppedRowBytes);
            imageRowOffset += (imageStartRow*imageRowBytes + x*4);
            leftBlankStart += (cropStartRow*croppedRowBytes);
            rightBlankStart += (cropStartRow*croppedRowBytes);
            let imageRowEnd = imageRowOffset + croppedRowBytes;
            if (leftBlanks) {
                imageRowEnd -= leftBlanks.length;
            }
            if (rightBlanks) {
                imageRowEnd -= rightBlanks.length;
            }
            while (cropStartRow < cropEndRow) {
                if (leftBlanks) {
                    leftBlanks.copy(croppedBitmapData, leftBlankStart);
                }
                imageBitmapData.copy(croppedBitmapData, croppedOffset, imageRowOffset, imageRowEnd);
                if (rightBlanks) {
                    rightBlanks.copy(croppedBitmapData, rightBlankStart);
                }
                leftBlankStart += croppedRowBytes;
                rightBlankStart += croppedRowBytes;
                croppedOffset += croppedRowBytes;
                imageRowOffset += imageRowBytes;
                imageRowEnd += imageRowBytes;
                cropStartRow += 1;
            }
        }
    }

    const croppedImage = await new Jimp({ data: croppedBitmapData, width: w, height: h });
    return croppedImage;
}

//==============================================================================

module.exports.cropImage = cropImage;

//==============================================================================
